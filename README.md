# NoAI

NoAI filters AI slop without making browsing feel like moderation. The first filter removes YouTube videos from a public catalogue of AI Slop Channels, plus each person's synced personal rules.

## Components

- `src/` is the Manifest V3 Chrome extension.
- `api/` is the Railway-ready Hono and PostgreSQL API.
- `api/drizzle/` contains the PostgreSQL migration history.

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

`POST /v1/evidence-submissions` accepts anonymous supporting evidence after Turnstile validation and a privacy-preserving daily rate limit. It never publishes a designation.

Maintainer routes use a GitHub OAuth access token and require the corresponding GitHub user ID to be active in the `maintainers` table:

- `GET /v1/maintainer/evidence-submissions`
- `POST /v1/maintainer/designations`
- `POST /v1/maintainer/designations/:channelId/remove`

## Railway

`railway.toml` builds and starts the API from the repository root. Deploy the API and Railway Postgres as separate services, set the API environment variables, then point `api.noai.eslee.io` at the Railway API service through the `eslee-io` domain infrastructure. The planned public site remains `noai.eslee.io` and is intentionally not part of this repository yet.
