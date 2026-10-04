# NoAI

NoAI filters AI slop without making browsing feel like moderation. The first filter removes YouTube videos from a public catalogue of AI Slop Channels, plus each person's synced personal rules.

## Components

- `src/` is the Manifest V3 Chrome extension.
- `api/` is the Railway-ready Hono and PostgreSQL API.
- `api/drizzle/` contains the PostgreSQL migration history.
- `web/` is the public NoAI landing page and live catalogue status view.

The extension downloads a compact, versioned Catalogue Snapshot at most once per hour, plus a per-channel revalidation at most once per hour when viewing a channel page. It receives only active YouTube Channel IDs plus whitelisted Trusted Channel IDs; evidence, rationales, and Maintainer identities are not distributed to browsers. Trusted channels are never filtered and never show Hide as AI slop.

## Development

```sh
pnpm install
pnpm test
pnpm test:e2e
pnpm check
pnpm build
```

End-to-end tests use Playwright with a real Chromium against the web dev
server (`pnpm test:e2e`, config in `playwright.config.ts`, specs in `e2e/`).
They mock the API at the network boundary, stub Turnstile, and fail on any
uncaught page error. Install the browser once with
`npx playwright install chromium`.

To load the extension locally, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose `dist` after `pnpm build:extension`.

The API requires the variables in `api/.env.example`. Run database migrations and bootstrap the first Maintainer after configuring a PostgreSQL database:

```sh
pnpm --filter @noai/api db:migrate
pnpm --filter @noai/api db:seed-maintainer
```

## API

`GET /v1/catalogue` is public and returns a cacheable snapshot:

```json
{
  "version": "12",
  "channelIds": ["UCabcdefghijklmnopqrstuv"],
  "trustedChannelIds": ["UCzyxwvutsrqponmlkjihgfe"]
}
```

`POST /v1/evidence-submissions` accepts anonymous supporting evidence after Turnstile validation and a privacy-preserving daily rate limit. It remains disabled until `TURNSTILE_SECRET_KEY` is configured and never publishes a designation.

`POST /v1/trust-submissions` accepts anonymous whitelist requests after Turnstile validation and the same privacy-preserving daily rate limit. A trusted designation means NoAI never filters the channel and never shows Hide as AI slop for it.

Maintainer routes use GitHub App user authorization and require the corresponding GitHub user ID to be active in the `maintainers` table. Configure `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_ID`, and `GITHUB_APP_PRIVATE_KEY` on the API service to enable `https://noai.eslee.io/maintain`:

- `GET /v1/maintainer/evidence-submissions`
- `POST /v1/maintainer/designations`
- `POST /v1/maintainer/designations/:channelId/remove`
- `POST /v1/maintainer/trust-submissions/:id/review`
- `POST /v1/maintainer/trusted-designations`
- `POST /v1/maintainer/trusted-designations/:channelId/remove`

## Railway

Deploy the API, website, and Railway Postgres as separate services. Configure the API service to build with `pnpm install --frozen-lockfile && pnpm --filter @noai/api build`, migrate with `pnpm --filter @noai/api db:migrate`, and start with `pnpm --filter @noai/api start`. Configure the website service to build with `pnpm install --frozen-lockfile && pnpm --filter @noai/web build` and start with `pnpm --filter @noai/web start`. Point `api.noai.eslee.io` at the API service and `noai.eslee.io` at the website service through the `eslee-io` domain infrastructure.
