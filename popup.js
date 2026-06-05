const STORAGE_KEY = "mouseMultiCopyState";
const DEFAULT_STATE = {
  enabled: true,
  maxSlots: 12,
  minChars: 3,
  ignoreDuplicates: true,
  activeGroupId: "default",
  groups: [],
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
const groupSelect = document.getElementById("groupSelect");
const newGroupButton = document.getElementById("newGroup");
const renameGroupButton = document.getElementById("renameGroup");
const deleteGroupButton = document.getElementById("deleteGroup");

document.addEventListener("DOMContentLoaded", renderFromStorage);
enabledInput.addEventListener("change", updateEnabled);
maxSlotsInput.addEventListener("change", updateMaxSlots);
minCharsInput.addEventListener("change", updateMinChars);
ignoreDuplicatesInput.addEventListener("change", updateIgnoreDuplicates);
captureButton.addEventListener("click", captureSelection);
clearButton.addEventListener("click", clearClips);
groupSelect.addEventListener("change", switchGroup);
newGroupButton.addEventListener("click", createGroup);
renameGroupButton.addEventListener("click", renameActiveGroup);
deleteGroupButton.addEventListener("click", deleteActiveGroup);

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
  summary.textContent = `${normalized.activeGroup.name}: ${normalized.clips.length} of ${normalized.maxSlots} slots used`;
  deleteGroupButton.disabled = normalized.groups.length <= 1;
  renderGroups(normalized);
  renderSlots(normalized);
}

function renderGroups(state) {
  groupSelect.replaceChildren();
  for (const group of state.groups) {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    option.selected = group.id === state.activeGroupId;
    groupSelect.append(option);
  }
}

function renderSlots(state) {
  slots.replaceChildren();

  for (let index = 0; index < state.maxSlots; index += 1) {
    const clip = state.clips[index];
    const row = document.createElement("article");
    row.className = `slot${clip ? "" : " slot-empty-row"}`;
    row.draggable = Boolean(clip);
    row.dataset.index = index;

    const handle = document.createElement("div");
    handle.className = "slot-handle";
    handle.textContent = "::";
    handle.title = clip ? "Drag to reorder" : "";

    const number = document.createElement("div");
    number.className = "slot-number";
    number.textContent = index + 1;

    const body = document.createElement("div");
    body.className = "slot-body";

    const label = document.createElement("button");
    label.className = "slot-label";
    label.type = "button";
    label.textContent = clip ? (clip.label || `Slot ${index + 1}`) : `Slot ${index + 1}`;
    label.disabled = !clip;
    label.title = clip ? "Double-click to rename" : "";
    label.addEventListener("dblclick", () => renameClip(index));

    const text = document.createElement("div");
    text.className = `slot-text${clip ? "" : " slot-empty"}`;
    text.textContent = clip ? clip.text : "Empty";

    body.append(label, text);

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

    row.addEventListener("dragstart", (event) => {
      if (!clip) {
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
      row.classList.add("slot-dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("slot-dragging"));
    row.addEventListener("dragover", (event) => {
      if (!clip) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      const fromIndex = Number(event.dataTransfer.getData("text/plain"));
      reorderClip(fromIndex, index);
    });

    row.append(handle, number, body, paste, copy, remove);
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

async function renameClip(index) {
  const state = await getState();
  const clip = state.clips[index];
  if (!clip) {
    return;
  }

  const label = window.prompt(`Name slot ${index + 1}`, clip.label || "");
  if (label === null) {
    return;
  }

  const clips = state.clips.map((item, clipIndex) => clipIndex === index
    ? { ...item, label: label.trim().slice(0, 60) }
    : item);
  await setState({ ...state, clips });
  await sendToActiveTab({ type: "renameClip", index, label });
  showMessage(clips[index].label ? `Renamed slot ${index + 1}.` : `Cleared slot ${index + 1} name.`);
}

async function deleteClip(index) {
  const state = await getState();
  if (!isValidClipIndex(state.clips, index)) {
    return;
  }

  const clips = state.clips.filter((_clip, clipIndex) => clipIndex !== index);
  await setState({ ...state, clips });
  showMessage(`Deleted slot ${index + 1}.`);
}

async function reorderClip(fromIndex, toIndex) {
  const state = await getState();
  if (!isValidClipIndex(state.clips, fromIndex) || !isValidClipIndex(state.clips, toIndex) || fromIndex === toIndex) {
    return;
  }

  const clips = [...state.clips];
  const [clip] = clips.splice(fromIndex, 1);
  clips.splice(toIndex, 0, clip);
  await setState({ ...state, clips });
  await sendToActiveTab({ type: "reorderClip", fromIndex, toIndex });
  showMessage(`Moved slot ${fromIndex + 1} to ${toIndex + 1}.`);
}

async function clearClips() {
  const state = await getState();
  await setState({ ...state, clips: [] });
  showMessage(`Cleared ${state.activeGroup.name}.`);
}

async function switchGroup() {
  const state = await getState();
  const activeGroupId = groupSelect.value;
  const activeGroup = state.groups.find((group) => group.id === activeGroupId);
  if (!activeGroup) {
    return;
  }

  await setState({ ...state, activeGroupId, clips: activeGroup.clips });
  showMessage(`Switched to ${activeGroup.name}.`);
}

async function createGroup() {
  const state = await getState();
  const name = window.prompt("New session name", `Session ${state.groups.length + 1}`);
  if (name === null) {
    return;
  }

  const trimmedName = name.trim().slice(0, 40) || `Session ${state.groups.length + 1}`;
  const group = {
    id: createGroupId(Date.now()),
    name: trimmedName,
    clips: []
  };
  await setState({
    ...state,
    activeGroupId: group.id,
    groups: [...state.groups, group],
    clips: []
  });
  showMessage(`Created ${group.name}.`);
}

async function renameActiveGroup() {
  const state = await getState();
  const name = window.prompt("Rename session", state.activeGroup.name);
  if (name === null) {
    return;
  }

  const trimmedName = name.trim().slice(0, 40) || state.activeGroup.name;
  const groups = state.groups.map((group) => group.id === state.activeGroupId
    ? { ...group, name: trimmedName }
    : group);
  await setState({ ...state, groups, clips: state.clips });
  showMessage(`Renamed session to ${trimmedName}.`);
}

async function deleteActiveGroup() {
  const state = await getState();
  if (state.groups.length <= 1) {
    showMessage("Keep at least one session.");
    return;
  }

  if (!window.confirm(`Delete session "${state.activeGroup.name}"?`)) {
    return;
  }

  const groups = state.groups.filter((group) => group.id !== state.activeGroupId);
  const activeGroup = groups[0];
  await setState({
    ...state,
    activeGroupId: activeGroup.id,
    groups,
    clips: activeGroup.clips
  });
  showMessage(`Deleted ${state.activeGroup.name}.`);
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
  const groups = normalizeGroups(state, maxSlots);
  const activeGroupId = groups.some((group) => group.id === state?.activeGroupId)
    ? state.activeGroupId
    : groups[0].id;
  const normalizedGroups = groups.map((group) => group.id === activeGroupId && Array.isArray(state?.clips)
    ? { ...group, clips: normalizeClips(state.clips, maxSlots) }
    : group);
  const activeGroup = normalizedGroups.find((group) => group.id === activeGroupId) || normalizedGroups[0];

  return {
    enabled: typeof state?.enabled === "boolean" ? state.enabled : DEFAULT_STATE.enabled,
    maxSlots,
    minChars,
    ignoreDuplicates: typeof state?.ignoreDuplicates === "boolean" ? state.ignoreDuplicates : DEFAULT_STATE.ignoreDuplicates,
    activeGroupId,
    activeGroup,
    groups: normalizedGroups,
    clips: activeGroup.clips
  };
}

function normalizeGroups(state, maxSlots) {
  const storedGroups = Array.isArray(state?.groups) ? state.groups : [];
  const groups = storedGroups
    .filter((group) => group && typeof group === "object")
    .map((group, index) => ({
      id: String(group.id || createGroupId(index)),
      name: String(group.name || `Session ${index + 1}`).trim().slice(0, 40) || `Session ${index + 1}`,
      clips: normalizeClips(group.clips, maxSlots)
    }))
    .filter((group) => group.id && group.name);

  if (groups.length) {
    return groups;
  }

  return [{
    id: DEFAULT_STATE.activeGroupId,
    name: "Default",
    clips: normalizeClips(state?.clips, maxSlots)
  }];
}

function normalizeClips(clips, maxSlots) {
  return Array.isArray(clips)
    ? clips
      .filter((clip) => clip && typeof clip.text === "string" && clip.text.trim())
      .slice(-maxSlots)
      .map((clip, index) => ({
        id: clip.id || createClipId(clip.capturedAt || index),
        text: clip.text,
        label: String(clip.label || "").trim().slice(0, 60),
        title: clip.title || "",
        url: clip.url || "",
        capturedAt: clip.capturedAt || 0
      }))
    : [];
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(number)));
}

function createClipId(seed) {
  return `${seed}-${Math.random().toString(36).slice(2, 10)}`;
}

function createGroupId(seed) {
  return `group-${seed}-${Math.random().toString(36).slice(2, 10)}`;
}

function isValidClipIndex(clips, index) {
  return Number.isInteger(index) && index >= 0 && index < clips.length;
}

function showMessage(text) {
  message.textContent = text;
}
