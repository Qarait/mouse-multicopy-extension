# Mouse MultiCopy Store Listing

## Short Description

Collect highlighted text into numbered slots and paste any saved snippet with the mouse.

## Full Description

Mouse MultiCopy is a mouse-first multi-copy tool for people who collect text from web pages.

Highlight text on a page and Mouse MultiCopy saves it into the next quick slot. Highlight again and it saves the next snippet. When you are ready to paste, open the floating palette or popup and choose slot 1, 2, 3, or any saved slot.

Useful for research, quoting, form filling, note taking, and moving several small pieces of text without repeatedly replacing your clipboard.

Features:

- Capture highlighted webpage text into numbered slots
- Paste a chosen slot into focused text fields and editors
- Copy all saved slots at once
- Undo accidental captures
- Delete individual slots
- Pause collection when you do not want selections saved
- Adjust quick slots from 3 to 50
- Set a minimum capture length
- Skip duplicate selections automatically
- Keyboard shortcuts for capture and palette toggle
- First-run welcome page
- Local browser storage only

## Category

Productivity

## Privacy Summary

Mouse MultiCopy stores captured text locally in your browser extension storage. It does not send captured text to a server and does not sell or share user data.

## Store Assets To Upload

- `icons/icon128.png`
- `store-assets/screenshot-1280x800.png`
- `PRIVACY.md`
- Distribution ZIP from `dist/mouse-multicopy-0.2.0.zip`

## Manual QA Before Submission

- Load unpacked extension in Chrome.
- Open a normal webpage, not a `chrome://` page.
- Highlight three separate text snippets.
- Confirm the page widget shows `MC 3`.
- Focus a textarea or input.
- Paste slot 2 and confirm the correct snippet appears.
- Open the popup and confirm collect mode, slot count, copy, paste, and clear controls work.
- Confirm no console errors on a normal webpage.
