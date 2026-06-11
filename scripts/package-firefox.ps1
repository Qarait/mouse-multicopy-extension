$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "manifest.firefox.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version

$distDir = Join-Path $root "dist"
$buildDir = Join-Path $distDir "mouse-multicopy-firefox"
$zipPath = Join-Path $distDir "mouse-multicopy-firefox-$version.zip"

if (-not ($buildDir.StartsWith($distDir))) {
  throw "Build path resolved outside dist directory."
}

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
if (Test-Path $buildDir) {
  Remove-Item -LiteralPath $buildDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

$files = @(
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

Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $buildDir "manifest.json")

foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $buildDir $file)
}

Copy-Item -LiteralPath (Join-Path $root "icons") -Destination (Join-Path $buildDir "icons") -Recurse

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archive = [System.IO.Compression.ZipFile]::Open(
  $zipPath,
  [System.IO.Compression.ZipArchiveMode]::Create
)

try {
  Get-ChildItem -LiteralPath $buildDir -File -Recurse | ForEach-Object {
    $relativePath = $_.FullName.Substring($buildDir.Length).TrimStart("\", "/")
    $entryName = $relativePath.Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $_.FullName,
      $entryName,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
}
finally {
  $archive.Dispose()
}

Write-Output "Created $zipPath"
