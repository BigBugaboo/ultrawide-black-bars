var locale = "en";
var titleEl = document.querySelector("#welcome-title");
var bodyEl = document.querySelector("#welcome-body");
var languageLabel = document.querySelector("#language-label");
var language = document.querySelector("#language");
var ack = document.querySelector("#ack");

function render() {
  var t = function (key) {
    return UbbI18n.translate(locale, key);
  };
  document.documentElement.lang = UbbI18n.htmlLang(locale);
  titleEl.textContent = t("welcomeTitle");
  bodyEl.textContent = t("welcomeBody");
  languageLabel.textContent = t("language");
  ack.textContent = t("welcomeConfirm");
  language.value = locale;
}

language.addEventListener("change", function () {
  locale = UbbI18n.resolveLocale(language.value);
  chrome.storage.local.set({ locale: locale });
  render();
});

ack.addEventListener("click", function () {
  chrome.storage.local.set({ welcomeAck: true }, function () {
    window.close();
  });
});

chrome.storage.local.get(null, function (items) {
  var settings = UbbSettings.normalizeSettings(items);
  locale = settings.locale;
  render();
});
