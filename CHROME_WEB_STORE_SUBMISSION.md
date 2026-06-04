# Chrome Web Store Submission Checklist

Use this file when submitting Mouse MultiCopy to the Chrome Web Store Developer Dashboard.

## Submission Status

- Extension package: `dist/mouse-multicopy-0.2.0.zip`
- Category: Productivity
- Visibility recommendation for first review: Unlisted
- Final manual QA required: Yes

## Single Purpose

Mouse MultiCopy has one narrow purpose: collect highlighted webpage text into local numbered slots and paste a chosen slot into a focused text field.

## Permissions

Declare and justify these permissions in the Privacy practices tab.

### `storage`

Stores the user's saved text snippets, quick-slot count, minimum capture length, duplicate-protection setting, and collect-mode state locally in browser extension storage.

### `clipboardWrite`

Copies a selected saved slot to the user's clipboard when no webpage text field is focused, and supports the popup's Copy action.

### Site Access / Content Script Access

Mouse MultiCopy runs a content script on webpages so it can detect selected text, show the floating `MC` palette, and insert chosen snippets into focused text fields. It does not read passwords, cookies, browsing history, or data outside the selected text and page metadata saved with each clip.

## Privacy Practices Answers

Use these answers in the dashboard unless the product behavior changes.

### Does the extension collect or use user data?

Yes. It handles user-selected webpage text.

### Data types

- Website content: selected text highlighted by the user.
- Web history or page metadata: page URL and page title are stored with each saved snippet for local context only.

### Data use

- App functionality only.

### Data sharing

- No data is sold.
- No data is transferred to third parties.
- No data is sent to a remote server.

### Data storage

Data is stored locally using Chrome extension storage. Users can clear saved slots from the popup or floating palette.

## Privacy Policy URL

Chrome Web Store requires a public privacy policy URL. Use:

https://gist.github.com/Qarait/15671558d14faa3e1ed75e4886923f6c

This is a public GitHub Gist containing `PRIVACY.md`.

## Store Listing Copy

Use `STORE_LISTING.md` for the short description, full description, category, privacy summary, and manual QA list.

## Upload Assets

- Package: `dist/mouse-multicopy-0.2.0.zip`
- Icon: `icons/icon128.png`
- Screenshot: `store-assets/screenshot-1280x800.png`
- Privacy policy: public URL based on `PRIVACY.md`

## Manual QA Before Clicking Submit

1. Load unpacked extension in Chrome.
2. Open `manual-test.html` through a local HTTP server or use any normal webpage with selectable text and a textarea.
3. Highlight `Alpha selection`, `Beta selection`, and `Gamma selection`.
4. Confirm the floating button shows `MC 3`.
5. Open the palette and paste slot 2 into a textarea.
6. Confirm duplicate highlighting does not add another copy when duplicate protection is on.
7. Confirm short selections below the minimum length are ignored.
8. Confirm Undo removes the latest captured slot.
9. Confirm individual slot Delete works.
10. Open the popup and confirm settings persist.

## Likely Review Questions

### Why does it run on webpages?

It needs webpage access to detect user-highlighted text, show the local numbered paste palette, and insert the selected saved snippet into focused text fields.

### Does it transmit selected text?

No. Captured snippets remain local in Chrome extension storage and are never sent to a server.

### Why does it need clipboard access?

When no editable field is focused, a selected slot is copied to the clipboard so the user can paste it manually.
