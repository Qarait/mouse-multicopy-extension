const STORAGE_KEY = "mouseMultiCopyState";
const DEFAULT_STATE = {
  enabled: true,
  maxSlots: 12,
  minChars: 3,
  ignoreDuplicates: true,
  currentPage: "",
  outputFormat: "numbered",
  includeSource: true,
  includePage: true,
  activeGroupId: "default",
  groups: [],
  clips: []
};

const elements = {
  enabled: document.getElementById("enabled"),
  summary: document.getElementById("summary"),
  highlights: document.getElementById("highlights"),
  emptyState: document.getElementById("emptyState"),
  message: document.getElementById("message"),
  currentPage: document.getElementById("currentPage"),
  copyAll: document.getElementById("copyAll"),
  outputFormat: document.getElementById("outputFormat"),
  includeSource: document.getElementById("includeSource"),
  includePage: document.getElementById("includePage"),
  capture: document.getElementById("capture"),
  clear: document.getElementById("clear"),
  maxSlots: document.getElementById("maxSlots"),
  minChars: document.getElementById("minChars"),
  ignoreDuplicates: document.getElementById("ignoreDuplicates"),
  groupSelect: document.getElementById("groupSelect"),
  newGroup: document.getElementById("newGroup"),
  renameGroup: document.getElementById("renameGroup"),
  deleteGroup: document.getElementById("deleteGroup"),
  slots: document.getElementById("slots")
};

document.addEventListener("DOMContentLoaded", renderFromStorage);
elements.enabled.addEventListener("change", updateEnabled);
elements.currentPage.addEventListener("change", updateCurrentPage);
elements.copyAll.addEventListener("click", copyAllHighlights);
elements.outputFormat.addEventListener("change", updateOutputSettings);
elements.includeSource.addEventListener("change", updateOutputSettings);
elements.includePage.addEventListener("change", updateOutputSettings);
elements.maxSlots.addEventListener("change", updateMaxSlots);
elements.minChars.addEventListener("change", updateMinChars);
elements.ignoreDuplicates.addEventListener("change", updateIgnoreDuplicates);
elements.capture.addEventListener("click", captureSelection);
elements.clear.addEventListener("click", clearClips);
elements.groupSelect.addEventListener("change", switchGroup);
elements.newGroup.addEventListener("click", createGroup);
elements.renameGroup.addEventListener("click", renameActiveGroup);
elements.deleteGroup.addEventListener("click", deleteActiveGroup);

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
  const count = normalized.clips.length;
  elements.enabled.checked = normalized.enabled;
  elements.currentPage.value = normalized.currentPage;
  elements.outputFormat.value = normalized.outputFormat;
  elements.includeSource.checked = normalized.includeSource;
  elements.includePage.checked = normalized.includePage;
  elements.maxSlots.value = normalized.maxSlots;
  elements.minChars.value = normalized.minChars;
  elements.ignoreDuplicates.checked = normalized.ignoreDuplicates;
  elements.summary.textContent = count
    ? `${count} saved highlight${count === 1 ? "" : "s"} in ${normalized.activeGroup.name}`
    : "No highlights saved";
  elements.copyAll.disabled = count === 0;
  elements.emptyState.hidden = count > 0;
  elements.deleteGroup.disabled = normalized.groups.length <= 1;
  renderGroups(normalized);
  renderHighlights(normalized);
  renderSlots(normalized);
}

function renderHighlights(state) {
  elements.highlights.replaceChildren();

  state.clips.forEach((clip, index) => {
    const row = document.createElement("article");
    row.className = "highlight";

    const number = document.createElement("span");
    number.className = "highlight-number";
    number.textContent = index + 1;

    const copy = document.createElement("div");
    copy.className = "highlight-copy";
    copy.textContent = clip.text;

    const meta = document.createElement("span");
    meta.className = "highlight-meta";
    meta.textContent = clip.label || clip.title || "Saved highlight";
    copy.append(meta);

    const page = document.createElement("input");
    page.className = "clip-page";
    page.type = "text";
    page.maxLength = 40;
    page.placeholder = "Page";
    page.value = clip.page;
    page.setAttribute("aria-label", `Page for highlight ${index + 1}`);
    page.addEventListener("change", () => updateClipPage(index, page.value));

    row.append(number, copy, page);
    elements.highlights.append(row);
  });
}

function renderGroups(state) {
  elements.groupSelect.replaceChildren();
  for (const group of state.groups) {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    option.selected = group.id === state.activeGroupId;
    elements.groupSelect.append(option);
  }
}

function renderSlots(state) {
  elements.slots.replaceChildren();

  state.clips.forEach((clip, index) => {
    const row = document.createElement("article");
    row.className = "slot";
    row.draggable = true;
    row.dataset.index = index;

    const handle = document.createElement("div");
    handle.className = "slot-handle";
    handle.textContent = "::";
    handle.title = "Drag to reorder";

    const number = document.createElement("div");
    number.className = "slot-number";
    number.textContent = index + 1;

    const body = document.createElement("div");
    body.className = "slot-body";

    const label = document.createElement("button");
    label.className = "slot-label";
    label.type = "button";
    label.textContent = clip.label || `Highlight ${index + 1}`;
    label.title = "Double-click to rename";
    label.addEventListener("dblclick", () => renameClip(index));

    const text = document.createElement("div");
    text.className = "slot-text";
    text.textContent = clip.text;
    body.append(label, text);

    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy";
    copy.addEventListener("click", () => copyClip(index));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Del";
    remove.addEventListener("click", () => deleteClip(index));

    row.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
      row.classList.add("slot-dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("slot-dragging"));
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      reorderClip(Number(event.dataTransfer.getData("text/plain")), index);
    });

    row.append(handle, number, body, copy, remove);
    elements.slots.append(row);
  });
}

async function updateEnabled() {
  const state = await getState();
  await setState({ ...state, enabled: elements.enabled.checked });
  showMessage(elements.enabled.checked ? "Collection is on." : "Collection is paused.");
}

async function updateCurrentPage() {
  const state = await getState();
  const currentPage = elements.currentPage.value.trim().slice(0, 40);
  await setState({ ...state, currentPage });
  showMessage(currentPage ? `New highlights will use page ${currentPage}.` : "Page number cleared.");
}

async function updateOutputSettings() {
  const state = await getState();
  await setState({
    ...state,
    outputFormat: elements.outputFormat.value,
    includeSource: elements.includeSource.checked,
    includePage: elements.includePage.checked
  });
  showMessage("Copy format updated.");
}

async function updateClipPage(index, value) {
  const state = await getState();
  if (!isValidClipIndex(state.clips, index)) {
    return;
  }
  const page = String(value || "").trim().slice(0, 40);
  const clips = state.clips.map((clip, clipIndex) => clipIndex === index ? { ...clip, page } : clip);
  await setState({ ...state, clips });
  showMessage(page ? `Highlight ${index + 1} set to page ${page}.` : `Page cleared for highlight ${index + 1}.`);
}

async function copyAllHighlights() {
  const state = await getState();
  const text = formatClips(state.clips, state);
  if (!text) {
    showMessage("Start by highlighting text on a webpage.");
    return;
  }
  await navigator.clipboard.writeText(text);
  showMessage(`Copied ${state.clips.length} highlight${state.clips.length === 1 ? "" : "s"} - paste anywhere.`);
}

async function updateMaxSlots() {
  const state = await getState();
  const maxSlots = clampNumber(elements.maxSlots.value, state.maxSlots, 3, 50);
  await setState({ ...state, maxSlots });
  showMessage(`Highlight limit set to ${maxSlots}.`);
}

async function updateMinChars() {
  const state = await getState();
  const minChars = clampNumber(elements.minChars.value, state.minChars, 1, 40);
  await setState({ ...state, minChars });
  showMessage(`Minimum capture length set to ${minChars}.`);
}

async function updateIgnoreDuplicates() {
  const state = await getState();
  await setState({ ...state, ignoreDuplicates: elements.ignoreDuplicates.checked });
  showMessage(elements.ignoreDuplicates.checked ? "Duplicate protection is on." : "Duplicate protection is off.");
}

async function captureSelection() {
  const response = await sendToActiveTab({ type: "captureSelection" });
  showMessage(response?.ok ? "Selected text captured." : "Select text on the page first.");
}

async function copyClip(index) {
  const state = await getState();
  const clip = state.clips[index];
  if (!clip) {
    return;
  }
  await navigator.clipboard.writeText(clip.text);
  showMessage(`Copied highlight ${index + 1}.`);
}

async function renameClip(index) {
  const state = await getState();
  const clip = state.clips[index];
  if (!clip) {
    return;
  }
  const label = window.prompt(`Name highlight ${index + 1}`, clip.label || "");
  if (label === null) {
    return;
  }
  const clips = state.clips.map((item, clipIndex) => clipIndex === index
    ? { ...item, label: label.trim().slice(0, 60) }
    : item);
  await setState({ ...state, clips });
  showMessage(clips[index].label ? `Named highlight ${index + 1}.` : `Cleared highlight ${index + 1} name.`);
}

async function deleteClip(index) {
  const state = await getState();
  if (!isValidClipIndex(state.clips, index)) {
    return;
  }
  await setState({ ...state, clips: state.clips.filter((_clip, clipIndex) => clipIndex !== index) });
  showMessage(`Deleted highlight ${index + 1}.`);
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
  showMessage(`Moved highlight ${fromIndex + 1} to ${toIndex + 1}.`);
}

async function clearClips() {
  const state = await getState();
  await setState({ ...state, clips: [] });
  showMessage(`Cleared ${state.activeGroup.name}.`);
}

async function switchGroup() {
  const state = await getState();
  const activeGroup = state.groups.find((group) => group.id === elements.groupSelect.value);
  if (!activeGroup) {
    return;
  }
  await setState({ ...state, activeGroupId: activeGroup.id, clips: activeGroup.clips });
  showMessage(`Switched to ${activeGroup.name}.`);
}

async function createGroup() {
  const state = await getState();
  const name = window.prompt("New session name", `Session ${state.groups.length + 1}`);
  if (name === null) {
    return;
  }
  const group = {
    id: createGroupId(Date.now()),
    name: name.trim().slice(0, 40) || `Session ${state.groups.length + 1}`,
    clips: []
  };
  await setState({ ...state, activeGroupId: group.id, groups: [...state.groups, group], clips: [] });
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
  await setState({ ...state, activeGroupId: groups[0].id, groups, clips: groups[0].clips });
  showMessage(`Deleted ${state.activeGroup.name}.`);
}

async function sendToActiveTab(messageBody) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
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
    currentPage: String(state?.currentPage || "").trim().slice(0, 40),
    outputFormat: ["numbered", "bullets", "plain"].includes(state?.outputFormat)
      ? state.outputFormat
      : DEFAULT_STATE.outputFormat,
    includeSource: typeof state?.includeSource === "boolean" ? state.includeSource : DEFAULT_STATE.includeSource,
    includePage: typeof state?.includePage === "boolean" ? state.includePage : DEFAULT_STATE.includePage,
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
        page: String(clip.page || "").trim().slice(0, 40),
        capturedAt: clip.capturedAt || 0
      }))
    : [];
}

function formatClips(clips, state) {
  return clips.map((clip, index) => {
    const sourceParts = [];
    if (state.includeSource && clip.title) {
      sourceParts.push(clip.title);
    }
    if (state.includeSource && clip.url) {
      sourceParts.push(clip.url);
    }
    const page = state.includePage && clip.page ? ` (page ${clip.page})` : "";
    const source = sourceParts.length ? `\n   Source: ${sourceParts.join(" | ")}` : "";
    if (state.outputFormat === "plain") {
      return `${clip.text}${page}${source}`;
    }
    if (state.outputFormat === "bullets") {
      return `- ${clip.text}${page}${source}`;
    }
    return `${index + 1}. ${clip.text}${page}${source}`;
  }).join("\n\n");
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
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
  elements.message.textContent = text;
}
