(function (root) {
  var COMMAND_NAME = "cycle-mode";
  var DEFAULT_SHORTCUT = "Alt+Shift+U";
  var BROWSER_SHORTCUTS_URL = "chrome://extensions/shortcuts";

  var MODIFIER_ORDER = ["Ctrl", "Command", "MacCtrl", "Search", "Alt", "Shift"];
  var PRIMARY = { Ctrl: true, Alt: true, Command: true, MacCtrl: true, Search: true };
  var MEDIA = {
    MediaNextTrack: true,
    MediaPlayPause: true,
    MediaPrevTrack: true,
    MediaStop: true,
  };
  var NAMED_KEYS = {
    comma: "Comma",
    ".": "Period",
    period: "Period",
    home: "Home",
    end: "End",
    pageup: "PageUp",
    pagedown: "PageDown",
    space: "Space",
    insert: "Insert",
    delete: "Delete",
    del: "Delete",
    up: "Up",
    down: "Down",
    left: "Left",
    right: "Right",
    arrowup: "Up",
    arrowdown: "Down",
    arrowleft: "Left",
    arrowright: "Right",
    medianexttrack: "MediaNextTrack",
    mediaplaypause: "MediaPlayPause",
    mediaprevtrack: "MediaPrevTrack",
    mediastop: "MediaStop",
  };
  NAMED_KEYS[","] = "Comma";
  NAMED_KEYS[" "] = "Space";

  var RESERVED = {
    "Ctrl+N": true,
    "Ctrl+T": true,
    "Ctrl+W": true,
    "Ctrl+Q": true,
    "Ctrl+Shift+N": true,
    "Ctrl+Shift+T": true,
    "Ctrl+Shift+W": true,
    "Ctrl+Shift+Q": true,
    "Ctrl+PageUp": true,
    "Ctrl+PageDown": true,
    "Ctrl+1": true,
    "Ctrl+2": true,
    "Ctrl+3": true,
    "Ctrl+4": true,
    "Ctrl+5": true,
    "Ctrl+6": true,
    "Ctrl+7": true,
    "Ctrl+8": true,
    "Ctrl+9": true,
    "Command+N": true,
    "Command+T": true,
    "Command+W": true,
    "Command+Q": true,
    "Command+Shift+N": true,
    "Command+Shift+T": true,
    "Command+Shift+W": true,
    "Command+Shift+Q": true,
    "Alt+Left": true,
    "Alt+Right": true,
  };

  function detectPlatform() {
    var platform = "";
    if (typeof navigator !== "undefined" && navigator.platform) platform = String(navigator.platform);
    return /Mac|iPhone|iPad/i.test(platform) ? "mac" : "other";
  }

  function modifierToken(token) {
    var name = String(token || "").replace(/\s+/g, "").toLowerCase();
    if (name === "ctrl" || name === "control") return "Ctrl";
    if (name === "alt" || name === "option" || name === "opt") return "Alt";
    if (name === "shift") return "Shift";
    if (name === "command" || name === "cmd" || name === "meta") return "Command";
    if (name === "macctrl") return "MacCtrl";
    if (name === "search") return "Search";
    return "";
  }

  function keyToken(token) {
    var raw = String(token || "").trim();
    if (!raw) return "";
    if (/^[a-z]$/i.test(raw)) return raw.toUpperCase();
    if (/^[0-9]$/.test(raw)) return raw;
    var named = NAMED_KEYS[raw.toLowerCase()];
    if (named) return named;
    if (MEDIA[raw]) return raw;
    return "";
  }

  function finish(modifiers, key) {
    if (!key) return { ok: false, error: "key" };
    if (modifiers.Ctrl && modifiers.Alt) return { ok: false, error: "ctrl-alt" };
    var parts = [];
    for (var i = 0; i < MODIFIER_ORDER.length; i++) {
      if (modifiers[MODIFIER_ORDER[i]]) parts.push(MODIFIER_ORDER[i]);
    }
    var primary = false;
    for (var name in PRIMARY) {
      if (modifiers[name]) primary = true;
    }
    if (!primary && !MEDIA[key]) return { ok: false, error: "modifier" };
    parts.push(key);
    var shortcut = parts.join("+");
    if (RESERVED[shortcut]) return { ok: false, error: "reserved" };
    return { ok: true, shortcut: shortcut };
  }

  function normalizeShortcut(input) {
    var text = String(input == null ? "" : input).trim();
    if (!text) return { ok: false, error: "empty" };
    var tokens = text.split("+");
    var modifiers = {};
    var key = "";
    for (var i = 0; i < tokens.length; i++) {
      var piece = tokens[i].trim();
      if (!piece) return { ok: false, error: "key" };
      var modifier = modifierToken(piece);
      if (modifier && i < tokens.length - 1) {
        modifiers[modifier] = true;
        continue;
      }
      if (i !== tokens.length - 1) return { ok: false, error: "key" };
      key = keyToken(piece);
    }
    return finish(modifiers, key);
  }

  function fromKeyEvent(event, platform) {
    var ev = event || {};
    var code = ev.code || "";
    if (
      code === "ShiftLeft" ||
      code === "ShiftRight" ||
      code === "ControlLeft" ||
      code === "ControlRight" ||
      code === "AltLeft" ||
      code === "AltRight" ||
      code === "MetaLeft" ||
      code === "MetaRight" ||
      code === "OSLeft" ||
      code === "OSRight"
    ) {
      return { ok: false, error: "incomplete" };
    }
    var which = platform || detectPlatform();
    var modifiers = {};
    if (ev.metaKey) modifiers.Command = true;
    if (ev.ctrlKey) modifiers[which === "mac" ? "MacCtrl" : "Ctrl"] = true;
    if (ev.altKey) modifiers.Alt = true;
    if (ev.shiftKey) modifiers.Shift = true;
    var key = "";
    if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
    else if (/^Digit[0-9]$/.test(code)) key = code.slice(5);
    else if (/^Numpad[0-9]$/.test(code)) key = code.slice(6);
    else if (code === "Comma") key = "Comma";
    else if (code === "Period") key = "Period";
    else if (code === "Space") key = "Space";
    else if (code === "Home") key = "Home";
    else if (code === "End") key = "End";
    else if (code === "PageUp") key = "PageUp";
    else if (code === "PageDown") key = "PageDown";
    else if (code === "Insert") key = "Insert";
    else if (code === "Delete") key = "Delete";
    else if (code === "ArrowUp") key = "Up";
    else if (code === "ArrowDown") key = "Down";
    else if (code === "ArrowLeft") key = "Left";
    else if (code === "ArrowRight") key = "Right";
    else if (code === "MediaTrackNext") key = "MediaNextTrack";
    else if (code === "MediaPlayPause") key = "MediaPlayPause";
    else if (code === "MediaTrackPrevious") key = "MediaPrevTrack";
    else if (code === "MediaStop") key = "MediaStop";
    else key = keyToken(ev.key);
    return finish(modifiers, key);
  }

  function readShortcut(commands, callback) {
    commands.getAll(function (list) {
      var items = list || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i] && items[i].name === COMMAND_NAME) {
          callback(items[i].shortcut || "");
          return;
        }
      }
      callback("");
    });
  }

  function writeShortcut(chromeApi, shortcut, callback) {
    var parsed = normalizeShortcut(shortcut);
    if (!parsed.ok) {
      callback({ ok: false, error: parsed.error });
      return;
    }
    var settled = false;
    function finishWrite(result) {
      if (settled) return;
      settled = true;
      callback(result);
    }
    try {
      var pending = chromeApi.commands.update(
        { name: COMMAND_NAME, shortcut: parsed.shortcut },
        function () {
          var err = chromeApi.runtime && chromeApi.runtime.lastError;
          if (err) finishWrite({ ok: false, error: "chrome", message: String(err.message || "") });
          else finishWrite({ ok: true, shortcut: parsed.shortcut });
        }
      );
      if (pending && typeof pending.then === "function") {
        pending.then(
          function () {
            finishWrite({ ok: true, shortcut: parsed.shortcut });
          },
          function (err) {
            finishWrite({
              ok: false,
              error: "chrome",
              message: err && err.message ? String(err.message) : "",
            });
          }
        );
      }
    } catch (err) {
      finishWrite({
        ok: false,
        error: "chrome",
        message: err && err.message ? String(err.message) : "",
      });
    }
  }

  function openShortcutsPage(chromeApi, callback) {
    var settled = false;
    function finishOpen(result) {
      if (settled) return;
      settled = true;
      callback(result);
    }
    function fail() {
      finishOpen({ ok: false, url: BROWSER_SHORTCUTS_URL });
    }
    try {
      if (!chromeApi || !chromeApi.tabs || typeof chromeApi.tabs.create !== "function") {
        fail();
        return;
      }
      var pending = chromeApi.tabs.create({ url: BROWSER_SHORTCUTS_URL }, function () {
        var err = chromeApi.runtime && chromeApi.runtime.lastError;
        if (err) fail();
        else finishOpen({ ok: true, url: BROWSER_SHORTCUTS_URL });
      });
      if (pending && typeof pending.then === "function") {
        pending.then(function () {
          finishOpen({ ok: true, url: BROWSER_SHORTCUTS_URL });
        }, fail);
      }
    } catch (err) {
      fail();
    }
  }

  root.UbbShortcuts = {
    COMMAND_NAME: COMMAND_NAME,
    DEFAULT_SHORTCUT: DEFAULT_SHORTCUT,
    BROWSER_SHORTCUTS_URL: BROWSER_SHORTCUTS_URL,
    normalizeShortcut: normalizeShortcut,
    fromKeyEvent: fromKeyEvent,
    readShortcut: readShortcut,
    writeShortcut: writeShortcut,
    openShortcutsPage: openShortcutsPage,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
