(() => {
  const STORAGE_KEY = "mouseMultiCopyState";
  const DEFAULT_STATE = {
    enabled: true,
    maxSlots: 12,
    minChars: 3,
    ignoreDuplicates: true,
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

    widget.addEventListener("mousedown", (event) => event.preventDefault());
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
    captureTimer = setTimeout(() => captureCurrentSelection({ manual: false }), 140);
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
      title: document.title || "",
      url: location.href,
      capturedAt: now
    };

    const nextClips = [...state.clips, clip].slice(-state.maxSlots);
    await setState({ ...state, clips: nextClips });
    lastUndoClipId = clip.id;
    showToast(`Captured slot ${nextClips.length}.`, { undoClipId: clip.id });
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

    if (target && insertText(target, text)) {
      showToast("Pasted selected slot.");
      return true;
    }

    await copyToClipboard(text);
    showToast("No text box focused. Copied slot to clipboard.");
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
    const text = state.clips.map((clip) => clip.text).join("\n");

    if (!text) {
      showToast("No clips to copy yet.");
      return;
    }

    await copyToClipboard(text);
    showToast("Copied all slots to clipboard.");
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
    toggleButton.textContent = `MC ${normalized.clips.length}`;
    toggleButton.dataset.enabled = String(normalized.enabled);
    enabledButton.textContent = normalized.enabled ? "Pause" : "Resume";
    toggleButton.title = normalized.enabled
      ? "Collect mode is on. Highlight text to save it."
      : "Collect mode is paused. Use the popup or shortcut to capture manually.";

    slotsNode.replaceChildren();

    for (let index = 0; index < normalized.maxSlots; index += 1) {
      const clip = normalized.clips[index];
      const slot = document.createElement("div");
      slot.className = `mmc-slot${clip ? "" : " mmc-empty"}`;
      slot.innerHTML = `
        <button class="mmc-slot-main" type="button"></button>
        <button class="mmc-delete" type="button" aria-label="Delete slot ${index + 1}">x</button>
      `;

      const mainButton = slot.querySelector(".mmc-slot-main");
      mainButton.innerHTML = `
        <span class="mmc-number">${index + 1}</span>
        <span class="mmc-preview"></span>
      `;
      mainButton.disabled = !clip;
      mainButton.querySelector(".mmc-preview").textContent = clip
        ? clip.text
        : "Empty";
      mainButton.addEventListener("click", () => {
        if (clip) {
          insertOrCopyText(clip.text);
        }
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
    const clips = Array.isArray(state?.clips)
      ? state.clips.filter((clip) => clip && typeof clip.text === "string" && clip.text.trim()).slice(-maxSlots)
      : [];

    return {
      enabled: typeof state?.enabled === "boolean" ? state.enabled : DEFAULT_STATE.enabled,
      maxSlots,
      minChars,
      ignoreDuplicates: typeof state?.ignoreDuplicates === "boolean" ? state.ignoreDuplicates : DEFAULT_STATE.ignoreDuplicates,
      clips: clips.map((clip, index) => ({
        id: clip.id || createClipId(clip.capturedAt || index),
        text: clip.text,
        title: clip.title || "",
        url: clip.url || "",
        capturedAt: clip.capturedAt || 0
      }))
    };
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

  function createClipId(seed) {
    return `${seed}-${Math.random().toString(36).slice(2, 10)}`;
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
