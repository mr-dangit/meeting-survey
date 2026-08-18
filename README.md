# Meeting Feedback MVP

A React/Fastify meeting-feedback MVP hosted on Vercel with anonymous responses stored in Supabase Postgres. Administrators create meetings, attendees submit through a shared secret link, and chairs receive aggregate results only after three responses.

## Architecture

- Vercel serves the Vite client and runs the Fastify API as a Node Function.
- Supabase Postgres stores meetings and anonymous responses.
- The browser calls only same-origin `/api` routes; it receives no Supabase key or database credential.
- Runtime queries use Supabase's transaction pooler. Schema migrations use a direct or session-mode connection.

The Vercel Function runs in `bom1`, close to the current Supabase `ap-south-1` project.

## Configuration

Copy `.env.example` to `.env.local` and provide:

- `DATABASE_URL`: Supabase transaction-pooler URL using encrypted transport;
- `MIGRATION_DATABASE_URL`: Supabase direct or session-mode URL;
- `ADMIN_PASSPHRASE`: at least 12 characters;
- `SESSION_SECRET`: at least 32 random characters;
- `NODE_ENV`: `development` locally or `production` on Vercel.

Never commit either environment file or print its values.

## Local verification

```text
pnpm install
pnpm test
pnpm run build
pnpm run migrate
pnpm run dev
```

Run `pnpm run migrate` only after the target database connection has been verified.

## Vercel deployment

```text
npx vercel@latest whoami
npx vercel@latest link
npx vercel@latest env pull .env.local
npx vercel@latest --prod
```

Add `DATABASE_URL`, `ADMIN_PASSPHRASE`, and `SESSION_SECRET` to Vercel Preview and Production. Keep all values server-side. Migrations are applied separately through the Supabase connector or a trusted machine using `MIGRATION_DATABASE_URL`; the migration credential is not required by the deployed application.

The application uses hash routes, so access secrets are not sent in HTTP request URLs:

- `/#/admin`
- `/#/survey/<shared-secret>`
- `/#/report/<private-secret>`

## Privacy and MVP limits

Responses store only three 1–5 scores, an optional comment, meeting ID, response ID, and submission time. They do not store attendee identity, access secrets, IP addresses, browser fingerprints, or user-agent strings.

The shared survey link permits repeat submissions. Reports expose no scores, comments, distributions, or precise response count until at least three responses exist. Supabase RLS is enabled with policies only for the least-privilege backend role; browser-facing `anon` and `authenticated` roles have no table access.
