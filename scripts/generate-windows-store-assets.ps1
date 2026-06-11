$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root "dist\windows\professional-ui.png"
$iconPath = Join-Path $root "icons\icon128.png"
$outputDir = Join-Path $root "store-assets\windows"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Add-Type -AssemblyName System.Drawing

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Rectangle,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc(
    $Rectangle.Right - $diameter,
    $Rectangle.Bottom - $diameter,
    $diameter,
    $diameter,
    0,
    90
  )
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

$canvas = New-Object System.Drawing.Bitmap 1366, 768
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$graphics.Clear([System.Drawing.Color]::FromArgb(244, 248, 245))

$navy = [System.Drawing.Color]::FromArgb(31, 67, 111)
$green = [System.Drawing.Color]::FromArgb(24, 133, 74)
$ink = [System.Drawing.Color]::FromArgb(25, 38, 31)
$muted = [System.Drawing.Color]::FromArgb(71, 89, 78)

$graphics.FillRectangle((New-Object System.Drawing.SolidBrush $navy), 0, 0, 1366, 768)
$graphics.FillRectangle(
  (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(244, 248, 245))),
  0,
  590,
  1366,
  178
)

$titleFont = New-Object System.Drawing.Font "Segoe UI", 42, ([System.Drawing.FontStyle]::Bold)
$bodyFont = New-Object System.Drawing.Font "Segoe UI", 21, ([System.Drawing.FontStyle]::Regular)
$featureFont = New-Object System.Drawing.Font "Segoe UI", 18, ([System.Drawing.FontStyle]::Regular)
$labelFont = New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)

$whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$mutedWhiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(222, 232, 242))
$inkBrush = New-Object System.Drawing.SolidBrush $ink
$mutedBrush = New-Object System.Drawing.SolidBrush $muted
$greenBrush = New-Object System.Drawing.SolidBrush $green

$graphics.DrawString("Mouse MultiCopy", $titleFont, $whiteBrush, 82, 86)
$graphics.DrawString(
  "Copy normally. Keep every highlight. Paste them together.",
  $bodyFont,
  $mutedWhiteBrush,
  (New-Object System.Drawing.RectangleF 86, 158, 560, 90)
)

$features = @(
  "Numbered clipboard highlights",
  "Copy, paste, or delete any item",
  "Local storage with no account"
)

for ($index = 0; $index -lt $features.Count; $index++) {
  $top = 275 + ($index * 64)
  $graphics.FillEllipse($greenBrush, 88, $top + 7, 18, 18)
  $graphics.DrawString(
    $features[$index],
    $featureFont,
    $whiteBrush,
    126,
    $top
  )
}

$graphics.DrawString("WINDOWS 10/11", $labelFont, $mutedBrush, 86, 648)
$graphics.DrawString(
  "A focused clipboard workflow for everyday work.",
  $featureFont,
  $inkBrush,
  86,
  680
)

$source = [System.Drawing.Image]::FromFile($sourcePath)
$screenWidth = 540
$screenHeight = [int]($source.Height * ($screenWidth / $source.Width))
$screenX = 756
$screenY = 42
$shadowRectangle = New-Object System.Drawing.RectangleF ($screenX + 12), ($screenY + 14), $screenWidth, $screenHeight
$shadowPath = New-RoundedRectanglePath $shadowRectangle 12
$shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70, 0, 0, 0))
$graphics.FillPath($shadowBrush, $shadowPath)
$graphics.DrawImage($source, $screenX, $screenY, $screenWidth, $screenHeight)

$screenshotPath = Join-Path $outputDir "mouse-multicopy-store-1366x768.png"
$canvas.Save($screenshotPath, [System.Drawing.Imaging.ImageFormat]::Png)

$logo = New-Object System.Drawing.Bitmap 300, 300
$logoGraphics = [System.Drawing.Graphics]::FromImage($logo)
$logoGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$logoGraphics.Clear([System.Drawing.Color]::FromArgb(244, 248, 245))
$icon = [System.Drawing.Image]::FromFile($iconPath)
$logoGraphics.DrawImage($icon, 42, 42, 216, 216)
$logoPath = Join-Path $outputDir "mouse-multicopy-store-logo-300.png"
$logo.Save($logoPath, [System.Drawing.Imaging.ImageFormat]::Png)

$icon.Dispose()
$logoGraphics.Dispose()
$logo.Dispose()
$source.Dispose()
$shadowBrush.Dispose()
$shadowPath.Dispose()
$greenBrush.Dispose()
$mutedBrush.Dispose()
$inkBrush.Dispose()
$mutedWhiteBrush.Dispose()
$whiteBrush.Dispose()
$labelFont.Dispose()
$featureFont.Dispose()
$bodyFont.Dispose()
$titleFont.Dispose()
$graphics.Dispose()
$canvas.Dispose()

Write-Output "Created $screenshotPath"
Write-Output "Created $logoPath"
