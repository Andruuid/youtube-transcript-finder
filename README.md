# Market Research Tool

## Setup

1. Copy env template and add your YouTube API key:

   ```bash
   cp .env.example server/.env
   ```

2. Edit `server/.env` and set `YOUTUBE_API_KEY` to a valid **YouTube Data API v3** key:
   - Open [Google Cloud Console](https://console.cloud.google.com/)
   - Create or select a project
   - Enable **YouTube Data API v3**
   - Create an API key under **APIs & Services → Credentials**
   - Paste the key into `server/.env` (replace `your_youtube_data_api_key`)

3. Install dependencies and start the app (see below).

Channel import and sync call the backend server, which reads `YOUTUBE_API_KEY` from `server/.env`. If that value is missing or still the placeholder, imports fail with `API key not valid`.

## Crypto research

The **Crypto** tab compares up to three saved Channel Monitor channels with BTC,
ETH and SOL daily prices. Ivan on Tech is selected initially when present.

- **Analyze** uses saved transcripts at least 180 seconds long. It calls
  `openai/gpt-6-luna` through the existing server `OPENROUTER_API_KEY`; there is no
  model fallback. Unchanged successful analyses are reused. The pending count is
  displayed before starting. This action incurs OpenRouter usage charges.
- **Import history** independently imports the selected channels' catalogs and
  missing transcripts back to the selected start date (January 2021 by default).
  Downloads use the same YouTube configuration as Channel Monitor. Unavailable
  transcripts and unknown durations remain visibly excluded.
- **Calibrate** saves a versioned profile from analyzed transcripts. Historical
  relative scores use only the preceding 365 days and require 20 earlier scores
  per channel/asset. Manual overrides are available in baseline settings and do
  not change raw scores or outcome calculations.
- Click a chart point or ledger entry to inspect summaries, exact transcript
  evidence, explicit forecasts/actions, and the full saved transcript.
- Select a 7/30/90-day outcome window. Entry is the first UTC daily open strictly
  after publication; exit is the close of the final day. Conditional, conflicting,
  neutral, and merely descriptive statements are excluded from forecast accuracy.
  General crypto forecasts use BTC; coin-specific forecasts use that asset.
  Returns describe the asset, not a simulated trading strategy.

Jobs survive tab changes and checkpoint their progress in SQLite. Restarted work
is paused and can be resumed; provider authentication/quota failures pause work.
Stop preserves completed results; retry failed items from the progress panel.
Run a single API server against a database so there is one job worker.

Prices are cached from Coinbase Exchange, with daily USD coverage displayed for
each coin. Missing days (including SOL before its listing) are not invented. Price
history refreshes independently of AI work. Multiple overlays are indexed to 100
on the first shared available date. Historical reconstruction and small sample
sizes do not establish predictive skill.

After pulling the feature, back up the configured SQLite database and apply the
additive migration, then restart the API:

```powershell
cd server
npx prisma migrate deploy
npx prisma generate
```

The `/api/crypto` routes use the existing access gate: `GET /coverage`,
`GET /dashboard`, `GET /analyses`, `GET /analyses/:id`, `GET /jobs`,
`POST /jobs`, `POST /jobs/:id/{stop,resume,retry}`, and
`PATCH /calibration/:channelId`. Selection requests take `channelIds` (1–3 saved
YouTube IDs), `from`, and `to` (UTC dates). Dashboard requests also accept
`series=overall|BTC|ETH|SOL` and `horizon=7|30|90`. Job kinds are `analysis`,
`calibration`, `history`, and `prices`.

Crypto backend tests include an isolated temporary database and mocked providers;
they never modify the live library or call paid AI services.

## Running locally

### YouTube transcript sign-in

If YouTube asks to confirm you are not a bot, sign in to YouTube in your browser
and export **youtube.com only** in Netscape cookies.txt format. Save the export as
`server/youtube.cookies.txt`. Do not use an all-sites export: it can contain
conflicting sessions. This file is gitignored and read on every download, so
replacing it does not require a restart. Keep it private; it contains your session.

The downloader authenticates player requests and refreshes caption URLs when the
watch page returns empty captions. If YouTube still blocks requests, bulk jobs
stop and keep completed downloads. Replace expired cookies or wait before retrying;
rerunning the job skips transcripts already saved. `YOUTUBE_COOKIE` or
`YOUTUBE_COOKIES` in the server environment overrides the file and needs a restart
when changed.

In the project root, run:

### `npm run dev:full`

Starts both the React app and transcript API server together.

- Frontend: [http://localhost:3221](http://localhost:3221)
- Backend API: [http://localhost:3222](http://localhost:3222)

If you only run `npm run dev`, the frontend starts without the backend and `/api/*` requests will fail with a proxy error.

## Share with friends (Cloudflare Tunnel)

Public URL: **https://app.marketsresearch.net** (stable; does not change when you restart the tunnel).

**One-time setup** (after Cloudflare shows `marketsresearch.net` as Active):

1. Log in cloudflared on this laptop (browser opens once):

   ```powershell
   cloudflared tunnel login
   ```

   Select **marketsresearch.net** in the browser.

2. Run the setup script from the project root:

   ```powershell
   .\scripts\setup-cloudflared-tunnel.ps1
   ```

   This creates tunnel `ytf`, writes `%USERPROFILE%\.cloudflared\config.yml`, and routes DNS for `app.marketsresearch.net`. The **tunnel ID** is printed by `cloudflared tunnel create` — you do not copy it from the Cloudflare website.

3. Set `ACCESS_PASSWORD` in `server/.env` so only people you share the password with can use the app.

**Each time you want friends to connect:**

```powershell
npm run dev:full
```

That starts the app and opens the tunnel if it is not already running. Share the URL and the password.

Local development without touching cloudflared: `npm run dev:local`

Full details: [docs/sharing-with-cloudflare-tunnel.md](docs/sharing-with-cloudflare-tunnel.md)

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

