param(
  [string]$GodotExe = "C:\tmp\godot45\Godot_v4.5-stable_win64_console.exe",
  [string]$ProjectDir = (Resolve-Path "$PSScriptRoot\..").Path,
  [string]$OutputDir = "web-build"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $GodotExe)) {
  throw "Godot 4.5 console executable not found: $GodotExe"
}

$outputPath = Join-Path $ProjectDir $OutputDir
if (Test-Path -LiteralPath $outputPath) {
  Remove-Item -LiteralPath $outputPath -Recurse -Force
}
New-Item -ItemType Directory -Force $outputPath | Out-Null

& $GodotExe --headless --path $ProjectDir --export-release "Web Preview" (Join-Path $OutputDir "index.html")
if ($LASTEXITCODE -ne 0) {
  throw "Godot Web export failed with code $LASTEXITCODE"
}

Write-Host "Web preview exported to $outputPath"
