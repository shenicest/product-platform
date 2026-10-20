<#
.SYNOPSIS
    Regenerate the whole UI-walkthrough snapshot set with one command.

.DESCRIPTION
    Wraps the three pieces the walkthrough needs:

      1. environment  - locate Node/Python (bundled DSH runtime if present)
      2. seed         - demo talents/hackathon/connections + signed tokens
      3. snapshot     - render each page to a self-contained HTML file

    Both steps are idempotent, so rerunning is always safe.

.EXAMPLE
    ./scripts/snapshot-all.ps1

.EXAMPLE
    # one page, no Chrome verification pass
    ./scripts/snapshot-all.ps1 -Only 09-founder-dashboard -NoVerify

.EXAMPLE
    # snapshot only; reuse tokens/fixtures from a previous run
    ./scripts/snapshot-all.ps1 -SkipSeed
#>
[CmdletBinding()]
param(
    # Snapshot only these pages (name or route). Default: all.
    [string[]] $Only,

    # Reuse the existing fixtures and tokens.
    [switch] $SkipSeed,

    # Skip the headless-Chrome screenshot pass.
    [switch] $NoVerify,

    # Base URL of the running web app.
    [string] $BaseUrl = 'http://localhost:3000'
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

# ---------------------------------------------------------------- environment ---
# Prefer the bundled DSH runtime: it ships fonttools and Pillow, which the
# snapshot script uses to subset fonts and re-encode images. Without them the
# output still builds, just much larger.
$runtime = Join-Path $env:USERPROFILE '.dsh/dsh-runtimes/dsh-primary-runtime/dependencies'

$node = (Get-Command node -ErrorAction SilentlyContinue)?.Source
if (-not $node -and (Test-Path "$runtime/node/bin/node.exe")) {
    $node = "$runtime/node/bin/node.exe"
}
if (-not $node) { throw 'node not found. Install Node >= 18 or add it to PATH.' }

if (-not $env:PYTHON -and (Test-Path "$runtime/python/python.exe")) {
    $env:PYTHON = "$runtime/python/python.exe"
}

Write-Host "node    $node"
Write-Host "python  $($env:PYTHON ?? 'python (PATH)')"
Write-Host "target  $BaseUrl"

# ------------------------------------------------------------------- preflight ---
# Fail before touching the database if the app is not up.
try {
    $probe = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec 10
    Write-Host "web     HTTP $($probe.StatusCode)"
} catch {
    throw "cannot reach $BaseUrl - start it first: bun run dev:web"
}

# The API is a separate process; seeding writes through it, so it must be up too.
if (-not $SkipSeed) {
    try {
        $null = Invoke-WebRequest -Uri 'http://localhost:3001/projects?limit=1' -UseBasicParsing -TimeoutSec 10
    } catch {
        throw 'cannot reach the API at http://localhost:3001 - start it first: bun run dev'
    }
}

# ------------------------------------------------------------------------ seed ---
if (-not $SkipSeed) {
    Write-Host "`n=== seed fixtures ===" -ForegroundColor Cyan
    & $node scripts/snapshot-seed.mjs
    if ($LASTEXITCODE -ne 0) { throw "seeding failed (exit $LASTEXITCODE)" }
}

# -------------------------------------------------------------------- snapshot ---
Write-Host "`n=== snapshot ===" -ForegroundColor Cyan
$snapshotArgs = @('scripts/snapshot-all.mjs')
if ($Only) { foreach ($page in $Only) { $snapshotArgs += @('--only', $page) } }
if ($NoVerify) { $snapshotArgs += '--no-verify' }

$env:SNAPSHOT_BASE_URL = $BaseUrl
& $node @snapshotArgs
$code = $LASTEXITCODE

if ($code -ne 0) {
    Write-Host "`nsnapshot finished with failures (exit $code)" -ForegroundColor Yellow
    exit $code
}

Write-Host "`ndone - open .scratch/snapshot/*.html" -ForegroundColor Green
