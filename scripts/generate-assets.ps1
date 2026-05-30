$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $root "icons"
$storeDir = Join-Path $root "store-assets"

New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null
New-Item -ItemType Directory -Force -Path $storeDir | Out-Null

Add-Type -AssemblyName System.Drawing

function Fill-RoundedRectangle {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Brush]$Brush,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [int]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $Graphics.FillPath($Brush, $path)
  $path.Dispose()
}

function New-IconPng {
  param(
    [int]$Size,
    [string]$Path
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $rect = [System.Drawing.Rectangle]::new(0, 0, $Size, $Size)
  $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    [System.Drawing.Color]::FromArgb(17, 24, 39),
    [System.Drawing.Color]::FromArgb(37, 99, 235),
    [single]45
  )
  Fill-RoundedRectangle -Graphics $graphics -Brush $background -X 0 -Y 0 -Width $Size -Height $Size -Radius ([Math]::Max(4, [int]($Size * 0.18)))

  $penWidth = [Math]::Max(2, [int]($Size * 0.075))
  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, [single]$penWidth)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $slotBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245, 249, 255))
  $accentBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(96, 165, 250))
  $textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(17, 24, 39))

  $cardW = [int]($Size * 0.62)
  $cardH = [int]($Size * 0.18)
  $cardX = [int]($Size * 0.2)
  $startY = [int]($Size * 0.22)
  $gap = [int]($Size * 0.08)
  $radius = [Math]::Max(2, [int]($Size * 0.05))

  for ($i = 0; $i -lt 3; $i++) {
    $y = $startY + ($i * ($cardH + $gap))
    Fill-RoundedRectangle -Graphics $graphics -Brush $slotBrush -X $cardX -Y $y -Width $cardW -Height $cardH -Radius $radius
    $graphics.FillEllipse($accentBrush, $cardX + [int]($Size * 0.04), $y + [int]($Size * 0.045), [int]($Size * 0.09), [int]($Size * 0.09))
    $graphics.DrawLine($pen, $cardX + [int]($Size * 0.19), $y + [int]($cardH * 0.5), $cardX + $cardW - [int]($Size * 0.08), $y + [int]($cardH * 0.5))
  }

  if ($Size -ge 48) {
    $fontSize = [Math]::Max(10, [int]($Size * 0.16))
    $font = [System.Drawing.Font]::new("Segoe UI", [single]$fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.DrawString("MC", $font, $textBrush, [float]($Size * 0.31), [float]($Size * 0.76))
    $font.Dispose()
  }

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $textBrush.Dispose()
  $accentBrush.Dispose()
  $slotBrush.Dispose()
  $pen.Dispose()
  $background.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

foreach ($size in 16, 32, 48, 128) {
  New-IconPng -Size $size -Path (Join-Path $iconsDir "icon$size.png")
}

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (Test-Path $chrome) {
  $showcase = "file:///" + ((Join-Path $storeDir "showcase.html") -replace "\\", "/" -replace " ", "%20")
  $screenshot = Join-Path $storeDir "screenshot-1280x800.png"
  $profile = Join-Path "C:\tmp" ("mmc-assets-" + [Guid]::NewGuid().ToString("N"))

  & $chrome `
    "--user-data-dir=$profile" `
    "--headless=new" `
    "--disable-gpu" `
    "--no-first-run" `
    "--window-size=1280,800" `
    "--screenshot=$screenshot" `
    $showcase | Out-Null

  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $screenshot)) {
    throw "Chrome screenshot generation failed."
  }
}

Write-Output "Generated icons and store screenshot assets."
