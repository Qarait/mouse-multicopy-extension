const STORAGE_KEY = "mouseMultiCopyState";

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") }).catch(() => {});
  }
  updateBadge();
});

chrome.runtime.onStartup.addListener(updateBadge);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    updateBadge(changes[STORAGE_KEY].newValue);
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

async function updateBadge(nextState) {
  const state = nextState || (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
  const groups = Array.isArray(state?.groups) ? state.groups : [];
  const activeGroup = groups.find((group) => group.id === state?.activeGroupId);
  const clips = activeGroup && Array.isArray(activeGroup.clips)
    ? activeGroup.clips
    : (Array.isArray(state?.clips) ? state.clips : []);
  const count = clips.length;

  await chrome.action.setBadgeBackgroundColor({ color: "#166534" });
  await chrome.action.setBadgeText({ text: count ? String(Math.min(count, 99)) : "" });
  await chrome.action.setTitle({
    title: count
      ? `Mouse MultiCopy - ${count} saved highlight${count === 1 ? "" : "s"}`
      : "Mouse MultiCopy"
  });
}
