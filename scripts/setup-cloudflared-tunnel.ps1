# One-time setup for a stable Cloudflare Tunnel to this app.
# Prerequisites: cloudflared installed, domain Active in Cloudflare, app uses port 3221.
#
# Usage (from repo root):
#   .\scripts\setup-cloudflared-tunnel.ps1

$ErrorActionPreference = 'Stop'

$TUNNEL_NAME = 'ytf'
$HOSTNAME = 'app.marketsresearch.net'
$LOCAL_SERVICE = 'http://localhost:3221'
$CloudflaredDir = Join-Path $env:USERPROFILE '.cloudflared'
$CertPath = Join-Path $CloudflaredDir 'cert.pem'
$ConfigPath = Join-Path $CloudflaredDir 'config.yml'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Error 'cloudflared is not installed. Download: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/'
}

if (-not (Test-Path $CertPath)) {
  Write-Step 'Log in to Cloudflare (browser will open). Choose marketsresearch.net when prompted.'
  cloudflared tunnel login
  if (-not (Test-Path $CertPath)) {
    Write-Error "Login did not create $CertPath. Run: cloudflared tunnel login"
  }
}

Write-Step 'Checking for existing tunnel'
$existing = cloudflared tunnel list 2>&1 | Out-String
$tunnelId = $null

if ($existing -match "$TUNNEL_NAME\s+([0-9a-f-]{36})") {
  $tunnelId = $Matches[1]
  Write-Host "Using existing tunnel '$TUNNEL_NAME' ($tunnelId)"
} else {
  Write-Step "Creating tunnel '$TUNNEL_NAME'"
  $createOut = cloudflared tunnel create $TUNNEL_NAME 2>&1 | Out-String
  Write-Host $createOut
  if ($createOut -match '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') {
    $tunnelId = $Matches[1]
  }
  if (-not $tunnelId) {
    $listOut = cloudflared tunnel list 2>&1 | Out-String
    if ($listOut -match "$TUNNEL_NAME\s+([0-9a-f-]{36})") {
      $tunnelId = $Matches[1]
    }
  }
  if (-not $tunnelId) {
    Write-Error 'Could not determine tunnel ID. Run: cloudflared tunnel list'
  }
}

$credsFile = Join-Path $CloudflaredDir "$tunnelId.json"
if (-not (Test-Path $credsFile)) {
  Write-Error "Credentials file missing: $credsFile"
}

Write-Step 'Writing config.yml'
if (-not (Test-Path $CloudflaredDir)) {
  New-Item -ItemType Directory -Path $CloudflaredDir | Out-Null
}

$config = @"
tunnel: $tunnelId
credentials-file: $credsFile

ingress:
  - hostname: $HOSTNAME
    service: $LOCAL_SERVICE
  - service: http_status:404
"@

Set-Content -Path $ConfigPath -Value $config -Encoding UTF8
Write-Host "Wrote $ConfigPath"

Write-Step "Routing DNS: $HOSTNAME -> tunnel '$TUNNEL_NAME'"
cloudflared tunnel route dns $TUNNEL_NAME $HOSTNAME

Write-Step 'Done'
Write-Host @"

Tunnel ID:     $tunnelId
Public URL:    https://$HOSTNAME
Config:        $ConfigPath

Before sharing:
  1. Set ACCESS_PASSWORD in server/.env
  2. Wait until marketsresearch.net is Active in Cloudflare (nameserver propagation)
  3. Start the app:   npm run dev:full
  4. Start tunnel:    npm run tunnel
     (or both:         npm run share)

"@ -ForegroundColor Green
