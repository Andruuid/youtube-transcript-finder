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

## Local development

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

