const STORAGE_KEY = "mouseMultiCopyState";
const DEFAULT_STATE = {
  enabled: true,
  maxSlots: 12,
  minChars: 3,
  ignoreDuplicates: true,
  clips: []
};

const enabledInput = document.getElementById("enabled");
const summary = document.getElementById("summary");
const slots = document.getElementById("slots");
const message = document.getElementById("message");
const captureButton = document.getElementById("capture");
const clearButton = document.getElementById("clear");
const maxSlotsInput = document.getElementById("maxSlots");
const minCharsInput = document.getElementById("minChars");
const ignoreDuplicatesInput = document.getElementById("ignoreDuplicates");

document.addEventListener("DOMContentLoaded", renderFromStorage);
enabledInput.addEventListener("change", updateEnabled);
maxSlotsInput.addEventListener("change", updateMaxSlots);
minCharsInput.addEventListener("change", updateMinChars);
ignoreDuplicatesInput.addEventListener("change", updateIgnoreDuplicates);
captureButton.addEventListener("click", captureSelection);
clearButton.addEventListener("click", clearClips);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    render(normalizeState(changes[STORAGE_KEY].newValue));
  }
});

async function renderFromStorage() {
  render(await getState());
}

function render(state) {
  const normalized = normalizeState(state);
  enabledInput.checked = normalized.enabled;
  maxSlotsInput.value = normalized.maxSlots;
  minCharsInput.value = normalized.minChars;
  ignoreDuplicatesInput.checked = normalized.ignoreDuplicates;
  summary.textContent = `${normalized.clips.length} of ${normalized.maxSlots} slots used`;
  slots.replaceChildren();

  for (let index = 0; index < normalized.maxSlots; index += 1) {
    const clip = normalized.clips[index];
    const row = document.createElement("article");
    row.className = "slot";

    const number = document.createElement("div");
    number.className = "slot-number";
    number.textContent = index + 1;

    const text = document.createElement("div");
    text.className = `slot-text${clip ? "" : " slot-empty"}`;
    text.textContent = clip ? clip.text : "Empty";

    const paste = document.createElement("button");
    paste.type = "button";
    paste.textContent = "Paste";
    paste.disabled = !clip;
    paste.addEventListener("click", () => pasteClip(index));

    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy";
    copy.disabled = !clip;
    copy.addEventListener("click", () => copyClip(index));

    const remove = document.createElement("button");
    remove.className = "delete";
    remove.type = "button";
    remove.textContent = "Del";
    remove.disabled = !clip;
    remove.addEventListener("click", () => deleteClip(index));

    row.append(number, text, paste, copy, remove);
    slots.append(row);
  }
}

async function updateEnabled() {
  const state = await getState();
  await setState({ ...state, enabled: enabledInput.checked });
  showMessage(enabledInput.checked ? "Collect mode is on." : "Collect mode is paused.");
}

async function updateMaxSlots() {
  const state = await getState();
  const maxSlots = clampNumber(maxSlotsInput.value, state.maxSlots, 3, 50);
  await setState({ ...state, maxSlots });
  showMessage(`Quick slots set to ${maxSlots}.`);
}

async function updateMinChars() {
  const state = await getState();
  const minChars = clampNumber(minCharsInput.value, state.minChars, 1, 40);
  await setState({ ...state, minChars });
  showMessage(`Minimum capture length set to ${minChars}.`);
}

async function updateIgnoreDuplicates() {
  const state = await getState();
  await setState({ ...state, ignoreDuplicates: ignoreDuplicatesInput.checked });
  showMessage(ignoreDuplicatesInput.checked ? "Duplicate protection is on." : "Duplicate protection is off.");
}

async function captureSelection() {
  const response = await sendToActiveTab({ type: "captureSelection" });
  showMessage(response?.ok ? "Captured selected text." : "Select text on the page first.");
}

async function pasteClip(index) {
  const response = await sendToActiveTab({ type: "pasteClip", index });
  showMessage(response?.ok ? `Pasted slot ${index + 1}.` : "Focus a text box on the page first.");
}

async function copyClip(index) {
  const state = await getState();
  const clip = state.clips[index];

  if (!clip) {
    return;
  }

  await navigator.clipboard.writeText(clip.text);
  showMessage(`Copied slot ${index + 1}.`);
}

async function deleteClip(index) {
  const state = await getState();
  if (index < 0 || index >= state.clips.length) {
    return;
  }

  const clips = state.clips.filter((_clip, clipIndex) => clipIndex !== index);
  await setState({ ...state, clips });
  showMessage(`Deleted slot ${index + 1}.`);
}

async function clearClips() {
  const state = await getState();
  await setState({ ...state, clips: [] });
  showMessage("Cleared all slots.");
}

async function sendToActiveTab(messageBody) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    return { ok: false };
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, messageBody);
  } catch (_error) {
    return { ok: false };
  }
}

async function getState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeState(stored[STORAGE_KEY]);
}

async function setState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: normalizeState(state) });
}

function normalizeState(state) {
  const maxSlots = clampNumber(state?.maxSlots, DEFAULT_STATE.maxSlots, 3, 50);
  const minChars = clampNumber(state?.minChars, DEFAULT_STATE.minChars, 1, 40);
  const clips = Array.isArray(state?.clips)
    ? state.clips.filter((clip) => clip && typeof clip.text === "string" && clip.text.trim()).slice(-maxSlots)
    : [];

  return {
    enabled: typeof state?.enabled === "boolean" ? state.enabled : DEFAULT_STATE.enabled,
    maxSlots,
    minChars,
    ignoreDuplicates: typeof state?.ignoreDuplicates === "boolean" ? state.ignoreDuplicates : DEFAULT_STATE.ignoreDuplicates,
    clips
  };
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(number)));
}

function showMessage(text) {
  message.textContent = text;
}
