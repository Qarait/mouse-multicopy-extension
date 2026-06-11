# Mouse MultiCopy for Windows

Mouse MultiCopy for Windows captures text copied from any desktop application and
keeps it in a numbered list.

## Default workflow

1. Leave Mouse MultiCopy running in the system tray.
2. Copy text normally with `Ctrl+C` in Word, Notepad, a browser, or another app.
3. Each unique text copy becomes the next saved highlight.
4. Open Mouse MultiCopy and choose Copy, Paste, Delete, or Copy All.

## Shortcuts

- `Alt+Shift+V`: show or hide Mouse MultiCopy.
- `Alt+Shift+A`: paste all saved highlights into the last active application.

## Local storage

State is stored at:

```text
%LOCALAPPDATA%\Mouse MultiCopy\state.json
```

No account or network connection is used.

## Build

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File windows-desktop\build.ps1
```

Output:

```text
dist\windows\MouseMultiCopy.exe
```

## Test

```powershell
dist\windows\MouseMultiCopy.exe --self-test
```

The first Store release will be packaged as MSIX after the desktop workflow has
been manually verified in Word, Notepad, and web browsers.

Render the current UI state for visual QA:

```powershell
dist\windows\MouseMultiCopy.exe --render-test dist\windows\preview.png
```
