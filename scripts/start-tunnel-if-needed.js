/**
 * Starts `cloudflared tunnel run ytf` unless a ytf tunnel is already running.
 * Used by npm run dev:full — exits 0 immediately when skipped so concurrently keeps going.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TUNNEL_NAME = 'ytf';
const PUBLIC_URL = 'https://app.marketsresearch.net';

function log(message) {
  console.log(`[tunnel] ${message}`);
}

function cloudflaredConfigPath() {
  return path.join(os.homedir(), '.cloudflared', 'config.yml');
}

function hasCloudflared() {
  try {
    execSync('cloudflared --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getCloudflaredCommandLines() {
  if (process.platform === 'win32') {
    try {
      const ps =
        "Get-CimInstance Win32_Process -Filter \"Name='cloudflared.exe'\" | ForEach-Object { $_.CommandLine }";
      return execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
    } catch {
      return '';
    }
  }

  try {
    return execSync('ps -ax -o command= 2>/dev/null | grep cloudflared || true', {
      encoding: 'utf8',
      shell: true
    });
  } catch {
    return '';
  }
}

function isTunnelAlreadyRunning() {
  const lines = getCloudflaredCommandLines().toLowerCase();
  if (!lines.includes('cloudflared')) return false;

  // Named tunnel started by us or cloudflared service using config.yml
  if (lines.includes(`tunnel run ${TUNNEL_NAME.toLowerCase()}`)) return true;
  if (lines.includes('tunnel run') && lines.includes('.cloudflared')) return true;

  return false;
}

function main() {
  if (!hasCloudflared()) {
    log('cloudflared not installed — skipping (app runs locally only).');
    log('See docs/sharing-with-cloudflare-tunnel.md to set up sharing.');
    process.exit(0);
  }

  if (!fs.existsSync(cloudflaredConfigPath())) {
    log('No ~/.cloudflared/config.yml — skipping tunnel.');
    log('Run .\\scripts\\setup-cloudflared-tunnel.ps1 once after cloudflared tunnel login.');
    process.exit(0);
  }

  if (isTunnelAlreadyRunning()) {
    log(`already running — skipping (friends can use ${PUBLIC_URL}).`);
    process.exit(0);
  }

  log(`starting tunnel "${TUNNEL_NAME}" → ${PUBLIC_URL}`);

  const child = spawn('cloudflared', ['tunnel', 'run', TUNNEL_NAME], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  child.on('error', (err) => {
    log(`failed to start: ${err.message}`);
    process.exit(0);
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      log(`exited with code ${code} — app still runs locally.`);
    }
    process.exit(code || 0);
  });
}

main();
