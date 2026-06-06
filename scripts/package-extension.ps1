$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version

$distDir = Join-Path $root "dist"
$buildDir = Join-Path $distDir "mouse-multicopy"
$zipPath = Join-Path $distDir "mouse-multicopy-$version.zip"

if (-not ($buildDir.StartsWith($distDir))) {
  throw "Build path resolved outside dist directory."
}

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
if (Test-Path $buildDir) {
  Remove-Item -LiteralPath $buildDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

$files = @(
  "manifest.json",
  "background.js",
  "state.js",
  "clipboard.js",
  "content.js",
  "content.css",
  "popup.html",
  "popup.js",
  "popup.css",
  "welcome.html"
)

foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $buildDir $file)
}

Copy-Item -LiteralPath (Join-Path $root "icons") -Destination (Join-Path $buildDir "icons") -Recurse

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $buildDir "*") -DestinationPath $zipPath -Force

Write-Output "Created $zipPath"
