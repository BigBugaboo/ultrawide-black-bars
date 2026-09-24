const STORAGE_KEY = 'ubb-mode';
const MODES = ['original', 'crop', 'ambient'];

function normalizeMode(mode) {
  return MODES.includes(mode) ? mode : MODES[0];
}

function updateSelection(mode) {
  const activeMode = normalizeMode(mode);
  for (const input of document.querySelectorAll('input[name="mode"]')) {
    input.checked = input.value === activeMode;
  }
}

chrome.storage.local.get({ [STORAGE_KEY]: MODES[0] }, (items) => {
  updateSelection(items[STORAGE_KEY]);
});

for (const input of document.querySelectorAll('input[name="mode"]')) {
  input.addEventListener('change', () => {
    if (!input.checked) {
      return;
    }

    chrome.storage.local.set({ [STORAGE_KEY]: normalizeMode(input.value) });
  });
}
