# Meeting Feedback MVP

A React/Fastify meeting-feedback MVP self-hosted on the host's AVD with anonymous responses stored in Supabase Postgres. Administrators create meetings, attendees submit through a shared secret link, and chairs receive aggregate results as soon as the first response arrives.

## Architecture

- One Fastify process serves the built Vite client and the `/api` routes on a single port.
- Supabase Postgres stores meetings and anonymous responses.
- The browser calls only same-origin `/api` routes; it receives no Supabase key or database credential.
- Runtime queries use Supabase's transaction pooler. Schema migrations use a direct or session-mode connection.

The process runs on the host's AVD in Singapore and reaches the Supabase `ap-south-1` project over
the transaction pooler. See [docs/intranet-sharing.md](docs/intranet-sharing.md) for how teammates
reach it and why the SSL parameters in `DATABASE_URL` are load-bearing.

## Configuration

Copy `.env.example` to `.env.local` and provide:

- `DATABASE_URL`: Supabase transaction-pooler URL using encrypted transport;
- `MIGRATION_DATABASE_URL`: Supabase direct or session-mode URL;
- `NODE_ENV`: `development` locally or `production` when serving the built app.

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

## Deployment

Build once, then run the single Fastify process. It serves `dist/client` and `/api` together, so
only one port has to be reachable:

```text
pnpm install
pnpm run build
pnpm run migrate
HOST=127.0.0.1 PORT=3001 node --env-file=.env.local dist/server/index.js
```

To let teammates on the corporate network open it, double-click `sharing/start_sharing.bat`, which
starts the app on `127.0.0.1:3001` and puts an authenticating proxy on the public port.
[docs/intranet-sharing.md](docs/intranet-sharing.md) covers the allowlist, the access log, and the
anonymity patch applied to that log.

Keep `DATABASE_URL` server-side; it never reaches the browser. Migrations are applied separately
through the Supabase connector or a trusted machine using `MIGRATION_DATABASE_URL`; the migration
credential is not required by the running application.

The application uses hash routes, so access secrets are not sent in HTTP request URLs:

- `/#/admin`
- `/#/survey/<shared-secret>`
- `/#/report/<private-secret>`

Meeting access secrets are stored on the `meetings` row alongside their lookup hashes, so an administrator can reopen a saved meeting and retrieve its links. They are returned through `GET /api/admin/meetings/:id/access`; the meeting list itself never carries them. Meetings created before this change keep only the hashes, so their links cannot be shown.

### Editing a submitted response

`POST /api/survey/responses` returns the new row's `responseId`, and `PUT /api/survey/responses/:id`
revises that row in place. The receipt's **Edit response** uses this, so changing an answer replaces
the original instead of filing a second response and double-counting that attendee.

The update is scoped by meeting as well as by id, so a response can only be revised through the
survey link of the meeting it belongs to, and an id from another meeting is reported as not found
rather than forbidden. The row keeps its `submitted_at`, so a revision is not treated as a fresh
submission.

The page holds the `responseId` in memory only, deliberately: nothing is written to browser storage
that would tie this browser to a response. The practical consequence is that editing is possible
only for as long as the page stays open. After a reload the survey link behaves as it always has and
a fresh submission is a new response.

### Deleting a meeting

`DELETE /api/admin/meetings/:id` removes the meeting; the `responses` foreign key cascades, so every
response filed against it goes too, and both its survey and report links stop resolving. This cannot
be undone, so the admin screen arms an inline confirmation on the row rather than acting on the first
click.

## Privacy and MVP limits

The `/#/admin` screen and the `/api/admin/*` routes are open in this testing build: there is no administrator login, so anyone who can reach the deployment can create meetings and read any meeting's access links. This is acceptable only because the build holds no real data. Restore authentication before pointing it at a production database.

Responses store only three 1–5 scores, an optional comment, meeting ID, response ID, and submission time. They do not store attendee identity, access secrets, IP addresses, browser fingerprints, or user-agent strings.

The shared survey link permits repeat submissions: it is one link for every attendee, so it cannot
tell a second attendee from the same attendee returning later. Editing (above) fixes only the case
the app can actually recognise — the same page revising the response it just filed. Reports expose no scores, comments, distributions, or response count until at least one response exists. Note that with a single response the chair sees that respondent's comment and ratings in isolation, so anonymity depends on volume rather than on a minimum-response threshold. Supabase RLS is enabled with policies only for the least-privilege backend role; browser-facing `anon` and `authenticated` roles have no table access.
