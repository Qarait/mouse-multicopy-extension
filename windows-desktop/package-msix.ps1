param(
  [string]$IdentityName = "MouseMultiCopy.Dev",
  [string]$Publisher = "CN=Mouse MultiCopy Dev",
  [string]$Version = "0.5.3.0"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $root "dist\windows"
$layoutDir = Join-Path $distDir "msix-layout"
$assetsDir = Join-Path $layoutDir "Assets"
$packagePath = Join-Path $distDir "MouseMultiCopy-$Version-unsigned.msix"
$makeAppx = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\makeappx.exe"

& (Join-Path $PSScriptRoot "build.ps1")

if (-not (Test-Path -LiteralPath $makeAppx)) {
  throw "MakeAppx.exe was not found at $makeAppx."
}

if (Test-Path -LiteralPath $layoutDir) {
  Remove-Item -LiteralPath $layoutDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

Copy-Item -LiteralPath (Join-Path $distDir "MouseMultiCopy.exe") -Destination $layoutDir

Add-Type -AssemblyName System.Drawing

function New-StoreAsset {
  param(
    [int]$Width,
    [int]$Height,
    [string]$OutputPath
  )

  $source = [System.Drawing.Image]::FromFile((Join-Path $root "icons\icon128.png"))
  $bitmap = New-Object System.Drawing.Bitmap $Width, $Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::FromArgb(244, 248, 245))
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

  $logoSize = [Math]::Min($Width, $Height)
  $padding = [Math]::Max(2, [int]($logoSize * 0.10))
  $drawSize = $logoSize - ($padding * 2)
  $left = [int](($Width - $drawSize) / 2)
  $top = [int](($Height - $drawSize) / 2)
  $graphics.DrawImage($source, $left, $top, $drawSize, $drawSize)
  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $graphics.Dispose()
  $bitmap.Dispose()
  $source.Dispose()
}

New-StoreAsset 44 44 (Join-Path $assetsDir "Square44x44Logo.png")
New-StoreAsset 50 50 (Join-Path $assetsDir "StoreLogo.png")
New-StoreAsset 71 71 (Join-Path $assetsDir "Square71x71Logo.png")
New-StoreAsset 150 150 (Join-Path $assetsDir "Square150x150Logo.png")
New-StoreAsset 310 150 (Join-Path $assetsDir "Wide310x150Logo.png")
New-StoreAsset 310 310 (Join-Path $assetsDir "Square310x310Logo.png")

$escapedIdentity = [System.Security.SecurityElement]::Escape($IdentityName)
$escapedPublisher = [System.Security.SecurityElement]::Escape($Publisher)

$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap rescap">
  <Identity
    Name="$escapedIdentity"
    Publisher="$escapedPublisher"
    Version="$Version"
    ProcessorArchitecture="neutral" />
  <Properties>
    <DisplayName>Mouse MultiCopy</DisplayName>
    <PublisherDisplayName>Mouse MultiCopy</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>
  <Resources>
    <Resource Language="en-us" />
  </Resources>
  <Dependencies>
    <TargetDeviceFamily
      Name="Windows.Desktop"
      MinVersion="10.0.17763.0"
      MaxVersionTested="10.0.22621.0" />
  </Dependencies>
  <Applications>
    <Application
      Id="MouseMultiCopy"
      Executable="MouseMultiCopy.exe"
      EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="Mouse MultiCopy"
        Description="Collect copied text into numbered highlights and paste it anywhere."
        BackgroundColor="transparent"
        Square150x150Logo="Assets\Square150x150Logo.png"
        Square44x44Logo="Assets\Square44x44Logo.png">
        <uap:DefaultTile
          Wide310x150Logo="Assets\Wide310x150Logo.png"
          Square310x310Logo="Assets\Square310x310Logo.png"
          Square71x71Logo="Assets\Square71x71Logo.png" />
      </uap:VisualElements>
    </Application>
  </Applications>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
"@

$manifestPath = Join-Path $layoutDir "AppxManifest.xml"
[System.IO.File]::WriteAllText(
  $manifestPath,
  $manifest,
  (New-Object System.Text.UTF8Encoding($false))
)

if (Test-Path -LiteralPath $packagePath) {
  Remove-Item -LiteralPath $packagePath -Force
}

& $makeAppx pack /d $layoutDir /p $packagePath /o
if ($LASTEXITCODE -ne 0) {
  throw "MSIX packaging failed."
}

Write-Output "Created $packagePath"
