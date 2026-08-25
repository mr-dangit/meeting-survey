# SharePoint Workbook Export Plan

**Goal:** Publish meeting-feedback results into an Excel workbook stored on a Dymon SharePoint site, so results can be pivoted, charted, and archived outside the app without anyone copying numbers by hand.

**Architecture:** Keep Postgres as the system of record. Add a one-directional export path — repositories → pure row builder → `WorkbookSink` interface → Microsoft Graph Excel API. The sink is an interface so tests use a fake, mirroring the existing `MeetingRepository`/`ResponseRepository` pattern. Nothing about the survey, report, privacy, or access-secret behaviour changes.

**Tech Stack:** Existing React 18 / Fastify / Postgres stack, plus Microsoft Graph (`/v1.0`) client-credentials auth. No new npm dependency required (`fetch` and `node:crypto` are enough).

---

## 1. What gets exported

Three sheets, each backed by a real Excel *Table* (ListObject) — the Graph row-append API writes to named tables, not bare ranges.

**`Meetings` table** — one row per meeting, the aggregate the chair already sees:

| Column | Source |
| --- | --- |
| `MeetingId` | `meetings.id` (key column, used for idempotency) |
| `Title`, `Chair`, `MeetingAt`, `InvitedCount`, `Status` | `Meeting` |
| `ResponseCount`, `ResponseRate`, `ValueScore` | `calculateReport()` |
| `AvgUsefulness`, `AvgActionability`, `AvgReInvite` | `CompleteReport.questions[].average` |
| `Rating1Count` … `Rating5Count` per question (15 columns) | `questions[].distribution` |
| `LastSyncedAt` | export run timestamp |

**`Responses` table** — one row per anonymous response: `ResponseId` (key), `MeetingId`, the three scores, `HasComment`, `SubmittedDate`. Date only, not timestamp — see §6.

**`Comments` table** — `ResponseId`, `MeetingId`, `Comment`. Split out so the Responses sheet stays numeric and pivot-friendly, and so this sheet can be dropped entirely if Compliance objects.

Reuse `calculateReport()` for the aggregates rather than recomputing — one definition of "value score" everywhere.

## 2. How the workbook is reached — three options

| | Effort | Who authorises | Failure mode |
| --- | --- | --- | --- |
| **A. Manual CSV download** | ~2h | nobody | a human forgets to run it |
| **B. Power Automate webhook** | ~1 day | the flow owner's own account | flow owner leaves, flow dies |
| **C. Graph app-only + `Sites.Selected`** | ~3 days | tenant admin, once | none once granted |

**Option A — CSV export button.** The admin page gets a "Download CSV" button; the file is dropped into a synced SharePoint folder by hand. Zero infrastructure, zero approvals, no live workbook.

**Option B — Power Automate.** A flow with a "When an HTTP request is received" trigger and an "Add a row into a table" (Excel Online Business) action. The app POSTs JSON to the flow's signed URL. No Azure app registration and no tenant-admin consent — the flow runs as whoever created it, using their SharePoint access. Fastest route to a live workbook, but it inherits one person's account, and the flow URL is a bearer secret that has to live in the AVD's
`.env.local`.

**Option C — Microsoft Graph, app-only (recommended).** An Entra ID (Azure AD) app registration with the `Sites.Selected` application permission, granted write access to exactly one SharePoint site. The app owns its own identity, survives staff changes, and can never touch any other site. Cost is one round of IT approval.

**Recommendation:** build the row builder and the `WorkbookSink` interface once, ship a CSV sink (A) on day one, and add the Graph sink (C) behind the same interface once the app registration lands. If IT approval stalls, a Power Automate sink (B) drops into the same interface as a stopgap. The pure `buildWorkbookRows()` function — the part with all the logic worth testing — is identical in all three.

## 3. Trigger

Not on every submission: the Excel workbook API throttles hard and takes a write lock per workbook, so a burst of submissions after a large meeting would collide.

- **Scheduled:** an in-process timer in `server/index.ts` calling the export directly. The app is one long-running process, so no hosting plan caps the frequency and no public endpoint or shared secret is needed. Guard against overlapping runs with an in-flight flag. (A `POST /api/cron/export` behind a `CRON_SECRET` bearer header is only worth adding if the schedule ever has to live outside the app.)
- **On demand:** `POST /api/admin/export` (open, like the other admin routes in this testing build), wired to an "Export to SharePoint" button on the admin page with a last-synced timestamp and a link to the workbook.

Both call the same service.

## 4. Sync semantics

- **Idempotent by key column.** Before writing, read the existing key column (`GET /workbook/tables/{table}/columns/{key}`) into a `Set`. Append only rows whose key is absent. Never truncate the sheet — someone will have added a pivot or a note next to it.
- **Meetings rows change over time** (response count grows). Look the row up by `MeetingId` and `PATCH /workbook/tables/{table}/rows/itemAt(index={n})/range` in place; append only when the meeting is new.
- **Responses and comments are append-only** — a response never changes after submission.
- **One session per run.** `POST /workbook/createSession` with `persistChanges: true`, pass `workbook-session-id` on every subsequent call, close it at the end. Faster and consistent within a run.
- **Serialise runs.** One in-flight export at a time; a second request returns 409 rather than racing. Excel returns 423 (locked) when someone has the workbook open for editing in the desktop app — treat it as retryable, back off, and surface it in the admin UI rather than failing silently.
- **Retry on 429** honouring `Retry-After`.
- **Sync state lives in the sheet, not the database** — the key columns are the record of what has been exported. No migration needed, and the export stays correct if someone restores an older copy of the workbook.

## 5. Setup checklist (Option C)

1. IT registers an Entra ID application in the Dymon tenant; note tenant ID and client ID.
2. Add the **application** permission `Sites.Selected` (not delegated). Admin consent granted once.
3. Create the target SharePoint site/library and the workbook, with the three tables pre-created and named.
4. A tenant admin grants the app write access to that one site: `POST /v1.0/sites/{site-id}/permissions` with role `write` for the app's client ID.
5. Create a client secret (or, preferably, a certificate) and store it in the AVD's `.env.local`, which is gitignored and readable only by the host account — never in `.env.example`, never in git.
6. Resolve and record the stable `site-id` and workbook `item-id` once; store them as config rather than resolving by path at runtime.

Token flow: `POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`, `grant_type=client_credentials`, `scope=https://graph.microsoft.com/.default`. Cache the token in module scope until ~5 minutes before expiry.

New config keys in `server/config.ts`: `EXPORT_ENABLED`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `SHAREPOINT_SITE_ID`, `SHAREPOINT_ITEM_ID`, `CRON_SECRET`. All optional when `EXPORT_ENABLED` is false, so local development and tests keep working untouched.

## 6. Privacy

The app deliberately stores no attendee identity and shows no report below the response threshold. Exporting to a shared workbook weakens that unless it is handled explicitly:

- **Submission time is the main re-identification risk.** For a six-person meeting, an exact timestamp plus a calendar is close to a name. Export `SubmittedDate` (date only), sorted by response ID rather than by time.
- **Apply the report threshold to the export too.** Meetings below the threshold export their metadata and nothing else — no scores, no comments, no response count.
- **SharePoint permissions are the real access control.** The workbook must live in a library restricted to the people already entitled to see reports. The app writes; it does not manage who can read.
- **Comments are free text and may name people.** Confirm that verbatim comments are allowed to leave the app before shipping the `Comments` sheet.

## 7. Work breakdown

- [ ] **Task 1 — Row builder.** `server/domain/workbook.ts`: pure `buildWorkbookRows(meetings, responsesByMeeting)` returning typed `{ meetings, responses, comments }` row arrays, reusing `calculateReport()` and enforcing the threshold rule. Full unit tests, no I/O.
- [ ] **Task 2 — Repository support.** Add `listAll()` (or `listSince(date)`) to `ResponseRepository`, plus the Postgres implementation and its pg-mem test; today only `listForMeeting` exists.
- [ ] **Task 3 — Sink interface and CSV sink.** `server/integrations/workbook-sink.ts` defining `WorkbookSink`, and a CSV implementation. Admin route `GET /api/admin/export.csv` and a download button on the admin page. Ships value before any Microsoft approval.
- [ ] **Task 4 — Export service.** `server/services/export-service.ts`: load data, build rows, diff against the sink's existing keys, apply, return a summary (`rowsAdded`, `rowsUpdated`, `skipped`, `errors`). Tested against a fake sink.
- [ ] **Task 5 — Graph sink.** `server/integrations/graph-workbook-sink.ts`: token cache, session lifecycle, table read/append/patch, 429/423 handling. Tested with a stubbed `fetch`.
- [ ] **Task 6 — Triggers.** `POST /api/admin/export` (cookie-guarded) plus the scheduled in-process timer in `server/index.ts`.
- [ ] **Task 7 — Admin UI.** Export button, last-run summary, workbook link, and a clear message for the "workbook locked by another editor" case.
- [ ] **Task 8 — Docs.** README section covering the setup checklist, the env vars, and the privacy rules above.

## 8. Open decisions

1. Can we get an Entra ID app registration with `Sites.Selected` approved, or do we route through Power Automate under a named account?
2. Which SharePoint site and library owns the workbook, and who may read it?
3. Do verbatim comments leave the app, or aggregates only?
4. Refresh frequency — daily is likely enough for a feedback loop measured in weeks.
