(() => {
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

  let widget;
  let panel;
  let toggleButton;
  let statusNode;
  let slotsNode;
  let toastNode;
  let toastMessageNode;
  let undoButton;
  let enabledButton;
  let lastEditable = null;
  let lastCaptured = { text: "", at: 0 };
  let lastUndoClipId = null;
  let captureTimer = null;
  let toastTimer = null;

  init();

  async function init() {
    buildWidget();
    await renderFromState();

    document.addEventListener("mouseup", scheduleSelectionCapture, true);
    document.addEventListener("keyup", (event) => {
      if (event.key === "Shift" || event.key.startsWith("Arrow")) {
        scheduleSelectionCapture(event);
      }
    }, true);
    document.addEventListener("focusin", rememberEditable, true);
    document.addEventListener("pointerdown", rememberEditable, true);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[STORAGE_KEY]) {
        render(changes[STORAGE_KEY].newValue || DEFAULT_STATE);
      }
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      handleMessage(message).then(sendResponse);
      return true;
    });
  }

  function buildWidget() {
    if (document.getElementById("mmc-widget")) {
      widget = document.getElementById("mmc-widget");
      return;
    }

    widget = document.createElement("div");
    widget.id = "mmc-widget";
    widget.innerHTML = `
      <div id="mmc-toast" role="status" aria-live="polite">
        <span id="mmc-toast-message"></span>
        <button id="mmc-undo" type="button">Undo</button>
      </div>
      <div id="mmc-panel" aria-label="Mouse MultiCopy slots">
        <div id="mmc-header">
          <div id="mmc-title">Mouse MultiCopy</div>
          <div id="mmc-status">0 / 12</div>
        </div>
        <div id="mmc-slots"></div>
        <div id="mmc-actions">
          <button class="mmc-action" id="mmc-enabled" type="button">Pause</button>
          <button class="mmc-action" id="mmc-copy-all" type="button">Copy All</button>
          <button class="mmc-action" id="mmc-clear" type="button">Clear</button>
        </div>
      </div>
      <button id="mmc-toggle" type="button" data-enabled="true">MC 0</button>
    `;

    document.documentElement.appendChild(widget);

    panel = widget.querySelector("#mmc-panel");
    toggleButton = widget.querySelector("#mmc-toggle");
    statusNode = widget.querySelector("#mmc-status");
    slotsNode = widget.querySelector("#mmc-slots");
    toastNode = widget.querySelector("#mmc-toast");
    toastMessageNode = widget.querySelector("#mmc-toast-message");
    undoButton = widget.querySelector("#mmc-undo");
    enabledButton = widget.querySelector("#mmc-enabled");

    widget.addEventListener("mousedown", (event) => {
      if (!event.target.closest(".mmc-slot")) {
        event.preventDefault();
      }
    });
    toggleButton.addEventListener("click", () => widget.classList.toggle("mmc-open"));
    undoButton.addEventListener("click", undoLastCapture);
    enabledButton.addEventListener("click", toggleEnabled);
    widget.querySelector("#mmc-copy-all").addEventListener("click", copyAll);
    widget.querySelector("#mmc-clear").addEventListener("click", clearClips);
  }

  async function handleMessage(message) {
    if (!message || !message.type) {
      return { ok: false };
    }

    if (message.type === "captureSelection") {
      const result = await captureCurrentSelection({ manual: true });
      return { ok: result };
    }

    if (message.type === "undoLastCapture") {
      const result = await undoLastCapture();
      return { ok: result };
    }

    if (message.type === "togglePalette") {
      widget.classList.toggle("mmc-open");
      return { ok: true };
    }

    if (message.type === "pasteClip") {
      const state = await getState();
      const clip = state.clips[message.index];
      if (!clip) {
        return { ok: false };
      }
      const pasted = await insertOrCopyText(clip.text);
      return { ok: pasted };
    }

    if (message.type === "deleteClip") {
      const result = await deleteClip(message.index);
      return { ok: result };
    }

    if (message.type === "renameClip") {
      const result = await renameClip(message.index, message.label);
      return { ok: result };
    }

    if (message.type === "reorderClip") {
      const result = await reorderClip(message.fromIndex, message.toIndex);
      return { ok: result };
    }

    return { ok: false };
  }

  function rememberEditable(event) {
    if (isFromWidget(event.target)) {
      return;
    }

    const editable = findEditable(event.target);
    if (editable) {
      lastEditable = editable;
    }
  }

  function scheduleSelectionCapture(event) {
    if (isFromWidget(event.target)) {
      return;
    }

    clearTimeout(captureTimer);
    captureTimer = setTimeout(() => captureCurrentSelection({ manual: false }), 80);
  }

  async function captureCurrentSelection({ manual }) {
    const state = await getState();
    if (!state.enabled && !manual) {
      return false;
    }

    const text = getSelectedText().trim();
    if (!text) {
      if (manual) {
        showToast("No selected text to capture.");
      }
      return false;
    }

    const now = Date.now();
    if (text.length < state.minChars) {
      if (manual) {
        showToast(`Select at least ${state.minChars} characters.`);
      }
      return false;
    }

    const duplicateIndex = findDuplicateIndex(state.clips, text);
    if (state.ignoreDuplicates && duplicateIndex >= 0) {
      if (manual || text !== lastCaptured.text || now - lastCaptured.at > 1200) {
        showToast(`Already saved in slot ${duplicateIndex + 1}.`);
      }
      lastCaptured = { text, at: now };
      return false;
    }

    if (!manual && text === lastCaptured.text && now - lastCaptured.at < 1200) {
      return false;
    }

    lastCaptured = { text, at: now };

    const clip = {
      id: createClipId(now),
      text,
      label: "",
      title: document.title || "",
      url: location.href,
      page: state.currentPage,
      capturedAt: now
    };

    const replacedClip = state.clips.length >= state.maxSlots ? state.clips[0] : null;
    const nextClips = [...state.clips, clip].slice(-state.maxSlots);
    await setState({ ...state, clips: nextClips });
    lastUndoClipId = clip.id;
    const slotNumber = nextClips.findIndex((nextClip) => nextClip.id === clip.id) + 1;
    const preview = createPreview(text, 54);
    const message = replacedClip
      ? `Highlight ${slotNumber} saved - "${preview}". Slot 1 was replaced.`
      : `Highlight ${slotNumber} saved - "${preview}"`;
    showToast(message, { undoClipId: clip.id });
    widget.classList.add("mmc-open");
    return true;
  }

  function getSelectedText() {
    const active = document.activeElement;

    if (isTextInput(active) && active.selectionStart !== active.selectionEnd) {
      return active.value.slice(active.selectionStart, active.selectionEnd);
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return "";
    }

    if (isFromWidget(selection.anchorNode) || isFromWidget(selection.focusNode)) {
      return "";
    }

    return selection.toString();
  }

  async function insertOrCopyText(text) {
    const target = lastEditable && document.contains(lastEditable)
      ? lastEditable
      : findEditable(document.activeElement);

    if (target && isRichCodeEditor(target)) {
      await copyToClipboard(text);
      showToast("Copied to clipboard instead. Press Ctrl+V in this editor.");
      return true;
    }

    if (target && insertText(target, text)) {
      showToast("Pasted selected slot.");
      return true;
    }

    await copyToClipboard(text);
    const message = target
      ? "Copied to clipboard instead. Press Ctrl+V in this editor."
      : "No text box focused. Copied slot to clipboard.";
    showToast(message);
    return true;
  }

  function insertText(target, text) {
    if (isTextInput(target)) {
      target.focus({ preventScroll: true });
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      target.setRangeText(text, start, end, "end");
      dispatchInput(target, text);
      return true;
    }

    if (target && target.isContentEditable) {
      target.focus({ preventScroll: true });
      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 && target.contains(selection.anchorNode)
        ? selection.getRangeAt(0)
        : document.createRange();

      if (!target.contains(range.startContainer)) {
        range.selectNodeContents(target);
        range.collapse(false);
      }

      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);

      selection.removeAllRanges();
      selection.addRange(range);
      dispatchInput(target, text);
      return true;
    }

    return false;
  }

  function dispatchInput(target, text) {
    try {
      target.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        data: text,
        inputType: "insertText"
      }));
    } catch (_error) {
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  async function copyAll() {
    const state = await getState();
    const text = formatClips(state.clips, state);

    if (!text) {
      showToast("No clips to copy yet.");
      return;
    }

    await copyToClipboard(text);
    showToast(`Copied ${state.clips.length} highlight${state.clips.length === 1 ? "" : "s"}.`);
  }

  async function clearClips() {
    const state = await getState();
    await setState({ ...state, clips: [] });
    lastUndoClipId = null;
    showToast("Cleared slots.");
  }

  async function toggleEnabled() {
    const state = await getState();
    const enabled = !state.enabled;
    await setState({ ...state, enabled });
    showToast(enabled ? "Collect mode is on." : "Collect mode is paused.");
  }

  async function deleteClip(index) {
    const state = await getState();
    if (!Number.isInteger(index) || index < 0 || index >= state.clips.length) {
      return false;
    }

    const nextClips = state.clips.filter((_clip, clipIndex) => clipIndex !== index);
    await setState({ ...state, clips: nextClips });
    showToast(`Deleted slot ${index + 1}.`);
    return true;
  }

  async function renameClip(index, label) {
    const state = await getState();
    if (!Number.isInteger(index) || index < 0 || index >= state.clips.length) {
      return false;
    }

    const clips = state.clips.map((clip, clipIndex) => clipIndex === index
      ? { ...clip, label: String(label || "").trim().slice(0, 60) }
      : clip);
    await setState({ ...state, clips });
    showToast(clips[index].label ? `Renamed slot ${index + 1}.` : `Cleared slot ${index + 1} name.`);
    return true;
  }

  async function promptRenameClip(index) {
    const state = await getState();
    const clip = state.clips[index];
    if (!clip) {
      return;
    }

    const current = clip.label || "";
    const label = window.prompt(`Name slot ${index + 1}`, current);
    if (label === null) {
      return;
    }

    await renameClip(index, label);
  }

  async function reorderClip(fromIndex, toIndex) {
    const state = await getState();
    if (!isValidClipIndex(state.clips, fromIndex) || !isValidClipIndex(state.clips, toIndex) || fromIndex === toIndex) {
      return false;
    }

    const clips = [...state.clips];
    const [clip] = clips.splice(fromIndex, 1);
    clips.splice(toIndex, 0, clip);
    await setState({ ...state, clips });
    showToast(`Moved slot ${fromIndex + 1} to ${toIndex + 1}.`);
    return true;
  }

  async function undoLastCapture() {
    if (!lastUndoClipId) {
      showToast("Nothing to undo.");
      return false;
    }

    const state = await getState();
    const index = state.clips.findIndex((clip) => clip.id === lastUndoClipId);
    if (index < 0) {
      lastUndoClipId = null;
      showToast("Nothing to undo.");
      return false;
    }

    const nextClips = state.clips.filter((clip) => clip.id !== lastUndoClipId);
    await setState({ ...state, clips: nextClips });
    lastUndoClipId = null;
    showToast(`Undid slot ${index + 1}.`);
    return true;
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  async function renderFromState() {
    render(await getState());
  }

  function render(state) {
    const normalized = normalizeState(state);
    statusNode.textContent = `${normalized.clips.length} / ${normalized.maxSlots}`;
    widget.dataset.groupId = normalized.activeGroupId;
    toggleButton.textContent = `MC ${normalized.clips.length}`;
    toggleButton.dataset.enabled = String(normalized.enabled);
    enabledButton.textContent = normalized.enabled ? "Pause" : "Resume";
    toggleButton.title = normalized.enabled
      ? "Collect mode is on. Highlight text to save it."
      : "Collect mode is paused. Use the popup or shortcut to capture manually.";

    widget.querySelector("#mmc-title").textContent = `Mouse MultiCopy - ${normalized.activeGroup.name}`;
    slotsNode.replaceChildren();

    for (let index = 0; index < normalized.maxSlots; index += 1) {
      const clip = normalized.clips[index];
      const slot = document.createElement("div");
      slot.className = `mmc-slot${clip ? "" : " mmc-empty"}`;
      slot.draggable = Boolean(clip);
      slot.dataset.index = index;
      slot.innerHTML = `
        <button class="mmc-slot-main" type="button"></button>
        <button class="mmc-delete" type="button" aria-label="Delete slot ${index + 1}">x</button>
      `;

      const mainButton = slot.querySelector(".mmc-slot-main");
      mainButton.innerHTML = `
        <span class="mmc-number">${index + 1}</span>
        <span class="mmc-body">
          <span class="mmc-label"></span>
          <span class="mmc-preview"></span>
        </span>
      `;
      mainButton.disabled = !clip;
      mainButton.querySelector(".mmc-label").textContent = clip
        ? (clip.label || `Slot ${index + 1}`)
        : `Slot ${index + 1}`;
      mainButton.querySelector(".mmc-preview").textContent = clip
        ? clip.text
        : "Empty";
      mainButton.addEventListener("click", () => {
        if (clip) {
          insertOrCopyText(clip.text);
        }
      });
      mainButton.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (clip) {
          promptRenameClip(index);
        }
      });

      slot.addEventListener("dragstart", (event) => {
        if (!clip) {
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      });
      slot.addEventListener("dragover", (event) => {
        if (clip) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      });
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        const fromIndex = Number(event.dataTransfer.getData("text/plain"));
        reorderClip(fromIndex, index);
      });

      const deleteButton = slot.querySelector(".mmc-delete");
      deleteButton.disabled = !clip;
      deleteButton.addEventListener("click", () => deleteClip(index));

      slotsNode.appendChild(slot);
    }
  }

  function showToast(message, options = {}) {
    toastMessageNode.textContent = message;
    undoButton.hidden = !options.undoClipId;
    if (options.undoClipId) {
      lastUndoClipId = options.undoClipId;
    }

    toastNode.classList.add("mmc-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove("mmc-show"), 2200);
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
    const storedGroups = Array.isArray(state?.groups)
      ? state.groups
      : [];
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

  function clampNumber(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, Math.round(number)));
  }

  function findDuplicateIndex(clips, text) {
    const normalizedText = normalizeText(text);
    return clips.findIndex((clip) => normalizeText(clip.text) === normalizedText);
  }

  function normalizeText(text) {
    return String(text || "").trim().replace(/\s+/g, " ");
  }

  function createPreview(text, maxLength) {
    const normalized = normalizeText(text);
    return normalized.length > maxLength
      ? `${normalized.slice(0, maxLength - 3)}...`
      : normalized;
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

  function createClipId(seed) {
    return `${seed}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function createGroupId(seed) {
    return `group-${seed}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function isValidClipIndex(clips, index) {
    return Number.isInteger(index) && index >= 0 && index < clips.length;
  }

  function isFromWidget(node) {
    return Boolean(node && widget && widget.contains(node.nodeType === Node.TEXT_NODE ? node.parentNode : node));
  }

  function findEditable(node) {
    if (!node || node === document || node === document.documentElement) {
      return null;
    }

    if (isTextInput(node) || node.isContentEditable) {
      return node;
    }

    return node.closest?.("textarea, input, [contenteditable=''], [contenteditable='true']");
  }

  function isRichCodeEditor(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (!element) {
      return false;
    }

    return Boolean(element.closest?.([
      ".cm-editor",
      ".CodeMirror",
      ".monaco-editor",
      "[data-editor-type='monaco']",
      "[data-testid='codemirror-editor']"
    ].join(",")));
  }

  function isTextInput(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    if (node.tagName === "TEXTAREA") {
      return true;
    }

    if (node.tagName !== "INPUT") {
      return false;
    }

    const type = (node.getAttribute("type") || "text").toLowerCase();
    return ["email", "number", "search", "tel", "text", "url"].includes(type);
  }
})();
