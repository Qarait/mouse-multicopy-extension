$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sourceDir = $PSScriptRoot
$outputDir = Join-Path $root "dist\windows"
$outputPath = Join-Path $outputDir "MouseMultiCopy.exe"
$iconPath = Join-Path $outputDir "MouseMultiCopy.ico"
$compiler = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path -LiteralPath $compiler)) {
  throw "The Windows C# compiler was not found at $compiler."
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Add-Type -AssemblyName System.Drawing
$sourceIcon = [System.Drawing.Image]::FromFile((Join-Path $root "icons\icon128.png"))
$iconBitmap = New-Object System.Drawing.Bitmap 32, 32
$iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
$iconGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$iconGraphics.DrawImage($sourceIcon, 0, 0, 32, 32)
$iconHandle = $iconBitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)
$iconStream = [System.IO.File]::Create($iconPath)
$icon.Save($iconStream)
$iconStream.Dispose()
$icon.Dispose()
$iconGraphics.Dispose()
$iconBitmap.Dispose()
$sourceIcon.Dispose()

$sources = Get-ChildItem -LiteralPath $sourceDir -Filter "*.cs" |
  Sort-Object Name |
  ForEach-Object { $_.FullName }

& $compiler `
  /nologo `
  /target:winexe `
  /optimize+ `
  /platform:anycpu `
  /out:$outputPath `
  /win32icon:$iconPath `
  /reference:System.dll `
  /reference:System.Core.dll `
  /reference:System.Drawing.dll `
  /reference:System.Windows.Forms.dll `
  /reference:System.Web.Extensions.dll `
  $sources

if ($LASTEXITCODE -ne 0) {
  throw "Windows desktop build failed."
}

Write-Output "Created $outputPath"
