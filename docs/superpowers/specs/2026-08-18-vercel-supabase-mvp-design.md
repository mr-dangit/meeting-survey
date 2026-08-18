# Vercel + Supabase Meeting Feedback MVP Design

## Goal

Move the working meeting-feedback MVP from its temporary Render deployment model to Vercel and Supabase without changing the user experience, privacy guarantees, or report calculations. The result should be deployable quickly and remain easy to improve later.

## Scope

This migration includes:

- serving the existing React/Vite client from Vercel;
- running the existing Fastify API in a Vercel Node Function;
- storing meetings and anonymous responses in the existing healthy Supabase project `meeting-survey`;
- applying the existing schema through a committed Supabase migration;
- configuring Vercel environment variables without exposing secret values;
- verifying the complete administrator, survey, report, and close-survey flow.

It excludes Next.js migration, Supabase Auth, Supabase client libraries in the browser, Edge Functions, email, Microsoft 365 integration, and new product features.

## Architecture

The Vite production build remains the frontend. Vercel serves its static files and rewrites `/api/*` to one Node Function. That function adapts Vercel requests to the existing Fastify application so the current routes, services, repositories, validation, cookies, and view models remain authoritative.

The function connects directly to PostgreSQL with the existing `pg` repositories. Runtime traffic uses Supabase's transaction-pooler connection string because Vercel Functions are transient. The pool is cached at module scope with a deliberately small maximum size so warm function instances can reuse connections without exhausting the database. Queries remain unnamed and therefore compatible with transaction pooling.

A separate direct or session-mode database URL is used only by the migration command. The browser receives no Supabase URL, publishable key, database credential, or service-role key.

## Database and security

The existing `meetings`, `responses`, and `schema_migrations` model remains unchanged. A committed Supabase migration creates these tables, constraints, and the response lookup index.

All application tables remain in `public` for the lean MVP, but Row Level Security is enabled. No policies or grants are added for `anon` or `authenticated`, because the Supabase Data API is not part of the application. Vercel accesses PostgreSQL through a protected server-side connection string. The administrator passphrase, session secret, survey secrets, and report secrets preserve the existing security model; only hashes of survey and report secrets are stored.

No attendee identity, IP address, browser fingerprint, user-agent string, or access secret is stored with a response. Reports still hide all values until three responses exist.

## Request and deployment flow

1. Vercel serves the React application.
2. The client calls the existing same-origin `/api` routes.
3. A single Vercel Function initializes or reuses the Fastify app and PostgreSQL pool.
4. Fastify performs the current validation, access checks, persistence, and report aggregation.
5. Supabase stores meetings and anonymous responses.
6. Vercel returns the existing purpose-specific API view model.

The repository will include Vercel configuration for the Vite output, SPA fallback, API rewrite, and Node runtime. Render configuration can be removed once Vercel verification succeeds.

## Configuration

Vercel requires these secret environment variables:

- `DATABASE_URL`: Supabase transaction-pooler URL for function traffic;
- `MIGRATION_DATABASE_URL`: Supabase direct or session-mode URL for schema migration;
- `ADMIN_PASSPHRASE`: existing administrator login secret;
- `SESSION_SECRET`: high-entropy cookie-signing secret;
- `NODE_ENV=production`.

Only variable names are documented or logged. Secret values are never committed or printed.

## Error handling

Database connection and query failures continue to return generic, non-sensitive API errors. Function initialization must fail clearly when required configuration is missing. The health endpoint remains independent of confidential values and returns only `{ "status": "ok" }` after application initialization succeeds.

Migrations are idempotent. A failed migration stops deployment verification and is not retried blindly. Existing Fastify log redaction remains in place for request bodies and access headers.

## Testing and verification

The existing unit, route, repository, and full-flow tests remain the regression baseline. New tests cover the Vercel handler adapter and Supabase-compatible pool configuration without calling production services.

Verification consists of:

1. running the full automated test suite and production build;
2. applying the committed migration to the selected Supabase project;
3. confirming the expected tables, constraints, index, and RLS state;
4. checking Supabase security and performance advisors;
5. deploying to Vercel with protected environment variables;
6. creating one meeting, submitting three responses, verifying the aggregate report, closing the survey, and confirming a further submission is rejected.

## MVP completion criteria

The migration is complete when the Vercel URL serves the application over HTTPS, all existing automated tests pass, the Supabase schema passes advisor checks or has documented non-blocking notices, and the live administrator-to-report flow works with data surviving a Vercel redeployment.
