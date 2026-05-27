# Waits for cloudflared login, then runs setup-cloudflared-tunnel.ps1 automatically.
# Usage: .\scripts\complete-tunnel-setup.ps1

$ErrorActionPreference = 'Stop'
$CertPath = Join-Path $env:USERPROFILE '.cloudflared\cert.pem'
$SetupScript = Join-Path $PSScriptRoot 'setup-cloudflared-tunnel.ps1'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

if (-not (Test-Path $CertPath)) {
  Write-Step 'Opening Cloudflare login — authorize and choose marketsresearch.net in your browser'
  Start-Process cloudflared -ArgumentList 'tunnel', 'login' -NoNewWindow -Wait
}

if (-not (Test-Path $CertPath)) {
  Write-Step 'Waiting for authorization (up to 10 minutes)...'
  $deadline = (Get-Date).AddMinutes(10)
  while (-not (Test-Path $CertPath) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
  }
}

if (-not (Test-Path $CertPath)) {
  Write-Error "Login not completed. Run: cloudflared tunnel login"
}

Write-Step 'Login OK — running tunnel setup'
& $SetupScript

Write-Step 'Verifying DNS'
Start-Sleep -Seconds 5
nslookup app.marketsresearch.net 1.1.1.1

Write-Host "`nDone. Restart npm run dev:full, then open https://app.marketsresearch.net" -ForegroundColor Green
