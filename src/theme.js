(function (root) {
  var timer = 0;
  var current = null;
  var mediaBound = false;

  function systemTheme() {
    try {
      if (root.matchMedia && root.matchMedia("(prefers-color-scheme: light)").matches) return "light";
    } catch (err) {}
    return "dark";
  }

  function systemReduced() {
    try {
      return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (err) {
      return false;
    }
  }

  function applyTheme(raw, date) {
    var settings = root.UbbSettings.normalizeSettings(raw);
    var effective = root.UbbSettings.effectiveTheme(settings, date || new Date(), systemTheme());
    var node = root.document && root.document.documentElement;
    if (node) {
      node.dataset.theme = effective;
      node.dataset.accent = settings.accent;
      node.style.setProperty("--ubb-accent", root.UbbSettings.accentColor(settings.accent));
      node.dataset.motion = settings.reducedMotion || systemReduced() ? "reduce" : "full";
    }
    return effective;
  }

  function tick() {
    if (current && current.theme === "auto") applyTheme(current);
  }

  function bindMedia() {
    if (mediaBound || !root.matchMedia) return;
    mediaBound = true;
    function onChange() {
      if (current) applyTheme(current);
    }
    var queries = ["(prefers-color-scheme: light)", "(prefers-reduced-motion: reduce)"];
    for (var i = 0; i < queries.length; i++) {
      try {
        var query = root.matchMedia(queries[i]);
        if (query.addEventListener) query.addEventListener("change", onChange);
        else if (query.addListener) query.addListener(onChange);
      } catch (err) {}
    }
  }

  function watchTheme() {
    var chromeApi = root.chrome;
    if (!chromeApi || !chromeApi.storage || !chromeApi.storage.local) return;
    function refresh(items) {
      current = root.UbbSettings.normalizeSettings(items);
      applyTheme(current);
    }
    chromeApi.storage.local.get(null, refresh);
    if (chromeApi.storage.onChanged) {
      chromeApi.storage.onChanged.addListener(function (_changes, area) {
        if (area !== "local") return;
        chromeApi.storage.local.get(null, refresh);
      });
    }
    if (timer) root.clearInterval(timer);
    timer = root.setInterval(tick, 60000);
    bindMedia();
  }

  root.UbbTheme = {
    applyTheme: applyTheme,
    watchTheme: watchTheme,
  };

  if (root.document && root.document.documentElement) watchTheme();
})(typeof globalThis !== "undefined" ? globalThis : this);
