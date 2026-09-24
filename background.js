const STORAGE_KEY = 'ubb-mode';
const MODES = ['original', 'crop', 'ambient'];

function normalizeMode(mode) {
  return MODES.includes(mode) ? mode : MODES[0];
}

function nextMode(mode) {
  const currentIndex = MODES.indexOf(normalizeMode(mode));
  return MODES[(currentIndex + 1) % MODES.length];
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ [STORAGE_KEY]: MODES[0] }, (items) => {
    chrome.storage.local.set({ [STORAGE_KEY]: normalizeMode(items[STORAGE_KEY]) });
  });
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'cycle-mode') {
    return;
  }

  chrome.storage.local.get({ [STORAGE_KEY]: MODES[0] }, (items) => {
    chrome.storage.local.set({ [STORAGE_KEY]: nextMode(items[STORAGE_KEY]) });
  });
});
