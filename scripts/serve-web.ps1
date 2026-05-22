param(
  [int]$Port = 5173,
  [string]$Root = (Join-Path (Resolve-Path "$PSScriptRoot\..").Path "web-build")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath (Join-Path $Root "index.html"))) {
  throw "Missing web-build/index.html. Run scripts/export-web.ps1 first."
}

Push-Location $Root
try {
  python -m http.server $Port --bind 127.0.0.1
} finally {
  Pop-Location
}
