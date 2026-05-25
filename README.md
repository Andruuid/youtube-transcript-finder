# YouTube Transcript Tool

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

In the project root, run:

### `npm run dev:full`

Starts both the React app and transcript API server together.

- Frontend: [http://localhost:3221](http://localhost:3221)
- Backend API: [http://localhost:3222](http://localhost:3222)

If you only run `npm run dev`, the frontend starts without the backend and `/api/*` requests will fail with a proxy error.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

