# Live Backend + Restored Meeting Feedback Frontend

## Goal

Restore the previously built Dymon meeting-feedback visual system across the production frontend while preserving the current Fastify/Supabase backend, API contracts, privacy rules, and secure access-link routing.

## Context

The repository contains two frontend generations:

- `codex/historical-meeting-series-dashboard` contains the original polished attendee, report, and historical-series presentation.
- `codex/dymon-meeting-feedback` contains the live API-backed admin, survey, and report flows.

Production currently serves the second generation. The work is a UI merge, not a backend replacement.

## Scope

### Live routes

Keep the existing hash routes and make each screen use the restored visual language:

- `/#/admin` — administrator login, meeting creation, meeting list, status actions, and generated links;
- `/#/survey/<secret>` — anonymous survey loading, rating form, validation, submission, and receipt;
- `/#/report/<secret>` — threshold state, aggregate metrics, question summaries, distributions, and anonymous comments.

The browser continues to call same-origin `/api` endpoints. No Supabase client, database credential, access secret, or new authentication mechanism is added to the browser.

### Demo-only historical view

The historical meeting-series dashboard may remain available as an explicitly labeled demo-only view, using its existing fictional data. It must not be presented as live Supabase-backed meeting history and must not replace the live admin, survey, or report routes.

## Design and component approach

- Use the original Dymon typography, spacing, color, panels, metric treatments, responsive behavior, charts, tables, and status treatments as the visual baseline.
- Keep data fetching and state ownership in the existing API-backed page components or focused shared components.
- Preserve loading, invalid-link, threshold-not-met, API-error, validation-error, empty-list, and closed-survey states.
- Preserve the existing `src/api.ts` interfaces and backend response shapes unless a strictly frontend-only adaptation is required.
- Keep secrets in URL fragments and send them to the API through headers, never through HTTP request paths.

## Data flow

1. `App` parses the hash route and selects the live page.
2. The selected page calls the existing API functions.
3. API responses are mapped into the restored visual components.
4. User actions update page-local state and display the existing safe error messages.
5. No demo data is used for live survey or report values.

## Verification

- Add or update component tests for live admin, survey, report, and receipt states.
- Keep existing routing, validation, API, route, repository, and full-flow tests passing.
- Run the production client/server build.
- Run a local browser smoke check covering the admin shell, survey form, report threshold/complete states, and responsive layout.
- Deploy the verified build to the linked Vercel production project and verify the production root, `/api/health`, and live same-origin API routing.

## Non-goals

- No backend schema or API redesign.
- No historical-series persistence or new reporting endpoint.
- No change to administrator passphrase behavior, anonymous response storage, three-response threshold, or access-secret hashing.
- No removal of the existing user-owned `src/styles.css` change without explicit instruction.
