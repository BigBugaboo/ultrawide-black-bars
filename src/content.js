(function () {
  var layout = globalThis.UbbLayout;
  var settingsApi = globalThis.UbbSettings;
  var sitesApi = globalThis.UbbSites;
  var i18n = globalThis.UbbI18n;

  var mode = "ambient";
  var locale = "en";
  var ambientBlur = "medium";
  var hiddenModes = [];
  var sharpen = false;
  var reducedMotion = false;
  var zoom = 1;
  var panX = 0;
  var panY = 0;
  var siteMemory = {};
  var pageMemory = {};
  var area = null;
  var video = null;
  var site = null;
  var leftBar = null;
  var rightBar = null;
  var topBar = null;
  var bottomBar = null;
  var leftCanvas = null;
  var rightCanvas = null;
  var topCanvas = null;
  var bottomCanvas = null;
  var sampleCanvas = document.createElement("canvas");
  var detectCanvas = document.createElement("canvas");
  var toast = null;
  var toastTimer = 0;
  var resizeObserver = null;
  var observedArea = null;
  var scaleTargets = [];
  var frameHandle = 0;
  var frameDriver = "";
  var frameVideo = null;
  var loopToken = 0;
  var loopArmed = false;
  var saveTimer = 0;
  var drag = null;
  var barCache = { video: null, at: 0, value: null };
  var SAMPLE_W = 96;
  var SAMPLE_H = 54;
  var EDGE_W = 32;

  function storageGetAll() {
    return new Promise(function (resolve) {
      var storage = globalThis.chrome && chrome.storage && chrome.storage.local;
      if (!storage) {
        resolve(settingsApi.normalizeSettings(null));
        return;
      }
      storage.get(null, function (items) {
        resolve(settingsApi.normalizeSettings(items));
      });
    });
  }

  function hostKey() {
    return settingsApi.siteMemoryKey(location.hostname);
  }

  function pageKey() {
    return settingsApi.pageMemoryKey(location.href);
  }

  function applyStored(next) {
    locale = next.locale;
    ambientBlur = next.ambientBlur;
    hiddenModes = next.hiddenModes || [];
    sharpen = !!next.sharpen;
    reducedMotion = !!next.reducedMotion;
    siteMemory = next.siteMemory || {};
    pageMemory = next.pageMemory || {};
    var sitePref = siteMemory[hostKey()];
    var pagePref = pageMemory[pageKey()];
    mode = sitePref && sitePref.mode ? sitePref.mode : next.mode;
    if (hiddenModes.indexOf(mode) >= 0) mode = layout.nextMode(mode, hiddenModes);
    var zoomSrc = pagePref || sitePref || {};
    zoom = settingsApi.normalizeZoom(zoomSrc.zoom);
    panX = settingsApi.normalizePan(zoomSrc.panX);
    panY = settingsApi.normalizePan(zoomSrc.panY);
    if (next.dropEnabled) {
      var storage = globalThis.chrome && chrome.storage && chrome.storage.local;
      if (storage) {
        storage.set({ mode: "original" });
        storage.remove("enabled");
      }
    }
  }

  function scheduleSave() {
    var snapshot = {
      mode: mode,
      zoom: zoom,
      panX: panX,
      panY: panY,
      host: hostKey(),
      page: pageKey(),
    };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      flushSave(snapshot);
    }, 180);
  }

  function trimMemory(map, max) {
    var keys = Object.keys(map);
    while (keys.length > max) delete map[keys.shift()];
    return map;
  }

  function flushSave(snapshot) {
    var storage = globalThis.chrome && chrome.storage && chrome.storage.local;
    if (!storage || !snapshot.host) return;
    storage.get(["siteMemory", "pageMemory"], function (items) {
      var sites = Object.assign({}, (items && items.siteMemory) || {});
      var pages = Object.assign({}, (items && items.pageMemory) || {});
      sites[snapshot.host] = Object.assign({}, sites[snapshot.host] || {}, {
        mode: snapshot.mode,
        zoom: snapshot.zoom,
        panX: snapshot.panX,
        panY: snapshot.panY,
      });
      if (snapshot.page) pages[snapshot.page] = { zoom: snapshot.zoom, panX: snapshot.panX, panY: snapshot.panY };
      trimMemory(sites, 40);
      trimMemory(pages, 40);
      siteMemory = sites;
      pageMemory = pages;
      storage.set({ siteMemory: sites, pageMemory: pages });
    });
  }

  function ensureSharpenFilter() {
    if (document.getElementById("ubb-ext-sharpen-svg")) return;
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "ubb-ext-sharpen-svg";
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    var filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.id = "ubb-ext-sharpen";
    var matrix = document.createElementNS("http://www.w3.org/2000/svg", "feConvolveMatrix");
    matrix.setAttribute("order", "3");
    matrix.setAttribute("preserveAlpha", "true");
    matrix.setAttribute("kernelMatrix", "0 -0.2 0 -0.2 1.8 -0.2 0 -0.2 0");
    filter.appendChild(matrix);
    svg.appendChild(filter);
    document.documentElement.appendChild(svg);
  }

  function ensureNodes() {
    if (!area) return;
    if (!leftBar || !area.contains(leftBar)) {
      leftBar = document.createElement("div");
      rightBar = document.createElement("div");
      topBar = document.createElement("div");
      bottomBar = document.createElement("div");
      leftBar.className = "ubb-bar ubb-bar-left";
      rightBar.className = "ubb-bar ubb-bar-right";
      topBar.className = "ubb-bar ubb-bar-top";
      bottomBar.className = "ubb-bar ubb-bar-bottom";
      leftCanvas = document.createElement("canvas");
      rightCanvas = document.createElement("canvas");
      topCanvas = document.createElement("canvas");
      bottomCanvas = document.createElement("canvas");
      leftBar.appendChild(leftCanvas);
      rightBar.appendChild(rightCanvas);
      topBar.appendChild(topCanvas);
      bottomBar.appendChild(bottomCanvas);
      area.appendChild(leftBar);
      area.appendChild(rightBar);
      area.appendChild(topBar);
      area.appendChild(bottomBar);
    }
    if (!toast || !area.contains(toast)) {
      toast = document.createElement("div");
      toast.className = "ubb-toast";
      area.appendChild(toast);
    }
    var still = reducedMotion;
    try {
      still = still || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (err) {}
    toast.classList.toggle("ubb-still", !!still);
  }

  function showToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("ubb-toast-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("ubb-toast-on");
    }, 1400);
  }

  function clearScaleTargets() {
    for (var i = 0; i < scaleTargets.length; i++) scaleTargets[i].classList.remove("ubb-scale-target");
    scaleTargets = [];
  }

  function clearEffects() {
    if (!area) return;
    area.classList.remove("ubb-crop", "ubb-ambient", "ubb-stretch", "ubb-zoom");
    area.style.removeProperty("--ubb-scale");
    area.style.removeProperty("--ubb-scale-x");
    area.style.removeProperty("--ubb-scale-y");
    area.style.removeProperty("--ubb-pan-x");
    area.style.removeProperty("--ubb-pan-y");
    area.style.removeProperty("--ubb-blur");
    clearScaleTargets();
    if (video) video.classList.remove("ubb-sharpen");
  }

  function releaseArea(prev) {
    if (!prev) return;
    prev.classList.remove("ubb-player", "ubb-generic", "ubb-crop", "ubb-ambient", "ubb-stretch", "ubb-zoom");
    if (prev.dataset.ubbStatic === "1") {
      prev.style.position = "";
      delete prev.dataset.ubbStatic;
    }
    var nodes = prev.querySelectorAll(".ubb-bar, .ubb-toast");
    for (var i = 0; i < nodes.length; i++) nodes[i].remove();
  }

  function rectOf(videoEl) {
    return layout.pictureRect(videoEl.clientWidth, videoEl.clientHeight, videoEl.videoWidth, videoEl.videoHeight);
  }

  function placeBars(rect) {
    var boxW = video.clientWidth;
    var boxH = video.clientHeight;
    leftBar.style.width = Math.max(0, rect.x) + "px";
    rightBar.style.width = Math.max(0, boxW - rect.x - rect.width) + "px";
    topBar.style.height = Math.max(0, rect.y) + "px";
    bottomBar.style.height = Math.max(0, boxH - rect.y - rect.height) + "px";
  }

  function fillCanvas(canvas) {
    var ctx = canvas.getContext("2d", { willReadFrequently: false });
    ctx.fillStyle = "#141414";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function blitEdge(canvas, edge) {
    var horizontal = edge === "top" || edge === "bottom";
    var dw = horizontal ? SAMPLE_W : EDGE_W;
    var dh = horizontal ? EDGE_W : SAMPLE_H;
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }
    var sx = edge === "right" ? SAMPLE_W - EDGE_W : 0;
    var sy = edge === "bottom" ? SAMPLE_H - EDGE_W : 0;
    var sw = horizontal ? SAMPLE_W : EDGE_W;
    var sh = horizontal ? EDGE_W : SAMPLE_H;
    var ctx = canvas.getContext("2d", { willReadFrequently: false });
    ctx.drawImage(sampleCanvas, sx, sy, sw, sh, 0, 0, dw, dh);
  }

  function probeBars(videoEl) {
    if (!videoEl || videoEl.readyState < 2 || !(videoEl.videoWidth > 0)) {
      return { pending: true, failed: false, bars: null };
    }
    if (barCache.video === videoEl && barCache.value && (barCache.value.failed || Date.now() - barCache.at < 1200)) {
      return barCache.value;
    }
    if (detectCanvas.width !== SAMPLE_W || detectCanvas.height !== SAMPLE_H) {
      detectCanvas.width = SAMPLE_W;
      detectCanvas.height = SAMPLE_H;
    }
    var ctx = detectCanvas.getContext("2d", { willReadFrequently: true });
    var value;
    try {
      ctx.drawImage(videoEl, 0, 0, SAMPLE_W, SAMPLE_H);
      var data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
      var rows = new Array(SAMPLE_H);
      for (var y = 0; y < SAMPLE_H; y++) {
        var row = new Array(SAMPLE_W * 3);
        var off = y * SAMPLE_W * 4;
        for (var x = 0; x < SAMPLE_W; x++) {
          row[x * 3] = data[off + x * 4];
          row[x * 3 + 1] = data[off + x * 4 + 1];
          row[x * 3 + 2] = data[off + x * 4 + 2];
        }
        rows[y] = row;
      }
      value = { pending: false, failed: false, bars: layout.detectBlackBars(rows) };
    } catch (err) {
      value = { pending: false, failed: true, bars: null };
    }
    barCache = { video: videoEl, at: Date.now(), value: value };
    return value;
  }

  function paintAmbientFrame() {
    if (mode !== "ambient" || !video || !area || video.readyState < 2) return;
    var rect = rectOf(video);
    if (!rect || (!rect.sideBars && !rect.letterBars)) {
      clearEffects();
      return;
    }
    ensureNodes();
    area.classList.add("ubb-player", "ubb-ambient");
    area.classList.remove("ubb-crop", "ubb-stretch", "ubb-zoom");
    area.style.removeProperty("--ubb-scale");
    area.style.setProperty("--ubb-blur", settingsApi.blurRadius(ambientBlur) + "px");
    clearScaleTargets();
    placeBars(rect);
    if (sampleCanvas.width !== SAMPLE_W || sampleCanvas.height !== SAMPLE_H) {
      sampleCanvas.width = SAMPLE_W;
      sampleCanvas.height = SAMPLE_H;
    }
    var sctx = sampleCanvas.getContext("2d", { willReadFrequently: false });
    try {
      sctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
      blitEdge(leftCanvas, "left");
      blitEdge(rightCanvas, "right");
      blitEdge(topCanvas, "top");
      blitEdge(bottomCanvas, "bottom");
    } catch (err) {
      fillCanvas(leftCanvas);
      fillCanvas(rightCanvas);
      fillCanvas(topCanvas);
      fillCanvas(bottomCanvas);
    }
  }

  function loopState() {
    var rect = video ? rectOf(video) : null;
    return {
      mode: mode,
      playing: !!(video && !video.paused && !video.ended),
      sideBars: !!(rect && (rect.sideBars || rect.letterBars)),
    };
  }

  function stopAmbientLoop() {
    loopToken += 1;
    loopArmed = false;
    if (frameVideo && frameHandle && frameDriver === "video-frame" && frameVideo.cancelVideoFrameCallback) {
      try {
        frameVideo.cancelVideoFrameCallback(frameHandle);
      } catch (err) {}
    }
    if (frameDriver === "animation-frame" && frameHandle) cancelAnimationFrame(frameHandle);
    frameHandle = 0;
    frameVideo = null;
    frameDriver = "";
  }

  function armAmbientLoop() {
    if (loopArmed || !video) return;
    if (!layout.shouldRunAmbientLoop(loopState())) return;
    var driver = layout.ambientSampleDriver(typeof video.requestVideoFrameCallback === "function");
    var token = loopToken;
    frameDriver = driver;
    frameVideo = video;
    loopArmed = true;
    function onFrame() {
      loopArmed = false;
      frameHandle = 0;
      if (token !== loopToken) return;
      paintAmbientFrame();
      armAmbientLoop();
    }
    if (driver === "video-frame") {
      frameHandle = video.requestVideoFrameCallback(onFrame);
    } else {
      frameHandle = requestAnimationFrame(onFrame);
    }
  }

  function syncAmbient() {
    if (!layout.shouldRunAmbientLoop(loopState())) {
      stopAmbientLoop();
      if (mode === "ambient") paintAmbientFrame();
      return;
    }
    paintAmbientFrame();
    armAmbientLoop();
  }

  function onPlayback() {
    syncAmbient();
  }

  function onSeeked() {
    barCache = { video: null, at: 0, value: null };
    onPlayback();
  }

  function bindVideo(next) {
    if (video === next) return;
    if (video) {
      video.removeEventListener("play", onPlayback);
      video.removeEventListener("pause", onPlayback);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("ended", onPlayback);
      video.removeEventListener("emptied", onPlayback);
      video.removeEventListener("loadeddata", onPlayback);
      video.classList.remove("ubb-sharpen");
    }
    stopAmbientLoop();
    video = next;
    barCache = { video: null, at: 0, value: null };
    if (!video) return;
    video.addEventListener("play", onPlayback);
    video.addEventListener("pause", onPlayback);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("ended", onPlayback);
    video.addEventListener("emptied", onPlayback);
    video.addEventListener("loadeddata", onPlayback);
  }

  function modeLabel(next) {
    if (next === "original") return i18n.translate(locale, "modeOriginal");
    if (next === "crop") return i18n.translate(locale, "modeCrop");
    if (next === "stretch") return i18n.translate(locale, "modeStretch");
    return i18n.translate(locale, "modeAmbient");
  }

  function setTransform(scales) {
    area.style.setProperty("--ubb-scale", String(scales.x));
    area.style.setProperty("--ubb-scale-x", String(scales.x));
    area.style.setProperty("--ubb-scale-y", String(scales.y));
    area.style.setProperty("--ubb-pan-x", panX + "px");
    area.style.setProperty("--ubb-pan-y", panY + "px");
  }

  function markTargets() {
    clearScaleTargets();
    scaleTargets = site.scaleTargets(area);
    for (var i = 0; i < scaleTargets.length; i++) scaleTargets[i].classList.add("ubb-scale-target");
  }

  function applySharpen() {
    if (!video) return;
    if (sharpen) {
      ensureSharpenFilter();
      video.classList.add("ubb-sharpen");
    } else {
      video.classList.remove("ubb-sharpen");
    }
  }

  function eventOnPicture(event) {
    if (!video) return false;
    var node = event.target;
    if (node && node.closest && node.closest("button, a, input, textarea, select, [role='slider']")) return false;
    var rect = video.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  function dragAllowed() {
    return mode === "crop" || zoom > 1.001;
  }

  function onWheel(event) {
    if (event.currentTarget !== area || !eventOnPicture(event)) return;
    event.preventDefault();
    var factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    zoom = settingsApi.normalizeZoom(zoom * factor);
    scheduleSave();
    apply();
  }

  function onPointerDown(event) {
    if (event.currentTarget !== area || event.button !== 0) return;
    if (!dragAllowed() || !eventOnPicture(event)) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: panX, panY: panY, moved: false };
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    var dx = event.clientX - drag.x;
    var dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (dx * dx + dy * dy < 16) return;
      drag.moved = true;
      if (area.setPointerCapture) {
        try {
          area.setPointerCapture(event.pointerId);
        } catch (err) {}
      }
    }
    panX = settingsApi.normalizePan(drag.panX + dx);
    panY = settingsApi.normalizePan(drag.panY + dy);
    apply();
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.id) return;
    var moved = drag.moved;
    drag = null;
    if (moved) scheduleSave();
  }

  function onContextMenu(event) {
    if (event.currentTarget !== area || !eventOnPicture(event)) return;
    cycle();
  }

  function bindGestures(node) {
    if (!node || node.dataset.ubbGestures === "1") return;
    node.dataset.ubbGestures = "1";
    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerup", onPointerUp);
    node.addEventListener("pointercancel", onPointerUp);
    node.addEventListener("contextmenu", onContextMenu);
  }

  function apply() {
    site = sitesApi.resolve(location);
    if (!site) return;
    var nextArea = site.findArea(document);
    var nextVideo = nextArea ? site.findVideo(nextArea) : null;
    if (!nextArea || !nextVideo) return;
    if (area && nextArea !== area) {
      releaseArea(area);
      leftBar = null;
      toast = null;
    }
    area = nextArea;
    area.classList.add("ubb-player");
    if (site.id === "generic") {
      area.classList.add("ubb-generic");
      try {
        if (getComputedStyle(area).position === "static") {
          area.dataset.ubbStatic = "1";
          area.style.position = "relative";
        }
      } catch (err) {}
    }
    bindVideo(nextVideo);
    bindGestures(area);
    ensureNodes();
    applySharpen();
    if (observedArea !== area) {
      if (resizeObserver) resizeObserver.disconnect();
      observedArea = area;
      resizeObserver = new ResizeObserver(function () {
        apply();
      });
      resizeObserver.observe(area);
    }

    var rect = rectOf(video);
    if (!rect) {
      stopAmbientLoop();
      clearEffects();
      return;
    }
    var probe = probeBars(video);
    var plan = layout.visualPlan({
      rect: rect,
      mode: mode,
      zoom: zoom,
      panX: panX,
      panY: panY,
      bars: probe.failed ? null : probe.bars,
      detectionFailed: probe.failed,
    });
    if (plan.kind === "none") {
      stopAmbientLoop();
      clearEffects();
      applySharpen();
      return;
    }
    if (plan.kind === "ambient") {
      syncAmbient();
      applySharpen();
      return;
    }
    stopAmbientLoop();
    area.classList.add("ubb-player", plan.kind === "stretch" ? "ubb-stretch" : plan.kind === "zoom" ? "ubb-zoom" : "ubb-crop");
    area.classList.remove("ubb-ambient");
    if (plan.kind !== "stretch") area.classList.remove("ubb-stretch");
    if (plan.kind !== "zoom") area.classList.remove("ubb-zoom");
    if (plan.kind !== "crop") area.classList.remove("ubb-crop");
    area.classList.add(plan.kind === "stretch" ? "ubb-stretch" : plan.kind === "zoom" ? "ubb-zoom" : "ubb-crop");
    area.style.removeProperty("--ubb-blur");
    setTransform(plan.scales);
    markTargets();
    applySharpen();
  }

  function setMode(next, announce) {
    mode = settingsApi.normalizeSettings({ mode: next }).mode;
    if (hiddenModes.indexOf(mode) >= 0) mode = layout.nextMode(mode, hiddenModes);
    var host = hostKey();
    if (host) {
      siteMemory[host] = Object.assign({}, siteMemory[host] || {}, {
        mode: mode,
        zoom: zoom,
        panX: panX,
        panY: panY,
      });
    }
    scheduleSave();
    apply();
    if (announce) showToast("Ultrawide Black Bars · " + modeLabel(mode));
  }

  function cycle() {
    setMode(layout.nextMode(mode, hiddenModes), true);
  }

  storageGetAll().then(function (saved) {
    applyStored(saved);
    apply();
  });

  document.addEventListener(
    "keydown",
    function (event) {
      if (event.altKey && event.shiftKey && event.code === "KeyU") {
        event.preventDefault();
        event.stopPropagation();
        cycle();
      }
    },
    true
  );

  document.addEventListener("yt-navigate-finish", function () {
    barCache = { video: null, at: 0, value: null };
    apply();
  });

  if (globalThis.chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
      if (!message) return;
      if (message.type === "cycle-mode") cycle();
      if (message.type === "set-mode") setMode(message.mode, true);
      if (message.type === "get-mode") sendResponse({ mode: mode });
    });
  }

  if (globalThis.chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, areaName) {
      if (areaName !== "local") return;
      var watch = ["mode", "enabled", "locale", "ambientBlur", "siteMemory", "pageMemory", "hiddenModes", "sharpen", "reducedMotion"];
      var relevant = false;
      for (var i = 0; i < watch.length; i++) if (changes[watch[i]]) relevant = true;
      if (!relevant) return;
      storageGetAll().then(function (saved) {
        applyStored(saved);
        apply();
      });
    });
  }

  setInterval(apply, 1000);

  document.addEventListener("fullscreenchange", function () {
    setTimeout(apply, 50);
  });

  globalThis.__ubb = { setMode: setMode, cycle: cycle, apply: apply };
})();
