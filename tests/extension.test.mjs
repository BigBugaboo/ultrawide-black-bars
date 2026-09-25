import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function load(file) {
  const sandbox = {};
  vm.runInNewContext(readFileSync(new URL(file, import.meta.url), "utf8"), sandbox);
  return sandbox;
}

const i18n = load("../src/i18n.js").UbbI18n;
const settingsBox = load("../src/i18n.js");
vm.runInNewContext(readFileSync(new URL("../src/settings.js", import.meta.url), "utf8"), settingsBox);
const settings = settingsBox.UbbSettings;
const sites = load("../src/sites.js").UbbSites;

assert.equal(i18n.DEFAULT_LOCALE, "en");
assert.equal(i18n.resolveLocale(undefined), "en");
assert.equal(i18n.resolveLocale(""), "en");
assert.equal(i18n.resolveLocale("nope"), "en");
assert.equal(i18n.resolveLocale("zh-CN"), "zh_CN");
assert.equal(i18n.resolveLocale("zh-TW"), "zh_TW");
assert.equal(i18n.resolveLocale("pt-BR"), "pt_BR");
assert.equal(i18n.resolveLocale("pt-PT"), "pt");
assert.ok(i18n.LOCALES.length >= 42);
for (const code of ["en", "zh_CN", "zh_TW", "ja", "ko", "es", "fr", "de", "pt", "pt_BR", "ru", "it", "tr", "vi", "id", "th", "pl", "nl", "ar", "hi", "uk", "cs", "sv", "da", "fi", "no", "el", "he", "ro", "hu", "ms", "fil", "bn", "ca", "sk", "hr", "bg", "sr", "lt", "sl", "et", "lv", "fa", "sw"]) {
  assert.ok(i18n.LOCALES.includes(code), code);
}
assert.equal(i18n.translate("en", "searchLanguages"), "Search languages");
assert.deepEqual([...i18n.filterLocales("")], [...i18n.LOCALES]);
assert.deepEqual([...i18n.filterLocales("   ")], [...i18n.LOCALES]);
assert.deepEqual([...i18n.filterLocales("中文")], ["zh_CN", "zh_TW"]);
assert.ok(i18n.filterLocales("en").includes("en"));
assert.ok(i18n.filterLocales("EN").includes("en"));
assert.deepEqual([...i18n.filterLocales("zzzz-no-such")], []);

const welcomeKeys = ["welcomeTitle", "welcomeBody", "welcomeConfirm"];
const distinctKeys = ["tagline", "welcomeBody", "shortcut", "aboutFuture", "appearance"];
for (const locale of i18n.LOCALES) {
  const own = i18n.pack(locale);
  for (const key of i18n.keys()) {
    assert.equal(typeof own[key], "string", locale + " " + key);
    assert.ok(own[key].trim().length > 0, locale + " " + key);
    assert.ok(i18n.translate(locale, key).length > 0, locale + " " + key);
  }
  for (const key of welcomeKeys) {
    assert.ok(own[key].length > 0);
  }
  if (locale !== "en") {
    for (const key of distinctKeys) {
      assert.notEqual(own[key], i18n.pack("en")[key], locale + " " + key);
    }
  }
}

const defaults = settings.normalizeSettings(null);
assert.equal(defaults.locale, "en");
assert.equal(defaults.mode, "ambient");
assert.equal(defaults.theme, "dark");
assert.equal(defaults.themeLightStart, "07:00");
assert.equal(defaults.themeLightEnd, "19:00");
assert.equal(settings.normalizeSettings({ theme: "nope" }).theme, "dark");
const day = { theme: "auto", themeLightStart: "07:00", themeLightEnd: "19:00" };
assert.equal(settings.effectiveTheme(day, new Date(2026, 0, 1, 10, 0)), "light");
assert.equal(settings.effectiveTheme(day, new Date(2026, 0, 1, 21, 0)), "dark");
assert.equal(settings.effectiveTheme(day, new Date(2026, 0, 1, 3, 0)), "dark");
const overnight = { theme: "auto", themeLightStart: "19:00", themeLightEnd: "07:00" };
assert.equal(settings.effectiveTheme(overnight, new Date(2026, 0, 1, 22, 0)), "light");
assert.equal(settings.effectiveTheme(overnight, new Date(2026, 0, 1, 2, 0)), "light");
assert.equal(settings.effectiveTheme(overnight, new Date(2026, 0, 1, 12, 0)), "dark");
assert.equal(settings.effectiveTheme({ theme: "light" }, new Date(2026, 0, 1, 23, 0)), "light");
assert.equal(settings.normalizeSettings({ theme: "system" }).theme, "system");
assert.equal(settings.effectiveTheme({ theme: "system" }, new Date(2026, 0, 1, 23, 0), "light"), "light");
assert.equal(settings.effectiveTheme({ theme: "system" }, new Date(2026, 0, 1, 10, 0), "dark"), "dark");
assert.equal(settings.siteMemoryKey("WWW.YouTube.com"), "www.youtube.com");
assert.equal(
  settings.pageMemoryKey("https://www.youtube.com/watch?v=abc123&t=10&utm_source=share"),
  "https://www.youtube.com/watch?v=abc123"
);
assert.equal(settings.ACCENTS.length, 16);
assert.equal(settings.normalizeSettings({ mode: "stretch" }).mode, "crop");
assert.equal(settings.normalizeSettings({}).musicStyle, "bars");
assert.equal(settings.normalizeSettings({ musicStyle: "drops" }).musicStyle, "drops");
assert.equal(settings.normalizeSettings({ musicStyle: "nope" }).musicStyle, "bars");
assert.equal(settings.normalizeSettings({}).barColor, "#ffd60a");
assert.equal(settings.normalizeSettings({ barColor: "#00FF00" }).barColor, "#00ff00");
assert.equal(settings.normalizeSettings({ barColor: "red" }).barColor, "#ffd60a");
assert.equal(settings.normalizeSettings({}).barPalette, "solid");
assert.equal(settings.normalizeSettings({ barPalette: "rainbow" }).barPalette, "rainbow");
assert.equal(settings.normalizeSettings({ barPalette: "classic" }).barPalette, "classic");
assert.equal(settings.normalizeSettings({ barPalette: "flow" }).barPalette, "flow");
var hiddenAll = settings.normalizeSettings({ hiddenModes: ["original", "ambient", "music", "crop"] }).hiddenModes;
assert.ok(hiddenAll.indexOf("original") < 0);
assert.ok(hiddenAll.length < 4);
assert.equal(defaults.enabled, true);
assert.equal(settings.normalizeSettings({ enabled: false, mode: "ambient" }).enabled, false);
assert.equal(settings.normalizeSettings({ enabled: false, mode: "ambient" }).mode, "ambient");
assert.equal(settings.normalizeSettings({ enabled: true, mode: "crop" }).mode, "crop");
for (const locale of i18n.LOCALES) {
  assert.ok(i18n.translate(locale, "settings").length > 0);
}
assert.equal(settings.shouldOpenWelcome("install", false), true);
assert.equal(settings.shouldOpenWelcome("install", true), false);
assert.equal(settings.shouldOpenWelcome("update", false), false);
assert.equal(settings.shouldOpenWelcome("update", true), false);
assert.equal(settings.shouldOpenWelcome("chrome_update", false), false);

assert.equal(sites.current({ hostname: "www.bilibili.com", pathname: "/video/BV1" }).id, "bilibili");
assert.equal(sites.current({ hostname: "www.youtube.com", pathname: "/watch" }).id, "youtube");
assert.equal(sites.current({ hostname: "www.youtube.com", pathname: "/shorts/abc" }).id, "youtube");
assert.equal(sites.current({ hostname: "www.youtube.com", pathname: "/" }), null);
assert.equal(sites.current({ hostname: "www.twitch.tv", pathname: "/videos/123" }).id, "twitch");
assert.equal(sites.current({ hostname: "www.twitch.tv", pathname: "/somechannel" }), null);
assert.equal(sites.current({ hostname: "www.netflix.com", pathname: "/watch/80100172" }).id, "netflix");
assert.equal(sites.current({ hostname: "www.netflix.com", pathname: "/browse" }), null);
assert.equal(sites.current({ hostname: "www.primevideo.com", pathname: "/gp/video/detail/B0TEST" }).id, "prime");
assert.equal(sites.current({ hostname: "www.primevideo.com", pathname: "/region/eu/detail/amzn1" }).id, "prime");
assert.equal(sites.current({ hostname: "www.primevideo.com", pathname: "/" }), null);
assert.equal(sites.current({ hostname: "www.disneyplus.com", pathname: "/play/abc" }).id, "disney");
assert.equal(sites.current({ hostname: "www.disneyplus.com", pathname: "/home" }), null);
assert.equal(sites.current({ hostname: "play.max.com", pathname: "/video/watch/abc/def" }).id, "max");
assert.equal(sites.current({ hostname: "play.max.com", pathname: "/home" }), null);
assert.equal(sites.current({ hostname: "example.com", pathname: "/watch/1" }), null);

const biliOnly = {
  querySelector(sel) {
    return sel === ".bpx-player-video-area" ? { id: "bili" } : null;
  },
};
assert.equal(sites.sites.bilibili.findArea(biliOnly).id, "bili");
assert.equal(sites.sites.netflix.findArea(biliOnly), null);
assert.equal(sites.sites.prime.findArea(biliOnly), null);
assert.equal(sites.sites.disney.findArea(biliOnly), null);
assert.equal(sites.sites.max.findArea(biliOnly), null);

const netflixDoc = {
  querySelector(sel) {
    return sel === "[data-uia='watch-video-player-view']" ? { id: "nf" } : null;
  },
};
assert.equal(sites.sites.netflix.findArea(netflixDoc).id, "nf");

const saved = settings.updateSitePrefs({}, "www.netflix.com", {
  mode: "crop",
  userScale: 1.4,
  panX: 12,
  panY: -3,
});
const readBack = settings.readSitePrefs({ sitePrefs: saved }, "www.netflix.com");
assert.equal(readBack.mode, "crop");
assert.equal(readBack.userScale, 1.4);
assert.equal(readBack.panX, 12);
assert.equal(readBack.panY, -3);
assert.equal(settings.readSitePrefs({ sitePrefs: saved }, "www.youtube.com"), null);
const merged = settings.updateSitePrefs(saved, "www.youtube.com", { mode: "ambient", userScale: 2, panX: 0, panY: 1 });
assert.equal(settings.readSitePrefs({ sitePrefs: merged }, "www.netflix.com").mode, "crop");
assert.equal(settings.readSitePrefs({ sitePrefs: merged }, "www.youtube.com").userScale, 2);

const content = readFileSync(new URL("../src/content.js", import.meta.url), "utf8");
assert.match(content, /requestVideoFrameCallback/);
assert.match(content, /addEventListener\("wheel"/);
assert.match(content, /addEventListener\("pointerdown"/);
assert.doesNotMatch(content, /document\.addEventListener\(\s*"wheel"/);
assert.doesNotMatch(content, /document\.addEventListener\(\s*"contextmenu"/);
assert.match(content, /sitePrefs/);
assert.doesNotMatch(content, /setInterval\(\s*paintAmbient/);
assert.doesNotMatch(content, /setInterval\(\s*paintAmbientFrame/);
assert.match(content, /if\s*\(\s*!enabled\s*\)/);
assert.match(content, /setProperty\("height", height, "important"\)/);
const contentCss = readFileSync(new URL("../src/content.css", import.meta.url), "utf8");
assert.match(contentCss, /#movie_player\.ubb-fill video\.html5-main-video[\s\S]*object-fit:\s*cover/);
assert.match(contentCss, /bottom:\s*0 !important/);

const background = readFileSync(new URL("../src/background.js", import.meta.url), "utf8");
assert.doesNotMatch(background, /importScripts/);
assert.match(background, /reason === "install"/);
assert.match(background, /src\/welcome\.html/);

const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
assert.equal(manifest.background.service_worker, "src/background.js");
assert.deepEqual(manifest.permissions, ["storage"]);
assert.equal(manifest.default_locale, "en");
assert.ok(!JSON.stringify(manifest).includes("<all_urls>"));
assert.ok(!JSON.stringify(manifest).includes("http://*/*"));
assert.ok(!JSON.stringify(manifest).includes("https://*/*"));
const matchList = manifest.content_scripts[0].matches.join("\n");
assert.match(matchList, /netflix\.com\/watch\//);
assert.match(matchList, /primevideo\.com\/gp\/video\/detail\//);
assert.match(matchList, /disneyplus\.com\/play\//);
assert.match(matchList, /play\.max\.com\/video\/watch\//);
assert.equal(manifest.options_ui.page, "src/options.html");
assert.equal(manifest.options_ui.open_in_tab, true);

const popupHtml = readFileSync(new URL("../src/popup.html", import.meta.url), "utf8");
assert.match(popupHtml, /id="enabled"/);
assert.doesNotMatch(popupHtml, /<select/);
assert.match(popupHtml, /id="lang-toggle"/);
assert.match(popupHtml, /id="open-settings"/);
assert.match(popupHtml, /id="feedback"/);
assert.match(popupHtml, /issues\/new\/choose/);
assert.match(popupHtml, /data-blur="medium"/);
assert.match(popupHtml, /data-music-style="breath"/);

const optionsHtml = readFileSync(new URL("../src/options.html", import.meta.url), "utf8");
assert.match(optionsHtml, /id="settings-nav"/);
assert.match(optionsHtml, /data-mode="original"/);
assert.match(optionsHtml, /data-blur="medium"/);
assert.match(optionsHtml, /data-locale="ja"/);
assert.match(optionsHtml, /data-locale="id"/);
assert.match(optionsHtml, /id="nav-mode"/);
assert.match(optionsHtml, /id="nav-language"/);
assert.match(optionsHtml, /id="nav-shortcuts"/);
assert.match(optionsHtml, /id="nav-appearance"/);
assert.match(optionsHtml, /id="nav-future"/);
assert.doesNotMatch(optionsHtml, /id="nav-blur"/);
assert.doesNotMatch(optionsHtml, /id="hint"/);
assert.match(optionsHtml, /id="panel-mode"/);
assert.match(optionsHtml, /id="blur-group"/);
assert.match(optionsHtml, /id="panel-shortcuts"[^>]*hidden/);
assert.match(optionsHtml, /id="panel-appearance"[^>]*hidden/);
assert.match(optionsHtml, /id="panel-future"[^>]*hidden/);
assert.match(optionsHtml, /data-theme="auto"/);
assert.match(optionsHtml, /type="time"/);
assert.match(optionsHtml, /id="about-future"/);
assert.match(optionsHtml, /https:\/\/github\.com\/BigBugaboo\/ultrawide-black-bars\.git/);
assert.ok(i18n.translate("en", "aboutFutureBody").trim().length > 0);
assert.ok(i18n.translate("zh_CN", "aboutFutureBody").trim().length > 0);
assert.match(optionsHtml, /target="_blank"/);
assert.doesNotMatch(optionsHtml, /id="panel-mode"[^>]*hidden/);

for (const locale of i18n.LOCALES) {
  const catalog = JSON.parse(readFileSync(new URL(`../_locales/${locale}/messages.json`, import.meta.url), "utf8"));
  for (const key of ["extName", "extDescription", "commandCycle"]) {
    assert.equal(typeof catalog[key].message, "string", locale + " " + key);
    assert.ok(catalog[key].message.length > 0, locale + " " + key);
  }
}

const optionsJs = readFileSync(new URL("../src/options.js", import.meta.url), "utf8");
assert.match(optionsJs, /var panel = "mode"/);
assert.match(optionsJs, /section\.hidden = section\.dataset\.panel !== panel/);
assert.match(optionsJs, /chrome\.storage\.local\.set/);
assert.match(optionsJs, /panelKey/);
assert.match(optionsJs, /button\.hidden = !label/);

function optionsElement() {
  return {
    hidden: false,
    textContent: "",
    value: "",
    dataset: {},
    style: { setProperty() {} },
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    appendChild() {},
    querySelectorAll() {
      return [];
    },
    closest() {
      return this;
    },
    nextElementSibling: { textContent: "" },
    childElementCount: 0,
  };
}
const optionsSandbox = {
  document: {
    documentElement: { lang: "en" },
    title: "",
    querySelector() {
      return optionsElement();
    },
    querySelectorAll() {
      return [];
    },
  },
  chrome: {
    storage: {
      local: {
        get() {},
        set() {},
        remove() {},
      },
    },
  },
};
optionsSandbox.globalThis = optionsSandbox;
vm.runInNewContext(optionsJs, optionsSandbox);
const panelIds = ["mode", "language", "shortcuts", "appearance", "future"];
const sections = panelIds.map((id) => ({ dataset: { panel: id }, hidden: false }));
for (const id of panelIds) {
  optionsSandbox.UbbOptions.applyPanelVisibility(sections, id);
  const visible = sections.filter((section) => !section.hidden).map((section) => section.dataset.panel);
  assert.deepEqual(visible, [id], id);
}
const modeEntries = optionsSandbox.UbbOptions.labeledModeNames(
  ["original", "ambient", "crop"],
  (key) => i18n.translate("en", key)
);
assert.ok(modeEntries.length >= 3);
for (const entry of modeEntries) {
  assert.equal(typeof entry.label, "string");
  assert.ok(entry.label.trim().length > 0, entry.name);
}
assert.ok(modeEntries.some((entry) => entry.name === "original"));
assert.ok(modeEntries.some((entry) => entry.name === "ambient"));
assert.ok(modeEntries.some((entry) => entry.name === "crop"));

const popupCss = readFileSync(new URL("../src/popup.css", import.meta.url), "utf8");
assert.match(popupCss, /body\.welcome\.settings main\s*\{[^}]*height:\s*min\(640px,\s*calc\(100vh - 48px\)\)/);
assert.match(popupCss, /body\.welcome\.settings \.settings-panel\s*\{[^}]*overflow:\s*auto/);
assert.match(popupCss, /body\.welcome\.settings \.settings-panel\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
assert.match(popupCss, /label\.check\[hidden\][\s\S]*display:\s*none\s*!important/);
assert.match(popupCss, /body\.welcome\.settings #languages\s*\{[^}]*flex:\s*1/);
assert.match(popupCss, /body\.welcome\.settings #languages\s*\{[^}]*overflow:\s*auto/);
assert.doesNotMatch(popupCss, /#languages\s*\{[^}]*max-height/);

const popupSource = readFileSync(new URL("../src/popup.js", import.meta.url), "utf8");
assert.match(popupSource, /button\.hidden = !label/);
assert.match(popupSource, /openOptionsPage\s*\(/);
assert.match(popupSource, /function openExtensionOptions/);
assert.match(popupSource, /function bindOpenSettings/);

let opened = 0;
const openSettingsButton = {
  textContent: "",
  addEventListener(type, fn) {
    this._click = fn;
  },
  click() {
    this._click({
      preventDefault() {},
      stopPropagation() {},
    });
  },
};
const popupSandbox = {
  document: {
    documentElement: { lang: "en" },
    querySelector(sel) {
      if (sel === "#open-settings") return openSettingsButton;
      if (sel === "#tagline") return { textContent: "" };
      if (sel === "#lang-toggle") {
        return {
          textContent: "",
          setAttribute() {},
          addEventListener() {},
        };
      }
      if (sel === "#lang-menu") return { hidden: true };
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  },
  chrome: {
    storage: {
      local: {
        get(_keys, cb) {
          cb({});
        },
        set() {},
        remove() {},
      },
    },
    runtime: {
      openOptionsPage() {
        opened += 1;
        return Promise.resolve();
      },
    },
  },
  UbbI18n: {
    translate(_locale, key) {
      return key;
    },
    htmlLang() {
      return "en";
    },
    resolveLocale(value) {
      return value || "en";
    },
  },
  UbbSettings: {
    normalizeSettings() {
      return { locale: "en", mode: "ambient", enabled: true };
    },
  },
};
popupSandbox.globalThis = popupSandbox;
vm.runInNewContext(popupSource, popupSandbox);
assert.equal(typeof popupSandbox.UbbPopup.openExtensionOptions, "function");
assert.equal(typeof popupSandbox.UbbPopup.bindOpenSettings, "function");
opened = 0;
openSettingsButton.click();
assert.equal(opened, 1, "Settings click should call openOptionsPage");

console.log("extension tests passed");
