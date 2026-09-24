import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function load(file) {
  const sandbox = {};
  vm.runInNewContext(readFileSync(new URL(file, import.meta.url), "utf8"), sandbox);
  return sandbox;
}

const shortcuts = load("../src/shortcuts.js").UbbShortcuts;

assert.equal(shortcuts.COMMAND_NAME, "cycle-mode");
assert.equal(shortcuts.DEFAULT_SHORTCUT, "Alt+Shift+U");
assert.equal(shortcuts.normalizeShortcut("Alt+Shift+U").shortcut, "Alt+Shift+U");
assert.equal(shortcuts.normalizeShortcut("alt + shift + u").shortcut, "Alt+Shift+U");
assert.equal(shortcuts.normalizeShortcut("shift+alt+u").shortcut, "Alt+Shift+U");
assert.equal(shortcuts.normalizeShortcut("ctrl+shift+u").shortcut, "Ctrl+Shift+U");
assert.equal(shortcuts.normalizeShortcut("command+shift+u").shortcut, "Command+Shift+U");
assert.equal(shortcuts.normalizeShortcut("MacCtrl+Shift+U").shortcut, "MacCtrl+Shift+U");
assert.equal(shortcuts.normalizeShortcut("MediaPlayPause").shortcut, "MediaPlayPause");

assert.equal(shortcuts.normalizeShortcut("U").error, "modifier");
assert.equal(shortcuts.normalizeShortcut("Shift+U").error, "modifier");
assert.equal(shortcuts.normalizeShortcut("").error, "empty");
assert.equal(shortcuts.normalizeShortcut("Ctrl+Alt+K").error, "ctrl-alt");
assert.equal(shortcuts.normalizeShortcut("Ctrl+Alt+Shift+K").error, "ctrl-alt");
assert.equal(shortcuts.normalizeShortcut("Alt+F1").error, "key");
assert.equal(shortcuts.normalizeShortcut("Ctrl+T").error, "reserved");
assert.equal(shortcuts.normalizeShortcut("Command+T").error, "reserved");
assert.equal(shortcuts.normalizeShortcut("Ctrl+Shift+T").error, "reserved");

const captured = shortcuts.fromKeyEvent(
  { code: "KeyU", key: "U", altKey: true, shiftKey: true, ctrlKey: false, metaKey: false },
  "mac"
);
assert.equal(captured.shortcut, "Alt+Shift+U");
assert.equal(
  shortcuts.fromKeyEvent({ code: "KeyU", key: "u", metaKey: true, shiftKey: true }, "mac").shortcut,
  "Command+Shift+U"
);
assert.equal(shortcuts.fromKeyEvent({ code: "KeyU", key: "u", ctrlKey: true }, "mac").shortcut, "MacCtrl+U");
assert.equal(shortcuts.fromKeyEvent({ code: "KeyU", key: "u", ctrlKey: true, shiftKey: true }, "other").shortcut, "Ctrl+Shift+U");
assert.equal(shortcuts.fromKeyEvent({ code: "KeyT", key: "t", ctrlKey: true }, "other").error, "reserved");
assert.equal(shortcuts.fromKeyEvent({ code: "KeyA", key: "a", shiftKey: true }, "other").error, "modifier");
assert.equal(shortcuts.fromKeyEvent({ code: "ShiftLeft", key: "Shift", shiftKey: true }, "other").error, "incomplete");

let updated = null;
const chromeApi = {
  commands: {
    getAll(cb) {
      cb([
        { name: "other", shortcut: "Ctrl+M" },
        { name: "cycle-mode", shortcut: "Alt+Shift+U" },
      ]);
    },
    update(detail, cb) {
      updated = detail;
      cb();
    },
  },
  runtime: { lastError: null },
  tabs: {
    create() {
      throw new Error("Cannot access a chrome:// URL");
    },
  },
};

let read = "";
shortcuts.readShortcut(chromeApi.commands, function (shortcut) {
  read = shortcut;
});
assert.equal(read, "Alt+Shift+U");

let saved = null;
shortcuts.writeShortcut(chromeApi, "shift+alt+k", function (result) {
  saved = result;
});
assert.equal(saved.ok, true);
assert.equal(saved.shortcut, "Alt+Shift+K");
assert.equal(updated.name, "cycle-mode");
assert.equal(updated.shortcut, "Alt+Shift+K");

updated = null;
let rejected = null;
shortcuts.writeShortcut(chromeApi, "Shift+K", function (result) {
  rejected = result;
});
assert.equal(rejected.ok, false);
assert.equal(rejected.error, "modifier");
assert.equal(updated, null);

chromeApi.runtime.lastError = { message: "Shortcut Ctrl+Shift+Y is reserved by Chrome." };
let chromeRejected = null;
shortcuts.writeShortcut(chromeApi, "Ctrl+Shift+Y", function (result) {
  chromeRejected = result;
});
assert.equal(chromeRejected.ok, false);
assert.equal(chromeRejected.error, "chrome");
assert.match(chromeRejected.message, /reserved by Chrome/);

let opened = null;
shortcuts.openShortcutsPage(chromeApi, function (result) {
  opened = result;
});
assert.equal(opened.ok, false);
assert.equal(opened.url, "chrome://extensions/shortcuts");

chromeApi.runtime.lastError = null;
chromeApi.tabs.create = function (_details, cb) {
  chromeApi.runtime.lastError = { message: "Cannot access a chrome:// URL" };
  cb();
};
opened = null;
shortcuts.openShortcutsPage(chromeApi, function (result) {
  opened = result;
});
assert.equal(opened.ok, false);
assert.equal(opened.url, "chrome://extensions/shortcuts");

const background = readFileSync(new URL("../src/background.js", import.meta.url), "utf8");
const content = readFileSync(new URL("../src/content.js", import.meta.url), "utf8");
const optionsJs = readFileSync(new URL("../src/options.js", import.meta.url), "utf8");
const optionsHtml = readFileSync(new URL("../src/options.html", import.meta.url), "utf8");
assert.match(background, /command !== "cycle-mode"/);
assert.match(content, /message\.type === "cycle-mode"/);
assert.match(optionsJs, /UbbShortcuts\.writeShortcut/);
assert.match(optionsJs, /language-search/);
assert.match(optionsHtml, /id="shortcut-capture"/);
assert.match(optionsHtml, /id="shortcut-save"/);
assert.match(optionsHtml, /id="shortcut-reset"/);
assert.match(optionsHtml, /id="shortcut-browser"/);
assert.match(optionsHtml, /id="language-search"/);
assert.match(optionsHtml, /src="shortcuts\.js"/);

console.log("shortcut tests passed");
