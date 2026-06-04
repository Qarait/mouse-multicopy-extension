# Mouse MultiCopy

Mouse MultiCopy is a Chrome extension prototype for mouse-first multi-copy.

Instead of copying one thing, replacing it, and using clipboard history later, this extension lets you:

1. Highlight text on a web page.
2. Save each highlight into the next numbered slot.
3. Focus a text field or editor.
4. Click slot 1, 2, 3, and so on to paste that exact saved text.

## Realistic Capacity

The prototype uses 12 quick slots by default.

Technically, a browser extension can store far more text snippets than that, but the useful limit is mostly a user-interface limit:

- 3 slots is easy to remember.
- 9 slots maps nicely to number keys.
- 12 slots is a strong first default for mouse use.
- 20 to 50 slots is realistic for power users if search or grouping is added.
- Hundreds or thousands should become history, not primary paste slots.

This version accepts `maxSlots` values from 3 to 50 internally.

## Install Locally

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder: `mouse-multicopy-extension`.

## Sharing With Other People

For early testers, zip this folder and have them install it with `Load unpacked`.

For normal users, package and publish it through the Chrome Web Store or Microsoft Edge Add-ons. A store version should add production icons, a short privacy policy, screenshots, and a clear explanation that highlighted text is stored locally in browser extension storage.

For Chrome Web Store submission details, use `CHROME_WEB_STORE_SUBMISSION.md`.

Public privacy policy URL:

https://gist.github.com/Qarait/15671558d14faa3e1ed75e4886923f6c

## Build The Store ZIP

Generate icons and the store screenshot:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File mouse-multicopy-extension\scripts\generate-assets.ps1
```

Create the upload ZIP:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File mouse-multicopy-extension\scripts\package-extension.ps1
```

The upload package is created at:

```text
mouse-multicopy-extension\dist\mouse-multicopy-0.2.0.zip
```

The package contains only the runtime extension files, not tests or draft store docs.

## Use

- Collect mode is on by default.
- Highlight text with the mouse to capture it into the next slot.
- Click the `MC` button at the bottom-right of the page to open slots.
- Click a numbered slot to paste it into the focused text field.
- If no text field is focused, the slot is copied to the system clipboard instead.
- Use undo after accidental captures.
- Delete individual slots from the page palette or popup.
- Use the extension popup to pause collection, manually capture, paste, copy, clear, set quick-slot count, set minimum capture length, or disable duplicate protection.

## Shortcuts

Chrome may let you configure these at `chrome://extensions/shortcuts`:

- `Alt+Shift+C`: capture the current selection.
- `Alt+Shift+V`: show or hide the paste palette.

## Current Limits

- This prototype works inside web pages, not native Windows apps.
- Chrome system pages such as `chrome://extensions` do not allow content scripts.
- Some rich editors handle pasted text differently; normal inputs, textareas, and many contenteditable editors work.
- Slot 13 replaces the oldest item when the quick-slot limit is 12.
- The first-run welcome page explains the workflow but the live page widget appears only on ordinary webpages.

## Test

Run the smoke test:

```powershell
node mouse-multicopy-extension\smoke-test.js
```

The test drives the content script with mocked Chrome extension APIs and verifies this path:

1. Capture three highlighted selections.
2. Store them as slots.
3. Paste slot 2.
4. Paste slot 3.

The script also includes a headless Chrome probe for unpacked-extension injection. Headless Chrome may not inject extensions the same way as a normal browser session, so use the manual `Load unpacked` check as the final browser install test.

Manual Chrome install is the final release check:

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select `mouse-multicopy-extension`.
5. Test on a normal webpage with an input or textarea.
