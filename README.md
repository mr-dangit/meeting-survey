# Meeting Feedback MVP

A hosted React/Fastify/PostgreSQL MVP for anonymous meeting feedback. Administrators create meetings, attendees submit through a shared secret link, and chairs receive aggregate results only after three responses.

## Local setup

Copy `.env.example` to `.env` and provide `DATABASE_URL`, `ADMIN_PASSPHRASE` (12+ characters), and `SESSION_SECRET` (32+ characters), then run:

```text
npm install
npm test
npm run build
npm run migrate
npm run dev
```

The client and API share one origin in production. Development proxies `/api` to `http://127.0.0.1:3001`.

Routes use URL fragments so access secrets are not sent in HTTP request URLs:

- `/#/admin`
- `/#/survey/<shared-secret>`
- `/#/report/<private-secret>`

## Privacy and MVP limits

Responses store only three 1–5 scores, an optional comment, meeting ID, response ID, and submission time. They do not store attendee identity, access secrets, IP addresses, browser fingerprints, or user-agent strings. The shared survey link permits repeat submissions. Reports expose no scores, comments, distributions, or precise response count until at least three responses exist.

## Temporary Render deployment

`render.yaml` defines one Node web service and one free PostgreSQL database. Push this repository to an approved Git provider, create a Render Blueprint from `render.yaml`, enter `ADMIN_PASSPHRASE` when prompted, wait for the health check, then open `https://<assigned-service>.onrender.com/#/admin`.

Render supplies HTTPS and the production administrator cookie is Secure and HTTP-only. The free PostgreSQL database expires after 30 days and has no backups; this deployment is suitable only for temporary MVP testing.

Deployment and browser smoke testing require explicit authorization and access to the selected Git and Render accounts; they are not performed by the local verification workflow.
