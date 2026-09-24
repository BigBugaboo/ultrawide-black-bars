(() => {
  const STORAGE_KEY = 'ubb-mode';
  const FEEDBACK_KEY = 'ubb-feedback';
  const MODES = ['original', 'crop', 'ambient'];
  const MODE_LABELS = {
    original: 'Original',
    crop: 'Crop to Fill',
    ambient: 'Ambient Light'
  };
  const ULTRAWIDE_RATIO = 2.1;

  const state = {
    requestedMode: 'original',
    wrapper: null,
    video: null,
    ambient: null,
    ambientVideos: [],
    toast: null,
    syncScheduled: false,
    syncPlayback: null,
    pendingFeedback: false,
    ambientSupported: true
  };

  function normalizeMode(mode) {
    return MODES.includes(mode) ? mode : MODES[0];
  }

  function isUltrawideViewport() {
    return window.innerWidth / Math.max(window.innerHeight, 1) >= ULTRAWIDE_RATIO;
  }

  function findMainVideo() {
    return document.querySelector('video:not(.ubb-ambient-video)');
  }

  function findWrapper(video) {
    return video.closest(
      '.bpx-player-video-area, .bpx-player-video-wrap, .bilibili-player-video-wrap, .bilibili-player-video'
    ) || video.parentElement;
  }

  function ensureStyles() {
    if (document.getElementById('ubb-style')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'ubb-style';
    style.textContent = `
      .ubb-wrapper {
        position: relative !important;
        overflow: hidden !important;
        background: #000 !important;
      }

      .ubb-wrapper > .ubb-ambient {
        position: absolute;
        inset: 0;
        display: none;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
      }

      .ubb-wrapper[data-ubb-mode="ambient"] > .ubb-ambient {
        display: block;
      }

      .ubb-wrapper > .ubb-ambient > video {
        position: absolute;
        top: 0;
        width: 50%;
        height: 100%;
        object-fit: cover;
        filter: blur(54px) saturate(1.4) brightness(0.68);
        opacity: 0.95;
        transform: scale(1.35);
      }

      .ubb-wrapper > .ubb-ambient > video:first-child {
        left: 0;
        object-position: left center;
      }

      .ubb-wrapper > .ubb-ambient > video:last-child {
        right: 0;
        object-position: right center;
      }

      .ubb-wrapper > :not(.ubb-ambient) {
        position: relative;
        z-index: 1;
      }

      .ubb-mode-toast {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 2147483647;
        padding: 10px 12px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.76);
        color: #fff;
        font: 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: none;
        opacity: 0;
        transform: translateY(-6px);
        transition: opacity 0.18s ease, transform 0.18s ease;
      }

      .ubb-mode-toast[data-visible="true"] {
        opacity: 1;
        transform: translateY(0);
      }
    `;

    document.documentElement.appendChild(style);
  }

  function clearAmbientVideos() {
    for (const ambientVideo of state.ambientVideos) {
      ambientVideo.pause();
      ambientVideo.removeAttribute('src');
      ambientVideo.srcObject = null;
      ambientVideo.remove();
    }

    state.ambientVideos = [];
  }

  function releaseVideoState() {
    if (state.video) {
      if (state.syncPlayback) {
        state.video.removeEventListener('play', state.syncPlayback);
        state.video.removeEventListener('loadeddata', state.syncPlayback);
      }

      state.video.style.objectFit = state.video.dataset.ubbOriginalObjectFit || '';
      delete state.video.dataset.ubbOriginalObjectFit;
    }

    state.video = null;
    state.syncPlayback = null;
  }

  function releaseAmbient() {
    if (state.wrapper) {
      state.wrapper.classList.remove('ubb-wrapper');
      delete state.wrapper.dataset.ubbMode;
    }

    clearAmbientVideos();

    if (state.ambient) {
      state.ambient.remove();
    }

    state.wrapper = null;
    state.ambient = null;
    state.ambientSupported = true;
  }

  function releaseTrackedElements() {
    releaseVideoState();
    releaseAmbient();
  }

  function playAmbientVideos() {
    for (const ambientVideo of state.ambientVideos) {
      ambientVideo.play().catch(() => {});
    }
  }

  function ensureAmbient(wrapper, video) {
    if (state.wrapper === wrapper && state.ambient) {
      return;
    }

    releaseAmbient();
    state.wrapper = wrapper;

    state.wrapper.classList.add('ubb-wrapper');

    const ambient = document.createElement('div');
    ambient.className = 'ubb-ambient';

    const streamFactory = video.captureStream || video.mozCaptureStream;
    const stream = typeof streamFactory === 'function' ? streamFactory.call(video) : null;

    state.ambientSupported = Boolean(stream);

    if (!stream) {
      state.wrapper.prepend(ambient);
      state.ambient = ambient;
      return;
    }

    for (let index = 0; index < 2; index += 1) {
      const ambientVideo = document.createElement('video');
      ambientVideo.className = 'ubb-ambient-video';
      ambientVideo.muted = true;
      ambientVideo.autoplay = true;
      ambientVideo.playsInline = true;
      ambientVideo.setAttribute('aria-hidden', 'true');
      ambientVideo.srcObject = stream;

      ambient.appendChild(ambientVideo);
      state.ambientVideos.push(ambientVideo);
    }

    state.wrapper.prepend(ambient);
    state.ambient = ambient;

    state.syncPlayback = () => playAmbientVideos();
    video.addEventListener('play', state.syncPlayback);
    video.addEventListener('loadeddata', state.syncPlayback);
  }

  function ensureToast() {
    if (state.toast) {
      return state.toast;
    }

    const toast = document.createElement('div');
    toast.className = 'ubb-mode-toast';
    document.body.appendChild(toast);
    state.toast = toast;
    return toast;
  }

  let toastTimer = 0;

  function showToast(message) {
    if (!document.body) {
      return;
    }

    const toast = ensureToast();
    toast.textContent = message;
    toast.dataset.visible = 'true';
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.dataset.visible = 'false';
    }, 1400);
  }

  function applyMode(showFeedback) {
    const video = findMainVideo();
    if (!video) {
      releaseTrackedElements();
      return;
    }

    const wrapper = findWrapper(video);
    if (!wrapper) {
      releaseTrackedElements();
      return;
    }

    if (state.video !== video) {
      if (state.ambient) {
        releaseAmbient();
      }

      releaseVideoState();
      state.video = video;

      if (!state.video.dataset.ubbOriginalObjectFit) {
        state.video.dataset.ubbOriginalObjectFit = state.video.style.objectFit || '';
      }
    }

    if (state.requestedMode === 'ambient') {
      ensureAmbient(wrapper, video);
    }

    const preferredMode =
      state.requestedMode === 'ambient' && !state.ambientSupported
        ? 'original'
        : state.requestedMode;
    const effectiveMode = isUltrawideViewport() ? preferredMode : 'original';

    if (effectiveMode === 'ambient') {
      state.wrapper.dataset.ubbMode = effectiveMode;
    } else if (state.ambient) {
      releaseAmbient();
    }

    state.video.style.objectFit =
      effectiveMode === 'crop'
        ? 'cover'
        : state.video.dataset.ubbOriginalObjectFit || '';

    if (effectiveMode === 'ambient') {
      playAmbientVideos();
    }

    if (showFeedback) {
      let suffix = '';
      if (state.requestedMode === 'ambient' && !state.ambientSupported) {
        suffix = ' (not supported here)';
      } else if (effectiveMode !== state.requestedMode) {
        suffix = ' (ultrawide only)';
      }

      showToast(`${MODE_LABELS[state.requestedMode]}${suffix}`);
    }
  }

  function isRelevantNode(node) {
    if (!(node instanceof Element)) {
      return false;
    }

    const selector = 'video, .bpx-player-video-area, .bpx-player-video-wrap, .bilibili-player-video-wrap, .bilibili-player-video';
    return node.matches(selector) || Boolean(node.querySelector(selector));
  }

  function hasRelevantMutation(mutations) {
    if (state.video && !document.contains(state.video)) {
      return true;
    }

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (isRelevantNode(node)) {
          return true;
        }
      }

      for (const node of mutation.removedNodes) {
        if (isRelevantNode(node)) {
          return true;
        }
      }
    }

    return false;
  }

  function scheduleSync(showFeedback = false) {
    state.pendingFeedback = state.pendingFeedback || showFeedback;

    if (state.syncScheduled) {
      return;
    }

    state.syncScheduled = true;
    window.requestAnimationFrame(() => {
      state.syncScheduled = false;
      const feedback = state.pendingFeedback;
      state.pendingFeedback = false;
      applyMode(feedback);
    });
  }

  function init() {
    ensureStyles();

    chrome.storage.local.get({ [STORAGE_KEY]: MODES[0] }, (items) => {
      state.requestedMode = normalizeMode(items[STORAGE_KEY]);
      scheduleSync(false);
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') {
        return;
      }

      if (changes[STORAGE_KEY]) {
        state.requestedMode = normalizeMode(changes[STORAGE_KEY].newValue);
        scheduleSync(false);
      }

      if (changes[FEEDBACK_KEY]) {
        scheduleSync(true);
      }
    });

    const observer = new MutationObserver((mutations) => {
      if (hasRelevantMutation(mutations)) {
        scheduleSync(false);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener('resize', () => scheduleSync(false));
    document.addEventListener('fullscreenchange', () => scheduleSync(false));
  }

  init();
})();
