(() => {
  async function writeText(text) {
    const value = String(text ?? "");

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (_error) {
        // Fall through to the document copy path.
      }
    }

    const parent = document.body || document.documentElement;
    if (!parent || typeof document.execCommand !== "function") {
      throw new Error("Clipboard access is unavailable.");
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    parent.appendChild(textarea);
    textarea.select();

    try {
      if (!document.execCommand("copy")) {
        throw new Error("Clipboard copy was rejected.");
      }
      return true;
    } finally {
      textarea.remove();
    }
  }

  globalThis.MouseMultiCopyClipboard = Object.freeze({ writeText });
})();
