# Microsoft Store Submission

Mouse MultiCopy for Windows is a native desktop utility. It captures text the
user copies through the Windows clipboard and stores numbered highlights locally.

## Current build

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File windows-desktop\build.ps1
```

Executable:

```text
dist\windows\MouseMultiCopy.exe
```

## MSIX validation build

Create an unsigned development package:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File windows-desktop\package-msix.ps1
```

Microsoft Store submission requires the real package identity from Partner
Center. After reserving `Mouse MultiCopy`, open **Product identity** and copy:

- Package/Identity/Name
- Package/Identity/Publisher
- Package/Properties/PublisherDisplayName

Then rebuild:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File windows-desktop\package-msix.ps1 `
  -IdentityName "PARTNER_CENTER_IDENTITY_NAME" `
  -Publisher "PARTNER_CENTER_PUBLISHER" `
  -PublisherDisplayName "PARTNER_CENTER_PUBLISHER_DISPLAY_NAME"
```

Do not submit the development identity package.

## Mouse MultiCopy Store identity

Partner Center assigned these values to Store ID `9PGSWMXG47JR`:

```text
Package/Identity/Name: MahammadBaghir.MouseMultiCopy
Package/Identity/Publisher: CN=B846E3FD-47CD-4B16-89EF-5D58E3DE64B3
Package/Properties/PublisherDisplayName: Mahammad Baghir
```

Create the Store submission package:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File windows-desktop\package-msix.ps1 `
  -IdentityName "MahammadBaghir.MouseMultiCopy" `
  -Publisher "CN=B846E3FD-47CD-4B16-89EF-5D58E3DE64B3" `
  -PublisherDisplayName "Mahammad Baghir"
```

## Store listing

Category:

```text
Productivity
```

Short description:

```text
Collect copied text into numbered highlights, then paste everything at once.
```

Privacy:

- Clipboard text is captured only while collection is enabled.
- Highlights and settings are stored locally in `%LOCALAPPDATA%`.
- No account is required.
- No captured text is transmitted to an external server.
- Public policy: `https://qarait.github.io/mouse-multicopy-extension/privacy.html`

## Manual release test

1. Start Mouse MultiCopy.
2. Copy three different paragraphs from Notepad, Word, and a browser.
3. Confirm all three appear in order.
4. Confirm duplicate copied text is ignored.
5. Click Copy All and paste into Notepad.
6. Use individual Paste and confirm it returns to the previous app.
7. Pause collection and confirm new clipboard text is ignored.
8. Click Minimize and confirm the app remains visible on the taskbar.
9. Close the window with `X` and confirm the tray app remains active.
10. Reopen with `Alt+Shift+V`.
11. Paste all with `Alt+Shift+A`.

Before submission, run the Windows App Certification Kit against the final
Partner Center identity package.
