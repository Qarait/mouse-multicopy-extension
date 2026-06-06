(() => {
  const STORAGE_KEY = "mouseMultiCopyState";
  const {
    DEFAULT_STATE,
    normalizeState,
    createClipId,
    isValidClipIndex
  } = globalThis.MouseMultiCopyState;

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
      <div id="mmc-panel" aria-label="Saved highlights">
        <div id="mmc-header">
          <div id="mmc-title">Highlights</div>
          <div id="mmc-header-right">
            <div id="mmc-status">0 saved</div>
            <button id="mmc-expand" class="mmc-header-button" type="button" aria-label="Expand highlights panel" aria-expanded="false" title="Expand panel">&#x2922;</button>
            <button id="mmc-collapse" class="mmc-header-button" type="button" aria-label="Collapse highlights panel" title="Collapse to MC button">&times;</button>
          </div>
        </div>
        <div id="mmc-empty">Highlight text on the page to begin.</div>
        <div id="mmc-slots"></div>
        <button id="mmc-copy-all" type="button">Copy All</button>
        <div id="mmc-paste-hint">Then paste once anywhere with Ctrl+V.</div>
        <details id="mmc-options">
          <summary>Options</summary>
          <div id="mmc-actions">
            <button class="mmc-action" id="mmc-enabled" type="button">Pause collection</button>
            <button class="mmc-action" id="mmc-clear" type="button">Clear all</button>
          </div>
        </details>
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
    const options = widget.querySelector("#mmc-options");
    const expandButton = widget.querySelector("#mmc-expand");
    const collapseButton = widget.querySelector("#mmc-collapse");

    widget.addEventListener("mousedown", (event) => {
      if (!event.target.closest(".mmc-slot, #mmc-options, #mmc-copy-all, #mmc-toggle, #mmc-undo, .mmc-header-button")) {
        event.preventDefault();
      }
    });
    toggleButton.addEventListener("click", () => widget.classList.toggle("mmc-open"));
    expandButton.addEventListener("click", () => {
      const expanded = widget.classList.toggle("mmc-expanded");
      expandButton.setAttribute("aria-expanded", String(expanded));
      expandButton.setAttribute("aria-label", expanded ? "Contract highlights panel" : "Expand highlights panel");
      expandButton.title = expanded ? "Contract panel" : "Expand panel";
      expandButton.textContent = expanded ? "\u2921" : "\u2922";
    });
    collapseButton.addEventListener("click", () => widget.classList.remove("mmc-open"));
    undoButton.addEventListener("click", undoLastCapture);
    enabledButton.addEventListener("click", toggleEnabled);
    widget.querySelector("#mmc-copy-all").addEventListener("click", copyAll);
    widget.querySelector("#mmc-clear").addEventListener("click", clearClips);
    options.addEventListener("toggle", () => {
      widget.classList.toggle("mmc-options-open", options.open);
    });
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
      const copied = await copyToClipboard(text);
      if (copied) {
        showToast("Copied to clipboard instead. Press Ctrl+V in this editor.");
      }
      return copied;
    }

    if (target && insertText(target, text)) {
      showToast("Pasted selected slot.");
      return true;
    }

    const copied = await copyToClipboard(text);
    if (!copied) {
      return false;
    }
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
    const text = state.clips.map((clip) => clip.text).join("\n\n");

    if (!text) {
      showToast("No highlights to copy yet.");
      return;
    }

    if (await copyToClipboard(text)) {
      showToast("Copied. Paste once anywhere with Ctrl+V.");
    }
  }

  async function clearClips() {
    const state = await getState();
    await setState({ ...state, clips: [] });
    lastUndoClipId = null;
    showToast("Cleared highlights.");
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
    try {
      await globalThis.MouseMultiCopyClipboard.writeText(text);
      return true;
    } catch (_error) {
      showToast("Could not access the clipboard. Please try again.");
      return false;
    }
  }

  async function renderFromState() {
    render(await getState());
  }

  function render(state) {
    const normalized = normalizeState(state);
    const count = normalized.clips.length;
    statusNode.textContent = `${count} saved`;
    widget.dataset.groupId = normalized.activeGroupId;
    toggleButton.textContent = `MC ${count}`;
    toggleButton.dataset.enabled = String(normalized.enabled);
    enabledButton.textContent = normalized.enabled ? "Pause collection" : "Resume collection";
    toggleButton.title = normalized.enabled
      ? "Collect mode is on. Highlight text to save it."
      : "Collect mode is paused. Use the popup or shortcut to capture manually.";

    widget.querySelector("#mmc-title").textContent = normalized.activeGroup.name === "Default"
      ? "Highlights"
      : normalized.activeGroup.name;
    widget.querySelector("#mmc-empty").hidden = count > 0;
    const copyAllButton = widget.querySelector("#mmc-copy-all");
    copyAllButton.disabled = count === 0;
    copyAllButton.textContent = count ? `Copy All ${count}` : "Copy All";
    slotsNode.replaceChildren();

    for (let index = 0; index < count; index += 1) {
      const clip = normalized.clips[index];
      const slot = document.createElement("div");
      slot.className = "mmc-slot";
      slot.draggable = true;
      slot.dataset.index = index;
      slot.innerHTML = `
        <span class="mmc-number">${index + 1}</span>
        <span class="mmc-body">
          <span class="mmc-label"></span>
          <span class="mmc-preview"></span>
        </span>
        <span class="mmc-item-actions">
          <button class="mmc-copy" type="button">Copy</button>
          <button class="mmc-paste" type="button">Paste</button>
          <button class="mmc-delete" type="button" aria-label="Delete highlight ${index + 1}">Delete</button>
        </span>
      `;

      const copyButton = slot.querySelector(".mmc-copy");
      const pasteButton = slot.querySelector(".mmc-paste");
      slot.querySelector(".mmc-label").textContent = clip.label || `Highlight ${index + 1}`;
      slot.querySelector(".mmc-preview").textContent = clip.text;
      copyButton.addEventListener("click", async () => {
        if (await copyToClipboard(clip.text)) {
          showToast(`Copied highlight ${index + 1}.`);
        }
      });
      pasteButton.addEventListener("click", () => insertOrCopyText(clip.text));
      slot.querySelector(".mmc-body").addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        promptRenameClip(index);
      });

      slot.addEventListener("dragstart", (event) => {
        if (!widget.classList.contains("mmc-options-open")) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      });
      slot.addEventListener("dragover", (event) => {
        if (widget.classList.contains("mmc-options-open")) {
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
