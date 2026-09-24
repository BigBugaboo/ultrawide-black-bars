var locale = "en";
var mode = "ambient";

var tagline = document.querySelector("#tagline");
var modeButtons = document.querySelectorAll("#modes button");
var langToggle = document.querySelector("#lang-toggle");
var langMenu = document.querySelector("#lang-menu");
var langOptions = document.querySelectorAll("#lang-menu button");
var langSearch = document.querySelector("#lang-search");
var langEmpty = document.querySelector("#lang-empty");
var openSettings = document.querySelector("#open-settings");


function t(key) {
  return UbbI18n.translate(locale, key);
}

function render() {
  document.documentElement.lang = UbbI18n.htmlLang(locale);
  if (tagline) tagline.textContent = t("tagline");
  if (langToggle) langToggle.textContent = UbbI18n.localeName ? UbbI18n.localeName(locale) : locale;
  modeButtons.forEach(function (button) {
    var name = button.dataset.mode;
    var key = name === "original" ? "modeOriginal" : name === "crop" ? "modeCrop" : "modeAmbient";
    button.textContent = t(key);
    button.classList.toggle("active", name === mode);
  });
  if (langSearch) {
    langSearch.placeholder = t("searchLanguages");
    langSearch.setAttribute("aria-label", t("searchLanguages"));
  }
  if (langEmpty) langEmpty.textContent = t("languageEmpty");
  applyLangFilter();
  if (openSettings) openSettings.textContent = t("settings");
}

function persist(patch) {
  chrome.storage.local.set(patch);
}

function applyLangFilter() {
  var query = langSearch ? langSearch.value : "";
  var matched = UbbI18n.filterLocales ? UbbI18n.filterLocales(query) : null;
  var visible = 0;
  langOptions.forEach(function (button) {
    var show = matched ? matched.indexOf(button.dataset.locale) !== -1 : true;
    if (matched) button.hidden = !show;
    if (show) visible += 1;
    button.classList.toggle("active", button.dataset.locale === locale);
  });
  if (langEmpty) langEmpty.hidden = !matched || visible !== 0;
}

function closeLang() {
  if (!langMenu || !langToggle) return;
  langMenu.hidden = true;
  langToggle.setAttribute("aria-expanded", "false");
  if (langSearch && langSearch.value) {
    langSearch.value = "";
    applyLangFilter();
  }
}

function openExtensionOptions(runtimeApi) {
  var result;
  if (runtimeApi && typeof runtimeApi.openOptionsPage === "function") {
    result = runtimeApi.openOptionsPage();
  } else {
    result = chrome.runtime.openOptionsPage();
  }
  if (result && typeof result.catch === "function" && !runtimeApi) {
    return result.catch(function () {
      return chrome.tabs.create({ url: chrome.runtime.getURL("src/options.html") });
    });
  }
  return result;
}

function bindOpenSettings(button, runtimeApi) {
  if (!button) return;
  button.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    openExtensionOptions(runtimeApi);
  });
}

if (langToggle) {
  langToggle.addEventListener("click", function (event) {
    event.stopPropagation();
    if (!langMenu) return;
    var open = langMenu.hidden;
    langMenu.hidden = !open;
    langToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && langSearch && langSearch.focus) langSearch.focus();
  });
}

if (langMenu && langMenu.addEventListener) {
  langMenu.addEventListener("click", function (event) {
    event.stopPropagation();
  });
}

if (langSearch) {
  langSearch.addEventListener("input", function () {
    applyLangFilter();
  });
}

langOptions.forEach(function (button) {
  button.addEventListener("click", function (event) {
    event.stopPropagation();
    locale = UbbI18n.resolveLocale(button.dataset.locale);
    persist({ locale: locale });
    closeLang();
    render();
  });
});

document.addEventListener("click", closeLang);

modeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    mode = button.dataset.mode;
    persist({ mode: mode });
    render();
  });
});

bindOpenSettings(openSettings);

chrome.storage.local.get(null, function (items) {
  var settings = UbbSettings.normalizeSettings(items);
  locale = settings.locale;
  mode = settings.mode;
  if (settings.dropEnabled) {
    persist({ mode: "original" });
    chrome.storage.local.remove("enabled");
  }
  render();
});

if (typeof globalThis !== "undefined") {
  globalThis.UbbPopup = {
    openExtensionOptions: openExtensionOptions,
    bindOpenSettings: bindOpenSettings,
  };
}
