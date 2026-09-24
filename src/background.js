chrome.commands.onCommand.addListener(function (command) {
  if (command !== "cycle-mode") return;
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    if (!tab || !tab.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "cycle-mode" });
  });
});

function shouldOpenWelcome(reason, welcomeAck) {
  return reason === "install" && welcomeAck !== true;
}

chrome.runtime.onInstalled.addListener(function (details) {
  var reason = details && details.reason;
  if (!shouldOpenWelcome(reason, false)) return;
  chrome.storage.local.get("welcomeAck", function (items) {
    var acked = !!(items && items.welcomeAck === true);
    if (!shouldOpenWelcome(reason, acked)) return;
    chrome.tabs.create({ url: chrome.runtime.getURL("src/welcome.html") });
  });
});
