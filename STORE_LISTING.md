# Mouse MultiCopy Store Listing

## Short Description

Collect webpage highlights with page and source details, then paste them anywhere in one clean document.

## Full Description

Mouse MultiCopy is a simple highlight collector for people who read, research, and take notes from web pages.

Highlight text on a page and Mouse MultiCopy saves it as Highlight 1. Highlight again and it saves Highlight 2. A small confirmation shows what was captured. When you are ready, click Copy All and paste every paragraph at once into Word, Notepad, email, or another app.

The default experience stays deliberately simple. Optional page numbers, source details, numbered output, sessions, and individual controls are kept under Options.

Features:

- Capture highlighted webpage text with instant numbered feedback
- Copy every highlight as one clean, formatted document
- Add page numbers to new highlights or edit them individually
- Include or omit page titles and URLs
- See the saved highlight count on the extension icon
- Start with a simple interface; open Options only when needed
- Use a compact floating palette that shows only saved highlights
- Expand the palette for longer highlights or collapse it back to the MC button
- Copy, paste, or delete individual highlights from compact controls
- Paste a chosen highlight into focused text fields and editors
- Rename highlights to describe what each saved snippet is
- Drag highlights to reorder them before pasting
- Create separate sessions for different tasks or research contexts
- Use clipboard fallback for rich code editors that block direct insertion
- Copy all saved highlights at once
- Undo accidental captures
- Warn when the oldest slot is replaced
- Delete individual highlights
- Pause collection when you do not want selections saved
- Adjust the highlight limit from 3 to 50
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
- Distribution ZIP from `dist/mouse-multicopy-0.5.3.zip`

## Manual QA Before Submission

- Load unpacked extension in Chrome.
- Open a normal webpage, not a `chrome://` page.
- Highlight three separate text snippets.
- Confirm the page widget shows `MC 3`.
- Open the floating palette and confirm it shows only three saved highlights and no empty slots.
- Confirm Copy All 3 is the primary action and Options starts closed.
- Confirm each capture toast includes its number and a short preview.
- Open Options, set a page number, click Copy With Details, and confirm the formatted output includes it.
- Confirm the toolbar icon badge shows `3`.
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
