# NoAI

NoAI filters AI slop without making browsing feel like moderation. The first filter removes YouTube videos from a public catalogue of AI Slop Channels, plus each person's synced personal rules.

## Components

- `src/` is the Manifest V3 Chrome extension.
- `api/` is the Railway-ready Hono and PostgreSQL API.
- `api/drizzle/` contains the PostgreSQL migration history.
- `web/` is the public NoAI landing page and live catalogue status view.

The extension downloads a compact, versioned Catalogue Snapshot at most once per hour. It receives only active YouTube Channel IDs; evidence, rationales, and Maintainer identities are not distributed to browsers.

## Development

```sh
pnpm install
pnpm test
pnpm check
pnpm build
```

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
  "channelIds": ["UCabcdefghijklmnopqrstuv"]
}
```

`POST /v1/evidence-submissions` accepts anonymous supporting evidence after Turnstile validation and a privacy-preserving daily rate limit. It remains disabled until `TURNSTILE_SECRET_KEY` is configured and never publishes a designation.

Maintainer routes use a GitHub OAuth access token and require the corresponding GitHub user ID to be active in the `maintainers` table:

- `GET /v1/maintainer/evidence-submissions`
- `POST /v1/maintainer/designations`
- `POST /v1/maintainer/designations/:channelId/remove`

## Railway

Deploy the API, website, and Railway Postgres as separate services. Configure the API service to build with `pnpm install --frozen-lockfile && pnpm --filter @noai/api build`, migrate with `pnpm --filter @noai/api db:migrate`, and start with `pnpm --filter @noai/api start`. Configure the website service to build with `pnpm install --frozen-lockfile && pnpm --filter @noai/web build` and start with `pnpm --filter @noai/web start`. Point `api.noai.eslee.io` at the API service and `noai.eslee.io` at the website service through the `eslee-io` domain infrastructure.
