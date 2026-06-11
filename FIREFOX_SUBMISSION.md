# Firefox Add-ons Submission

## Package

Build the Firefox package:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\package-firefox.ps1
```

Upload:

```text
dist\mouse-multicopy-firefox-0.5.3.zip
```

## Firefox-Specific Settings

- Manifest V3
- Background event page through `background.scripts`
- Gecko ID: `mouse-multicopy@qarait.github`
- Minimum Firefox version: 142
- Data collection and transmission: `none`
- Desktop Firefox only until Android behavior is tested separately

## Listing

Name:

```text
Mouse MultiCopy
```

Summary:

```text
Collect webpage highlights and paste them anywhere in one clean document.
```

Category:

```text
Productivity
```

Homepage:

```text
https://qarait.github.io/mouse-multicopy-extension/
```

Support:

```text
https://github.com/Qarait/mouse-multicopy-extension/issues
```

Privacy policy:

```text
https://gist.github.com/Qarait/15671558d14faa3e1ed75e4886923f6c
```

## Reviewer Notes

Mouse MultiCopy stores selected text and settings locally in Firefox extension
storage. It does not transmit user data or use remote code.

Test steps:

1. Open a normal webpage containing selectable text.
2. Highlight three separate passages.
3. Confirm the page shows numbered save notifications.
4. Open the floating Mouse MultiCopy palette.
5. Click Copy All 3 and paste into a text field.
6. Open Options to test individual Copy, Paste, and Delete controls.
