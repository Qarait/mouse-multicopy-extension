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
- Rename slots to describe what each saved snippet is
- Drag slots to reorder them before pasting
- Create separate sessions for different tasks or research contexts
- Use clipboard fallback for rich code editors that block direct insertion
- Copy all saved slots at once
- Undo accidental captures
- Warn when the oldest slot is replaced
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

Privacy policy URL:

https://gist.github.com/Qarait/15671558d14faa3e1ed75e4886923f6c

## Permission Justifications

- `storage`: saves snippets and settings locally.
- `clipboardWrite`: copies a chosen slot when no text field is focused.
- Webpage access: detects highlighted text, shows the floating `MC` palette, and pastes into focused text fields.

## Store Assets To Upload

- `icons/icon128.png`
- `store-assets/screenshot-1280x800.png`
- `PRIVACY.md`
- Distribution ZIP from `dist/mouse-multicopy-0.3.0.zip`

## Manual QA Before Submission

- Load unpacked extension in Chrome.
- Open a normal webpage, not a `chrome://` page.
- Highlight three separate text snippets.
- Confirm the page widget shows `MC 3`.
- Focus a textarea or input.
- Paste slot 2 and confirm the correct snippet appears.
- Rename a slot and confirm the new name persists after closing and reopening the popup.
- Drag a slot to a new position and confirm the paste order changes.
- Create a second session, switch sessions, and confirm each session keeps separate clips.
- Capture one more snippet after quick slots are full and confirm the replacement toast appears.
- Test a CodeMirror or Monaco-style editor and confirm the extension copies to clipboard with a Ctrl+V fallback message.
- Open the popup and confirm collect mode, slot count, copy, paste, and clear controls work.
- Confirm no console errors on a normal webpage.

## Known Compatibility Notes

Mouse MultiCopy directly inserts text into standard inputs, textareas, and many contenteditable fields. Some rich code editors, including CodeMirror and Monaco-based editors, manage their own editing model and may block direct DOM insertion. In those editors, Mouse MultiCopy copies the selected slot to the clipboard and asks the user to press `Ctrl+V`.
