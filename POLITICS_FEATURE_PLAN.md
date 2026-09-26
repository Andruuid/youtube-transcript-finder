# Politics Transcript Corpus Implementation Plan

Source Request:
Implement a Politics tab with ordered left/right channel lists, sustainable catalog syncing,
stored transcript collection, corpus browsing, and no fact-checking in V1.

Global Constraints:
- Keep each phase under about 150k tokens of expected agent work.
- Preserve existing user changes.
- Verify each phase before marking it implemented.

Phase Status Summary:
- P01: implemented - Persistence, catalog sync, and Politics APIs
- P02: implemented - Politics tab and transcript collection UI
- P03: implemented - Automated tests and end-to-end verification

## Phase P01: Persistence, Catalog Sync, and Politics APIs
Status: implemented
Token Budget: <=120k

Goal:
Provide the persisted Politics board, quota-efficient channel catalog sync, protected deletion,
and paginated Politics corpus API.

Scope:
- Add the Prisma schema and migration.
- Refactor channel sync into a reusable backend service.
- Use uploads playlists instead of channel search paging.
- Add Politics board, membership mutation, and corpus endpoints.
- Preserve current channel sync response contracts.

Non-Goals:
- React UI.
- OpenRouter fact-checking.

Inputs:
- `server/prisma/schema.prisma`
- `server/index.js`
- `server/src/services/youtubeCatalogService.js`
- Existing channel/video serializers and transcript storage.

Implementation Steps:
- Add `Channel.uploadsPlaylistId` and `PoliticsChannel`.
- Implement reusable channel sync and Politics services.
- Add and validate API routes, including maximum list sizes and stable positions.
- Block destructive global channel deletion while Politics membership exists.

Verification:
- Generate Prisma client.
- Run server syntax/import checks.
- Exercise validation helpers in server tests where practical.

Completion Criteria:
- Database migration applies without transcript data duplication.
- Politics APIs return stable ordered DTOs.
- Existing channel sync still works with the same public request/response shape.

Execution Log:
- 2026-07-30: implemented - Added migration and generated Prisma client; switched catalog sync to uploads playlists; added validated Politics board/corpus APIs and protected channel deletion. Backend imports and empty-board query verified; transcript server restarted.

## Phase P02: Politics Tab and Transcript Collection UI
Status: implemented
Token Budget: <=120k

Goal:
Deliver the user-facing Politics board, balanced bulk collector, corpus filters, and reader flow.

Scope:
- Add the Politics tab immediately before Search.
- Implement ordered Left and Right channel panels.
- Add collection scope/target/progress/stop behavior.
- Add paginated corpus filters, individual retry, and transcript reader reuse.
- Extend client services with optional abort signals.

Non-Goals:
- Fact-check or issue-comparison UI.
- Hard-coded political channel classifications.

Inputs:
- Phase P01 APIs.
- Existing Channel Monitor pipeline, avatars, and transcript reader.

Implementation Steps:
- Add Politics client service and component styling.
- Make the bulk pipeline target-depth correct and abort-aware.
- Implement balanced both-side channel ordering and resilient progress summaries.
- Wire navigation, subtitles, and application panel.

Verification:
- Build the React application.
- Manually inspect component state paths and API contracts.

Completion Criteria:
- Users can populate, order, move, and remove up to 10 channels per side.
- Collection is resumable/idempotent and corpus rows open stored transcripts.

Execution Log:
- 2026-07-30: implemented - Added Politics client APIs, abort-aware newest-N pipeline, ordered two-sided board, balanced collector, corpus filters/pagination, individual retry, and transcript reader integration. Production build compiles cleanly and browser verification confirmed the empty-board layout and navigation.

## Phase P03: Automated Tests and End-to-End Verification
Status: implemented
Token Budget: <=100k

Goal:
Restore the test harness and cover the important data, API, pipeline, and UI behavior.

Scope:
- Mock the ESM-only Markdown dependency for Jest.
- Replace the obsolete starter test.
- Add frontend and server tests for core feature rules.
- Run database migration checks, tests, and production build.

Non-Goals:
- Live YouTube/OpenRouter calls in CI.

Inputs:
- Implemented backend and frontend phases.

Implementation Steps:
- Add focused service/helper tests with external requests mocked.
- Add navigation and Politics UI behavior tests.
- Run full verification and fix regressions.

Verification:
- `npm test -- --watchAll=false`
- Server `node:test` suite.
- `npm run build`
- Prisma migration status/generation checks.

Completion Criteria:
- Tests pass without live credentials.
- Production build succeeds.
- Any environment-only acceptance limits are documented.

Execution Log:
- 2026-07-30: implemented - Restored Jest via a ReactMarkdown mock; added 8 frontend and 6 backend tests for navigation, empty UI, side assignment, balanced ordering, catalog refresh, abort behavior, validation, capacity, and playlist mapping. Prisma validate/status, authenticated read-only API smoke checks, git diff checks, and production build all pass.

## Deferred Decisions

- None.
