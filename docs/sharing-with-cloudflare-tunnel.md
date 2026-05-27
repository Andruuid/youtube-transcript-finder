# Share the app with friends (Cloudflare Tunnel)

Stable public URL: **https://app.marketsresearch.net**

The React dev server (port 3221) proxies `/api` to the transcript server, so the tunnel only needs to point at **3221**.

## One-time setup

### 1. Domain on Cloudflare

- Domain: `marketsresearch.net` (GoDaddy registrar, Cloudflare DNS)
- Nameservers at GoDaddy must point to Cloudflare
- Wait until the Cloudflare dashboard shows the site as **Active** (not “Waiting for registrar…”)

### 2. Log in cloudflared (once per laptop)

This is **not** the same as logging into the Cloudflare website. It creates `cert.pem` on your machine.

```powershell
cloudflared tunnel login
```

In the browser, select **marketsresearch.net** and authorize.

### 3. Run the setup script

From the project root:

```powershell
.\scripts\setup-cloudflared-tunnel.ps1
```

The script will:

1. Create a named tunnel called `ytf` (if it does not exist yet)
2. Write `%USERPROFILE%\.cloudflared\config.yml`
3. Create DNS: `app.marketsresearch.net` → your tunnel

### Where does the tunnel ID come from?

You do **not** look it up in the Cloudflare dashboard. Cloudflared generates it when you create the tunnel:

```powershell
cloudflared tunnel create ytf
```

Example output:

```text
Created tunnel ytf with id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

That UUID is the **tunnel ID**. It is used in:

- `%USERPROFILE%\.cloudflared\<TUNNEL-ID>.json` (credentials — keep private)
- `%USERPROFILE%\.cloudflared\config.yml` (`tunnel:` and `credentials-file:`)

List tunnels anytime:

```powershell
cloudflared tunnel list
```

### 4. Set a shared password

In `server/.env`:

```env
ACCESS_PASSWORD=choose-a-long-password-for-friends
```

Restart the app after changing this. Friends see the login screen before using the app.

## Daily use

Start the app (tunnel starts automatically if configured and not already running):

```powershell
npm run dev:full
```

If the tunnel is already running (e.g. `cloudflared service`), the script detects it and skips starting a second one.

Local only, no tunnel attempt:

```powershell
npm run dev:local
```

Share: **https://app.marketsresearch.net**

The URL stays the same every time. Only the tunnel process must be running (and your laptop must be on).

## Manual config (optional)

See `scripts/cloudflared.config.example.yml`. Live config lives at:

```text
C:\Users\<you>\.cloudflared\config.yml
```

Do not commit credentials (`*.json`, `cert.pem`) to git.

## Run tunnel on Windows startup (optional)

After setup:

```powershell
cloudflared service install
cloudflared service start
```

You still need to start the app separately (`npm run dev:full` or a scheduled task).

## Troubleshooting

| Problem | Fix |
|--------|-----|
| `cert.pem` / origin cert errors | Run `cloudflared tunnel login` |
| Cloudflare site “Pending nameservers” | Wait for GoDaddy → Cloudflare propagation |
| 502 Bad Gateway | App not running — start `npm run dev:full` |
| Wrong site on root domain | Expected — root still has GoDaddy A records; use `app.marketsresearch.net` |
| Quick `trycloudflare.com` URL | Temporary only; use named tunnel for a fixed URL |

## Quick tunnel (testing only)

Random URL, changes every restart:

```powershell
cloudflared tunnel --url http://localhost:3221
```

Use the named tunnel (`npm run tunnel`) for sharing with friends long term.
