chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") }).catch(() => {});
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id) {
    return;
  }

  const type = command === "capture-selection" ? "captureSelection" : "togglePalette";
  chrome.tabs.sendMessage(tab.id, { type }).catch(() => {});
});
