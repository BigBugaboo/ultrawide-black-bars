(function () {
  var layout = globalThis.UbbLayout;
  var settingsApi = globalThis.UbbSettings;
  var sitesApi = globalThis.UbbSites;
  var i18n = globalThis.UbbI18n;

  var mode = "ambient";
  var locale = "en";
  var ambientBlur = "medium";
  var musicStyle = "bars";
  var barColor = "#ffd60a";
  var barPalette = "solid";
  var rainbowPhase = 0;
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
    musicStyle = next.musicStyle || "bars";
    barColor = next.barColor || "#ffd60a";
    barPalette = next.barPalette === "rainbow" || next.barPalette === "classic" || next.barPalette === "flow" ? next.barPalette : "solid";
    hiddenModes = next.hiddenModes || [];
    sharpen = !!next.sharpen;
    reducedMotion = !!next.reducedMotion;
    siteMemory = next.sitePrefs || next.siteMemory || {};
    pageMemory = next.pageMemory || {};
    var sitePref = siteMemory[hostKey()];
    var pagePref = pageMemory[pageKey()];
    mode = sitePref && sitePref.mode ? settingsApi.normalizeSettings({ mode: sitePref.mode }).mode : next.mode;
    if (hiddenModes.indexOf(mode) >= 0) mode = layout.nextMode(mode, hiddenModes);
    var zoomSrc = pagePref || sitePref || {};
    zoom = settingsApi.normalizeZoom(zoomSrc.userScale != null ? zoomSrc.userScale : zoomSrc.zoom);
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
    storage.get(["sitePrefs", "pageMemory"], function (items) {
      var sites = Object.assign({}, (items && items.sitePrefs) || {});
      var pages = Object.assign({}, (items && items.pageMemory) || {});
      sites[snapshot.host] = Object.assign({}, sites[snapshot.host] || {}, {
        mode: snapshot.mode,
        userScale: snapshot.zoom,
        panX: snapshot.panX,
        panY: snapshot.panY,
      });
      if (snapshot.page) pages[snapshot.page] = { zoom: snapshot.zoom, panX: snapshot.panX, panY: snapshot.panY };
      trimMemory(sites, 40);
      trimMemory(pages, 40);
      siteMemory = sites;
      pageMemory = pages;
      storage.set({ sitePrefs: sites, pageMemory: pages });
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

  var sideChrome = "";

  function useSideChrome(kind) {
    var key = kind === "ambient" ? "ambient:" + ambientBlur : "music";
    if (sideChrome === key) return;
    sideChrome = key;
    ensureNodes();
    area.classList.add("ubb-player", kind === "music" ? "ubb-music" : "ubb-ambient");
    area.classList.remove("ubb-crop", "ubb-zoom");
    if (kind === "music") area.classList.remove("ubb-ambient");
    else area.classList.remove("ubb-music");
    area.style.removeProperty("--ubb-scale");
    area.style.removeProperty("--ubb-blur");
    if (kind === "ambient") area.style.setProperty("--ubb-blur", settingsApi.blurRadius(ambientBlur) + "px");
    clearScaleTargets();
  }

  function clearEffects() {
    if (!area) return;
    sideChrome = "";
    area.classList.remove("ubb-crop", "ubb-ambient", "ubb-music", "ubb-zoom");
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
    prev.classList.remove("ubb-player", "ubb-generic", "ubb-crop", "ubb-ambient", "ubb-music", "ubb-zoom");
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
      value = { pending: false, failed: false, bars: layout.detectBlackBars(data, SAMPLE_W, SAMPLE_H) };
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
    useSideChrome("ambient");
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

  var musicAudio = null;
  var musicFor = null;
  var musicLeft = [];
  var musicRight = [];
  var dropLeft = [];
  var dropRight = [];
  var lastDropLeft = 0;
  var lastDropRight = 0;
  var breathLeft = null;
  var breathRight = null;
  var BREATH_HUES = [52, 78, 28, 18, 330, 300, 145];

  function resumeMusic() {
    if (!musicAudio || !musicAudio.ctx) return;
    if (musicAudio.ctx.state === "suspended") {
      musicAudio.ctx.resume().catch(function () {});
    }
  }

  function attachMusic(videoEl) {
    if (musicFor === videoEl && musicAudio) return musicAudio;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      musicFor = videoEl;
      musicAudio = { ok: false };
      return musicAudio;
    }
    try {
      var ctx = new AC();
      var source = ctx.createMediaElementSource(videoEl);
      var splitter = ctx.createChannelSplitter(2);
      var left = ctx.createAnalyser();
      var right = ctx.createAnalyser();
      left.fftSize = 256;
      right.fftSize = 256;
      left.smoothingTimeConstant = 0.12;
      right.smoothingTimeConstant = 0.12;
      source.connect(splitter);
      splitter.connect(left, 0);
      splitter.connect(right, 1);
      source.connect(ctx.destination);
      musicFor = videoEl;
      musicAudio = { ok: true, ctx: ctx, left: left, right: right };
      resumeMusic();
      return musicAudio;
    } catch (err) {
      musicFor = videoEl;
      musicAudio = { ok: false };
      return musicAudio;
    }
  }

  function readBands(analyser) {
    if (!analyser) return layout.musicBands(null, 8);
    var data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    return layout.musicBands(data, 8);
  }

  function readEnergy(analyser) {
    if (!analyser) return 0;
    var data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    var sum = 0;
    for (var i = 0; i < data.length; i++) {
      var v = (data[i] - 128) / 128;
      sum += v * v;
    }
    var rms = Math.sqrt(sum / data.length);
    var energy = (rms - 0.015) / 0.12;
    if (energy < 0) energy = 0;
    if (energy > 1) energy = 1;
    return energy;
  }

  function followBands(prev, next) {
    var out = [];
    for (var i = 0; i < next.length; i++) {
      var from = prev[i] || 0;
      out.push(from + (next[i] - from) * 0.42);
    }
    return out;
  }

  function roundBar(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function hslRgb(hue, s, l) {
    var h = ((hue % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var hp = h / 60;
    var x = c * (1 - Math.abs((hp % 2) - 1));
    var r = 0;
    var g = 0;
    var b = 0;
    if (hp < 1) { r = c; g = x; }
    else if (hp < 2) { r = x; g = c; }
    else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; }
    else if (hp < 5) { r = x; b = c; }
    else { r = c; b = x; }
    var m = l - c / 2;
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    };
  }

  function pastelRgb(hue) {
    return hslRgb(hue, 0.45, 0.78);
  }

  function barRgb(hex) {
    var match = /^#([0-9a-f]{6})$/i.exec(hex || "");
    var n = match ? parseInt(match[1], 16) : 0xffd60a;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function mixWhite(channel, amount) {
    return Math.round(channel + (255 - channel) * amount);
  }

  function rgba(rgb, white, alpha) {
    return "rgba(" + mixWhite(rgb.r, white) + "," + mixWhite(rgb.g, white) + "," + mixWhite(rgb.b, white) + "," + alpha + ")";
  }

  function barTone(index, count) {
    var hue = (index / count) * 360;
    if (barPalette === "flow") {
      hue = (rainbowPhase + hue) % 360;
      return { bottom: hslRgb(hue, 0.95, 0.55), mid: hslRgb((hue + 36) % 360, 0.95, 0.58), top: hslRgb((hue + 70) % 360, 0.9, 0.62) };
    }
    if (barPalette === "classic") {
      var vivid = hslRgb(hue, 0.92, 0.52);
      return { bottom: vivid, mid: vivid, top: vivid };
    }
    if (barPalette === "rainbow") {
      var soft = pastelRgb(hue);
      return { bottom: soft, mid: soft, top: soft };
    }
    var solid = barRgb(barColor);
    return { bottom: solid, mid: solid, top: solid };
  }

  function drawChannel(canvas, levels, width, height, reverse) {
    var w = width > 4 ? width : canvas.clientWidth || 48;
    var h = height > 4 ? height : canvas.clientHeight || 180;
    if (w < 4 || h < 4) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pw = Math.max(1, Math.floor(w * dpr));
    var ph = Math.max(1, Math.floor(h * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (barPalette === "flow") rainbowPhase = (rainbowPhase + 1.8) % 360;
    var n = levels && levels.length ? levels.length : 8;
    var colW = w / n;
    for (var i = 0; i < n; i++) {
      var index = reverse ? n - 1 - i : i;
      var amp = levels && levels[index] ? levels[index] : 0;
      var lit = Math.max(h * 0.06, Math.min(h * 0.96, amp * h * 0.92));
      var x = i * colW;
      var y = h - lit;
      var tone = barTone(i, n);
      var glow = ctx.createLinearGradient(0, h, 0, y);
      glow.addColorStop(0, rgba(tone.bottom, 0.35, 0.92));
      glow.addColorStop(0.45, rgba(tone.mid, 0, 0.7));
      glow.addColorStop(1, rgba(tone.top, 0, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(x, y, colW + 0.5, lit);
    }
  }

  function channelEnergy(levels) {
    if (!levels || !levels.length) return 0;
    var sum = 0;
    for (var i = 0; i < levels.length; i++) sum += levels[i] || 0;
    return sum / levels.length;
  }

  function sizeCanvas(canvas, width, height) {
    var w = width > 4 ? width : canvas.clientWidth || 48;
    var h = height > 4 ? height : canvas.clientHeight || 180;
    if (w < 4 || h < 4) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pw = Math.max(1, Math.floor(w * dpr));
    var ph = Math.max(1, Math.floor(h * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function spawnDrops(list, energy, previous) {
    var now = Date.now();
    var hit = energy > 0.2 && energy > previous + 0.12;
    if (hit && list.length < 4) {
      var count = 1;
      for (var i = 0; i < count; i++) {
        list.push({
          x: 0.12 + Math.random() * 0.76,
          y: 0.08 + Math.random() * 0.84,
          born: now,
          hue: Math.floor(Math.random() * 360),
        });
      }
    }
    var kept = [];
    for (var j = 0; j < list.length; j++) {
      if (now - list[j].born < 1100) kept.push(list[j]);
    }
    return kept;
  }

  function drawDrops(canvas, list, width, height) {
    var box = sizeCanvas(canvas, width, height);
    if (!box) return;
    var now = Date.now();
    for (var i = 0; i < list.length; i++) {
      var drop = list[i];
      var age = (now - drop.born) / 1100;
      if (age < 0 || age > 1) continue;
      var radius = 6 + age * Math.min(box.w, box.h) * 0.7;
      box.ctx.beginPath();
      box.ctx.arc(drop.x * box.w, drop.y * box.h, radius, 0, Math.PI * 2);
      box.ctx.fillStyle = "hsla(" + drop.hue + ", 90%, 60%, " + (1 - age) * 0.45 + ")";
      box.ctx.fill();
    }
  }

  function makeWash() {
    var blobs = [];
    for (var i = 0; i < 4; i++) {
      blobs.push({
        x: Math.random(),
        y: Math.random(),
        hue: BREATH_HUES[i % BREATH_HUES.length],
        tx: Math.random(),
        ty: Math.random(),
        thue: BREATH_HUES[i % BREATH_HUES.length],
        next: 0,
      });
    }
    return { blobs: blobs, last: 0 };
  }

  function pitchOf(levels) {
    if (!levels || !levels.length) return 0.2;
    var weight = 0;
    var sum = 0;
    for (var i = 0; i < levels.length; i++) {
      var v = levels[i] || 0;
      weight += v;
      sum += v * (i + 0.5);
    }
    if (weight < 0.04) return 0.2;
    return sum / weight / levels.length;
  }

  function hueFromPitch(pitch) {
    var t = (pitch - 0.15) / 0.38;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return 255 + (12 - 255) * t;
  }

  function stepWash(wash, energy) {
    var now = Date.now();
    var dt = wash.last ? Math.min(0.08, (now - wash.last) / 1000) : 0.016;
    wash.last = now;
    var speed = 0.35 + energy * 3.4;
    var interval = energy > 0.55 ? 260 : energy > 0.22 ? 720 : 1900;
    for (var i = 0; i < wash.blobs.length; i++) {
      var blob = wash.blobs[i];
      if (now >= blob.next) {
        blob.tx = Math.random();
        blob.ty = Math.random();
        blob.thue = BREATH_HUES[Math.floor(Math.random() * BREATH_HUES.length)] + (Math.random() * 20 - 10);
        blob.next = now + interval * (0.55 + Math.random());
      }
      var k = Math.min(1, dt * speed);
      blob.x += (blob.tx - blob.x) * k;
      blob.y += (blob.ty - blob.y) * k;
      var dh = blob.thue - blob.hue;
      if (dh > 180) dh -= 360;
      if (dh < -180) dh += 360;
      blob.hue += dh * k;
    }
  }

  function drawBreath(canvas, wash, levels, energy, width, height) {
    var box = sizeCanvas(canvas, Math.min(width, 72), Math.min(height, 160));
    if (!box || !wash) return;
    stepWash(wash, energy);
    var base = wash.blobs[0];
    box.ctx.fillStyle = "hsl(" + base.hue + ", 92%, 54%)";
    box.ctx.fillRect(0, 0, box.w, box.h);
    for (var i = 0; i < wash.blobs.length; i++) {
      var blob = wash.blobs[i];
      var cx = blob.x * box.w;
      var cy = blob.y * box.h;
      var radius = Math.max(box.w, box.h) * (0.85 + energy * 0.45);
      var grad = box.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, "hsla(" + blob.hue + ", 96%, 64%, 0.92)");
      grad.addColorStop(0.42, "hsla(" + (blob.hue + 16) + ", 92%, 56%, 0.5)");
      grad.addColorStop(1, "hsla(" + blob.hue + ", 88%, 50%, 0)");
      box.ctx.fillStyle = grad;
      box.ctx.fillRect(0, 0, box.w, box.h);
    }
  }

  function paintMusicFrame() {
    if (mode !== "music" || !video || !area || video.readyState < 2) return;
    var rect = rectOf(video);
    if (!rect || (!rect.sideBars && !rect.letterBars)) {
      clearEffects();
      return;
    }
    useSideChrome("music");
    placeBars(rect);
    var sideH = video.clientHeight || rect.boxH || rect.height;
    var leftW = Math.max(rect.x || 0, 8);
    var rightW = Math.max((rect.boxW || video.clientWidth || 0) - (rect.x || 0) - (rect.width || 0), 8);
    var audio = attachMusic(video);
    resumeMusic();
    var left = audio && audio.ok ? readBands(audio.left) : layout.musicBands(null, 8);
    var right = audio && audio.ok ? readBands(audio.right) : left;
    musicLeft = followBands(musicLeft, left);
    musicRight = followBands(musicRight, right);
    if (musicStyle === "drops") {
      var leftEnergy = audio && audio.ok ? readEnergy(audio.left) : channelEnergy(musicLeft);
      var rightEnergy = audio && audio.ok ? readEnergy(audio.right) : leftEnergy;
      dropLeft = spawnDrops(dropLeft, leftEnergy, lastDropLeft);
      dropRight = spawnDrops(dropRight, rightEnergy, lastDropRight);
      lastDropLeft = leftEnergy;
      lastDropRight = rightEnergy;
      drawDrops(leftCanvas, dropLeft, leftW, sideH);
      drawDrops(rightCanvas, dropRight, rightW, sideH);
      return;
    }
    if (musicStyle === "breath") {
      if (!breathLeft) breathLeft = makeWash();
      if (!breathRight) breathRight = makeWash();
      drawBreath(leftCanvas, breathLeft, left, audio && audio.ok ? readEnergy(audio.left) : 0, leftW, sideH);
      drawBreath(rightCanvas, breathRight, right, audio && audio.ok ? readEnergy(audio.right) : 0, rightW, sideH);
      return;
    }
    drawChannel(leftCanvas, musicLeft, leftW, sideH, false);
    drawChannel(rightCanvas, musicRight, rightW, sideH, true);
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
      if (mode === "music") paintMusicFrame();
      else paintAmbientFrame();
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
      if (mode === "music") paintMusicFrame();
      return;
    }
    if (mode === "music") paintMusicFrame();
    else paintAmbientFrame();
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
    if (next === "music") return i18n.translate(locale, "modeMusic");
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

    if (site.id === "youtube" && location.pathname.indexOf("/shorts/") !== 0) {
      var flexy = document.querySelector("ytd-watch-flexy");
      if (flexy) {
        if (mode === "original") flexy.classList.remove("ubb-wide");
        else flexy.classList.add("ubb-wide");
        void flexy.offsetHeight;
      }
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
    if (plan.kind === "ambient" || plan.kind === "music") {
      syncAmbient();
      applySharpen();
      return;
    }
    stopAmbientLoop();
    area.classList.add("ubb-player", plan.kind === "zoom" ? "ubb-zoom" : "ubb-crop");
    area.classList.remove("ubb-ambient", "ubb-music");
    if (plan.kind !== "zoom") area.classList.remove("ubb-zoom");
    if (plan.kind !== "crop") area.classList.remove("ubb-crop");
    area.classList.add(plan.kind === "zoom" ? "ubb-zoom" : "ubb-crop");
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
        userScale: zoom,
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
      var watch = ["mode", "enabled", "locale", "ambientBlur", "musicStyle", "barColor", "barPalette", "sitePrefs", "pageMemory", "hiddenModes", "sharpen", "reducedMotion"];
      var relevant = false;
      for (var i = 0; i < watch.length; i++) if (changes[watch[i]]) relevant = true;
      if (!relevant) return;
      storageGetAll().then(function (saved) {
        applyStored(saved);
        if (changes.mode && changes.mode.newValue) setMode(changes.mode.newValue, false);
        else apply();
      });
    });
  }

  setInterval(apply, 1000);

  document.addEventListener("pointerdown", function () {
    if (mode === "music") resumeMusic();
  }, true);

  document.addEventListener("fullscreenchange", function () {
    setTimeout(apply, 50);
  });

  globalThis.__ubb = { setMode: setMode, cycle: cycle, apply: apply };
})();
