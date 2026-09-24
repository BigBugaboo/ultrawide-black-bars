var locale = "en";
var mode = "ambient";
var ambientBlur = "medium";
var panel = "mode";
var theme = "dark";
var themeLightStart = "07:00";
var themeLightEnd = "19:00";

var settingsTitle = document.querySelector("#settings-title");
var nav = document.querySelector("#settings-nav");
var navButtons = document.querySelectorAll("#settings-nav button");
var panels = document.querySelectorAll(".settings-panel");
var modeButtons = document.querySelectorAll("#modes > button[data-mode]");
var blurGroup = document.querySelector("#blur-group");
var blurLabel = document.querySelector("#blur-label");
var blurButtons = document.querySelectorAll("#blur button");
var languageButtons = document.querySelectorAll("#languages button");
var languageSearch = document.querySelector("#language-search");
var languageEmpty = document.querySelector("#language-empty");
var shortcutCopy = document.querySelector("#shortcut-copy");
var shortcutCurrentLabel = document.querySelector("#shortcut-current-label");
var shortcutCurrent = document.querySelector("#shortcut-current");
var shortcutCaptureLabel = document.querySelector("#shortcut-capture-label");
var shortcutCapture = document.querySelector("#shortcut-capture");
var shortcutPending = document.querySelector("#shortcut-pending");
var shortcutError = document.querySelector("#shortcut-error");
var shortcutSavedNote = document.querySelector("#shortcut-saved");
var shortcutSave = document.querySelector("#shortcut-save");
var shortcutReset = document.querySelector("#shortcut-reset");
var shortcutBrowser = document.querySelector("#shortcut-browser");
var shortcutBrowserFallback = document.querySelector("#shortcut-browser-fallback");
var currentShortcut = "";
var pendingShortcut = "";
var shortcutErrorCode = "";
var shortcutErrorDetail = "";
var shortcutSaved = false;
var shortcutListening = false;
var shortcutBrowserFailed = false;
var themeButtons = document.querySelectorAll("#themes button");
var themeTimes = document.querySelector("#theme-times");
var lightStartLabel = document.querySelector("#light-start-label");
var lightEndLabel = document.querySelector("#light-end-label");
var lightStartInput = document.querySelector("#light-start");
var lightEndInput = document.querySelector("#light-end");
var aboutFuture = document.querySelector("#about-future");

function t(key) {
  return UbbI18n.translate(locale, key);
}

function panelKey(name) {
  if (name === "language") return "language";
  if (name === "shortcuts") return "shortcuts";
  if (name === "appearance") return "appearance";
  if (name === "future") return "aboutFuture";
  return "modeLabel";
}

function themeKey(name) {
  if (name === "light") return "themeLight";
  if (name === "auto") return "themeAuto";
  return "themeDark";
}

function render() {
  document.documentElement.lang = UbbI18n.htmlLang(locale);
  document.title = "Ultrawide Black Bars";
  settingsTitle.textContent = t("settings");
  nav.setAttribute("aria-label", t("settings"));
  navButtons.forEach(function (button) {
    var name = button.dataset.panel;
    var selected = name === panel;
    button.textContent = t(panelKey(name));
    button.classList.toggle("active", selected);
    if (selected) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
  panels.forEach(function (section) {
    section.hidden = section.dataset.panel !== panel;
  });
  modeButtons.forEach(function (button) {
    var name = button.dataset.mode;
    var key = name === "original" ? "modeOriginal" : name === "crop" ? "modeCrop" : "modeAmbient";
    button.textContent = t(key);
    button.classList.toggle("active", name === mode);
  });
  blurGroup.hidden = mode !== "ambient";
  blurLabel.textContent = t("blur");
  blurButtons.forEach(function (button) {
    var name = button.dataset.blur;
    var key = name === "soft" ? "blurSoft" : name === "strong" ? "blurStrong" : "blurMedium";
    button.textContent = t(key);
    button.classList.toggle("active", name === ambientBlur);
  });
  if (languageSearch) {
    languageSearch.placeholder = t("searchLanguages");
    languageSearch.setAttribute("aria-label", t("searchLanguages"));
  }
  if (languageEmpty) languageEmpty.textContent = t("languageEmpty");
  applyLanguageFilter();
  shortcutCopy.textContent = t("shortcut");
  if (shortcutCurrentLabel) shortcutCurrentLabel.textContent = t("shortcutCurrent");
  if (shortcutCurrent) shortcutCurrent.textContent = currentShortcut || t("shortcutNone");
  if (shortcutCaptureLabel) shortcutCaptureLabel.textContent = t("shortcutNew");
  if (shortcutCapture) {
    shortcutCapture.textContent = pendingShortcut || t("shortcutCaptureHint");
    shortcutCapture.classList.toggle("listening", shortcutListening);
  }
  if (shortcutPending) {
    shortcutPending.textContent = pendingShortcut ? t("shortcutWillSave") + " " + pendingShortcut : "";
  }
  if (shortcutError) {
    var errorText = shortcutErrorText();
    shortcutError.hidden = !errorText;
    shortcutError.textContent = errorText;
  }
  if (shortcutSavedNote) {
    shortcutSavedNote.hidden = !shortcutSaved;
    shortcutSavedNote.textContent = t("shortcutSaved");
  }
  if (shortcutSave) {
    shortcutSave.textContent = t("shortcutSave");
    shortcutSave.disabled = !pendingShortcut;
  }
  if (shortcutReset) shortcutReset.textContent = t("shortcutReset");
  if (shortcutBrowser) shortcutBrowser.textContent = t("shortcutBrowser");
  if (shortcutBrowserFallback) {
    shortcutBrowserFallback.hidden = !shortcutBrowserFailed;
    shortcutBrowserFallback.textContent = t("shortcutBrowserHelp");
  }
  themeButtons.forEach(function (button) {
    button.textContent = t(themeKey(button.dataset.theme));
    button.classList.toggle("active", button.dataset.theme === theme);
  });
  if (aboutFuture) aboutFuture.textContent = t("aboutFutureBody");
  themeTimes.hidden = theme !== "auto";
  lightStartLabel.textContent = t("themeLightStart");
  lightEndLabel.textContent = t("themeLightEnd");
  lightStartInput.value = themeLightStart;
  lightEndInput.value = themeLightEnd;
}

function applyLanguageFilter() {
  var query = languageSearch ? languageSearch.value : "";
  var matched = UbbI18n.filterLocales(query);
  var visible = 0;
  languageButtons.forEach(function (button) {
    var show = matched.indexOf(button.dataset.locale) !== -1;
    button.hidden = !show;
    if (show) visible += 1;
    button.classList.toggle("active", button.dataset.locale === locale);
  });
  if (languageEmpty) languageEmpty.hidden = visible !== 0;
}

function persist(patch) {
  chrome.storage.local.set(patch);
}

navButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    panel = button.dataset.panel;
    render();
  });
});

modeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    mode = button.dataset.mode;
    persist({ mode: mode });
    render();
  });
});

blurButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    ambientBlur = button.dataset.blur;
    persist({ ambientBlur: ambientBlur });
    render();
  });
});

languageButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    locale = UbbI18n.resolveLocale(button.dataset.locale);
    persist({ locale: locale });
    render();
  });
});

if (languageSearch) {
  languageSearch.addEventListener("input", function () {
    applyLanguageFilter();
  });
}

themeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    theme = button.dataset.theme;
    persist({ theme: theme });
    render();
  });
});

function onClock(input, key) {
  input.addEventListener("change", function () {
    var next = UbbSettings.normalizeSettings({ themeLightStart: input.value, themeLightEnd: input.value });
    var value = key === "themeLightStart" ? next.themeLightStart : next.themeLightEnd;
    if (key === "themeLightStart") themeLightStart = value;
    else themeLightEnd = value;
    var patch = {};
    patch[key] = value;
    persist(patch);
    render();
  });
}

onClock(lightStartInput, "themeLightStart");
onClock(lightEndInput, "themeLightEnd");

function shortcutErrorText() {
  if (!shortcutErrorCode) return "";
  var key = "shortcutErrorFailed";
  if (shortcutErrorCode === "modifier") key = "shortcutErrorModifier";
  else if (shortcutErrorCode === "ctrl-alt") key = "shortcutErrorCtrlAlt";
  else if (shortcutErrorCode === "key" || shortcutErrorCode === "empty") key = "shortcutErrorKey";
  else if (shortcutErrorCode === "reserved") key = "shortcutErrorReserved";
  var text = t(key);
  if (shortcutErrorDetail) text += " " + shortcutErrorDetail;
  return text;
}

function applyShortcutResult(result, clearPending) {
  if (!result.ok) {
    shortcutErrorCode = result.error || "chrome";
    shortcutErrorDetail = result.message || "";
    shortcutSaved = false;
    render();
    return;
  }
  currentShortcut = result.shortcut;
  if (clearPending) pendingShortcut = "";
  shortcutErrorCode = "";
  shortcutErrorDetail = "";
  shortcutSaved = true;
  render();
}

if (shortcutCapture) {
  shortcutCapture.addEventListener("focus", function () {
    shortcutListening = true;
    render();
  });
  shortcutCapture.addEventListener("blur", function () {
    shortcutListening = false;
    render();
  });
  shortcutCapture.addEventListener("keydown", function (event) {
    event.preventDefault();
    event.stopPropagation();
    var parsed = UbbShortcuts.fromKeyEvent(event);
    if (parsed.error === "incomplete") return;
    shortcutSaved = false;
    shortcutErrorDetail = "";
    if (!parsed.ok) {
      pendingShortcut = "";
      shortcutErrorCode = parsed.error;
    } else {
      pendingShortcut = parsed.shortcut;
      shortcutErrorCode = "";
    }
    render();
  });
}

if (shortcutSave) {
  shortcutSave.addEventListener("click", function () {
    if (!pendingShortcut) return;
    UbbShortcuts.writeShortcut(chrome, pendingShortcut, function (result) {
      applyShortcutResult(result, true);
    });
  });
}

if (shortcutReset) {
  shortcutReset.addEventListener("click", function () {
    UbbShortcuts.writeShortcut(chrome, UbbShortcuts.DEFAULT_SHORTCUT, function (result) {
      applyShortcutResult(result, true);
    });
  });
}

if (shortcutBrowser) {
  shortcutBrowser.addEventListener("click", function () {
    try {
      UbbShortcuts.openShortcutsPage(chrome, function (result) {
        shortcutBrowserFailed = !result.ok;
        render();
      });
    } catch (err) {
      shortcutBrowserFailed = true;
      render();
    }
  });
}

chrome.storage.local.get(null, function (items) {
  var settings = UbbSettings.normalizeSettings(items);
  locale = settings.locale;
  mode = settings.mode;
  ambientBlur = settings.ambientBlur;
  theme = settings.theme;
  themeLightStart = settings.themeLightStart;
  themeLightEnd = settings.themeLightEnd;
  if (settings.dropEnabled) {
    persist({ mode: "original" });
    chrome.storage.local.remove("enabled");
  }
  render();
  if (chrome.commands && chrome.commands.getAll) {
    UbbShortcuts.readShortcut(chrome.commands, function (shortcut) {
      currentShortcut = shortcut;
      render();
    });
  }
});
