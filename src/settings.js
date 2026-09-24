(function (root) {
  var BLUR_PX = { soft: 12, medium: 20, strong: 32 };
  var MODES = ["original", "ambient", "crop", "stretch"];
  var ACCENTS = [
    { id: "cyan", color: "#00aeec" },
    { id: "blue", color: "#3b82f6" },
    { id: "indigo", color: "#6366f1" },
    { id: "violet", color: "#8b5cf6" },
    { id: "purple", color: "#a855f7" },
    { id: "pink", color: "#ec4899" },
    { id: "red", color: "#ef4444" },
    { id: "orange", color: "#f97316" },
    { id: "amber", color: "#f59e0b" },
    { id: "lime", color: "#84cc16" },
    { id: "green", color: "#22c55e" },
    { id: "teal", color: "#14b8a6" },
    { id: "sky", color: "#0ea5e9" },
    { id: "rose", color: "#f43f5e" },
    { id: "slate", color: "#64748b" },
    { id: "gold", color: "#d4a017" },
  ];
  var DROP_QUERY = {
    t: 1,
    start: 1,
    time_continue: 1,
    feature: 1,
    si: 1,
    pp: 1,
    ab_channel: 1,
    fbclid: 1,
    gclid: 1,
    ref: 1,
    share: 1,
    timestamp: 1,
    list: 1,
    index: 1,
    embeds_referring_euri: 1,
    source_ve_path: 1,
    spm_id_from: 1,
    vd_source: 1,
    share_source: 1,
    share_medium: 1,
    share_plat: 1,
    unique_k: 1,
  };

  function normalizeMode(mode) {
    if (mode === "original" || mode === "ambient" || mode === "crop" || mode === "stretch") return mode;
    return "ambient";
  }

  function legacyEnabledOff(value) {
    return value === false || value === "false" || value === 0;
  }

  function normalizeBlur(value) {
    if (Object.prototype.hasOwnProperty.call(BLUR_PX, value)) return value;
    return "medium";
  }

  function normalizeLocale(value) {
    var i18n = root.UbbI18n;
    if (i18n && i18n.resolveLocale) return i18n.resolveLocale(value);
    return "en";
  }

  function normalizeTheme(value) {
    if (value === "light" || value === "dark" || value === "auto" || value === "system") return value;
    return "dark";
  }

  function normalizeClock(value, fallback) {
    if (typeof value !== "string") return fallback;
    var match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return fallback;
    var hours = Number(match[1]);
    var mins = Number(match[2]);
    if (hours > 23 || mins > 59) return fallback;
    return match[1] + ":" + match[2];
  }

  function clockMinutes(value) {
    var match = /^(\d{2}):(\d{2})$/.exec(value);
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function isLightAt(date, start, end) {
    var startMin = clockMinutes(start);
    var endMin = clockMinutes(end);
    if (startMin === endMin) return false;
    var minutes = date.getHours() * 60 + date.getMinutes();
    if (startMin < endMin) return minutes >= startMin && minutes < endMin;
    return minutes >= startMin || minutes < endMin;
  }

  function normalizeHiddenModes(value) {
    var out = [];
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        if (MODES.indexOf(value[i]) >= 0 && out.indexOf(value[i]) < 0) out.push(value[i]);
      }
    }
    if (out.length >= MODES.length) {
      return MODES.filter(function (mode) {
        return mode !== "original";
      });
    }
    return out;
  }

  function normalizeAccent(value) {
    for (var i = 0; i < ACCENTS.length; i++) {
      if (ACCENTS[i].id === value) return value;
    }
    return "cyan";
  }

  function normalizeZoom(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return 1;
    if (n < 1) return 1;
    if (n > 4) return 4;
    return Math.round(n * 100) / 100;
  }

  function normalizePan(value) {
    var n = Number(value);
    if (!isFinite(n)) return 0;
    if (n > 1600) return 1600;
    if (n < -1600) return -1600;
    return Math.round(n);
  }

  function normalizeMemoryMap(value) {
    if (!value || typeof value !== "object") return {};
    var keys = Object.keys(value);
    var start = keys.length > 40 ? keys.length - 40 : 0;
    var out = {};
    for (var i = start; i < keys.length; i++) {
      var item = value[keys[i]];
      if (!item || typeof item !== "object") continue;
      var entry = {};
      if (item.mode) entry.mode = normalizeMode(item.mode);
      if (item.zoom != null) entry.zoom = normalizeZoom(item.zoom);
      if (item.panX != null) entry.panX = normalizePan(item.panX);
      if (item.panY != null) entry.panY = normalizePan(item.panY);
      out[keys[i]] = entry;
    }
    return out;
  }

  function siteMemoryKey(hostname) {
    return String(hostname || "").trim().toLowerCase();
  }

  function dropQuery(key) {
    var lower = String(key || "").toLowerCase();
    if (lower.indexOf("utm_") === 0) return true;
    return !!DROP_QUERY[lower];
  }

  function pageMemoryKey(href) {
    var text = String(href || "");
    var hash = text.indexOf("#");
    if (hash >= 0) text = text.slice(0, hash);
    var q = text.indexOf("?");
    if (q < 0) return text;
    var base = text.slice(0, q);
    var parts = text.slice(q + 1).split("&");
    var kept = [];
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var eq = parts[i].indexOf("=");
      var rawKey = eq < 0 ? parts[i] : parts[i].slice(0, eq);
      var key = rawKey;
      try {
        key = decodeURIComponent(rawKey.replace(/\+/g, " "));
      } catch (err) {}
      if (dropQuery(key)) continue;
      kept.push(parts[i]);
    }
    if (!kept.length) return base;
    return base + "?" + kept.join("&");
  }

  function normalizeSettings(raw) {
    raw = raw || {};
    var dropEnabled = legacyEnabledOff(raw.enabled);
    return {
      mode: dropEnabled ? "original" : normalizeMode(raw.mode),
      locale: normalizeLocale(raw.locale),
      ambientBlur: normalizeBlur(raw.ambientBlur),
      welcomeAck: raw.welcomeAck === true,
      dropEnabled: dropEnabled,
      theme: normalizeTheme(raw.theme),
      themeLightStart: normalizeClock(raw.themeLightStart, "07:00"),
      themeLightEnd: normalizeClock(raw.themeLightEnd, "19:00"),
      hiddenModes: normalizeHiddenModes(raw.hiddenModes),
      accent: normalizeAccent(raw.accent),
      reducedMotion: raw.reducedMotion === true,
      sharpen: raw.sharpen === true,
      zoom: normalizeZoom(raw.zoom),
      panX: normalizePan(raw.panX),
      panY: normalizePan(raw.panY),
      siteMemory: normalizeMemoryMap(raw.siteMemory),
      pageMemory: normalizeMemoryMap(raw.pageMemory),
    };
  }

  function effectiveTheme(raw, date, systemTheme) {
    var settings = normalizeSettings(raw);
    if (settings.theme === "system") return systemTheme === "light" ? "light" : "dark";
    if (settings.theme !== "auto") return settings.theme;
    return isLightAt(date || new Date(), settings.themeLightStart, settings.themeLightEnd) ? "light" : "dark";
  }

  function blurRadius(name) {
    return BLUR_PX[normalizeBlur(name)];
  }

  function shouldOpenWelcome(reason, welcomeAck) {
    return reason === "install" && welcomeAck !== true;
  }

  function accentColor(id) {
    var accent = normalizeAccent(id);
    for (var i = 0; i < ACCENTS.length; i++) {
      if (ACCENTS[i].id === accent) return ACCENTS[i].color;
    }
    return "#00aeec";
  }

  root.UbbSettings = {
    BLUR_PX: BLUR_PX,
    ACCENTS: ACCENTS,
    normalizeSettings: normalizeSettings,
    normalizeHiddenModes: normalizeHiddenModes,
    normalizeZoom: normalizeZoom,
    normalizePan: normalizePan,
    blurRadius: blurRadius,
    shouldOpenWelcome: shouldOpenWelcome,
    effectiveTheme: effectiveTheme,
    isLightAt: isLightAt,
    siteMemoryKey: siteMemoryKey,
    pageMemoryKey: pageMemoryKey,
    accentColor: accentColor,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
