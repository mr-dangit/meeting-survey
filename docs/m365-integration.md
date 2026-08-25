# Microsoft 365 integration design

**Status:** design + inert scaffolding merged. Nothing in this document is live. Every code path
described here is behind `M365_ENABLED`, which defaults to `false`, and no Microsoft credential
exists in any environment yet.

**Goal (Kenneth's brief, 2026-08-18):** after a Dymon meeting ends, its attendees automatically get
the three-question, five-star survey; the results go to the meeting chair and to the person who
answered. "Think of how your app can screen your Outlook calendar and send you this survey after
the end of the meeting."

**Where we are today:** the app already does the survey and the report. What it cannot do is find
out that a meeting happened. An administrator types the meeting in by hand on `/#/admin`, gets two
links back, and distributes them himself. This document is about deleting that manual step.

---

## 1. What exists today (read before changing anything)

| Concern | Current implementation |
| --- | --- |
| Data model | `meetings` (title, chair_label, meeting_at, invited_count, status, two secret hashes + the secrets) and `responses` (three 1–5 scores, comment, submitted_at). `server/domain/types.ts` |
| Survey identity | One **shared** secret per meeting. `hashAccessSecret` (SHA-256) of the secret is looked up in `meetings.survey_secret_hash`. Anyone with the link can submit, repeatedly. `server/services/survey-service.ts` |
| Report identity | A second, separate secret → `meetings.report_secret_hash`. Aggregates only, computed by `calculateReport()` in `server/domain/report.ts`. Suppressed entirely until at least one response exists. |
| Secret transport | Hash routes (`/#/survey/<secret>`), then sent as the `x-survey-access` / `x-report-access` **header**, so secrets never appear in a request URL or a server log. `src/routing.ts`, `src/api.ts` |
| Auth | **None.** The `/api/admin/*` routes are open in this testing build; the passphrase gate was removed because the build holds no real data. There is **no user identity anywhere in the system.** `server/routes/admin.ts` |
| Respondent identity | None is stored. Not an email, not an IP, not a user agent. This is a deliberate property, documented in the README. |
| Config | `server/config.ts`, a zod schema over `process.env`. Three keys. |
| Hosting | One long-running Fastify process on the host's AVD serving the Vite bundle and `/api` on a single port (`server/index.ts`), reached through an authenticating proxy (`docs/intranet-sharing.md`). Supabase Postgres behind the transaction pooler. Migrations live twice: `supabase/migrations/*.sql` and the versioned array in `server/db/migrations.ts`. |
| Testing | vitest; `server/testing/database.ts` gives every test a pg-mem database. Repositories are interfaces (`MeetingRepository`, `ResponseRepository`), which is the pattern the Graph client follows below. |

Two consequences fall straight out of that table and shape everything below.

1. **Anonymity is the current design, not an accident.** Sending a *personal* survey link to each
   attendee necessarily creates a record that says "we invited this person". Whether it also creates
   a record that says "this person gave a 2" is the single biggest decision in this document (§6).
2. **There is no concept of a user.** Adding M365 does not require adding Dymon SSO to the app —
   the personal token in the emailed link *is* the authentication. Keep it that way; SSO for
   attendees would multiply the IT approvals needed for no gain.

---

## 2. Microsoft Graph approach

### 2.1 Permissions

| Permission | Type | Why | Risk profile |
| --- | --- | --- | --- |
| `Calendars.Read` | Application | Read the calendars of the mailboxes we watch, unattended, on a schedule | **Reads every mailbox's calendar in the tenant** unless scoped — see 2.3 |
| `Mail.Send` | Application | Send the survey invitation from a service mailbox | Can send *as anyone* unless scoped — see 2.3 |
| `User.Read.All` (optional) | Application | Resolve attendee display names / filter guests reliably | Directory-wide read; skip it if attendee objects on the event are enough. They usually are. |
| `Calendars.Read`, `User.Read` | Delegated | Alternative: read only the signed-in user's calendar | Far narrower, but see 2.2 |

Nothing else. No `Mail.ReadWrite`, no `Calendars.ReadWrite` — we never modify a calendar.
Ask for the smallest set; an over-broad request is the most likely reason a security review stalls.

### 2.2 Delegated vs application — the trade-off

**Delegated** means the app acts as a signed-in human and can only see what that human sees. The
user consents themselves (no admin needed for `Calendars.Read` in most tenants), which is
politically much cheaper. The problem is that the survey has to fire *after* a meeting ends, when
nobody is signed in. Delegated flows need a refresh token, refresh tokens expire (90 days idle, and
sooner under Conditional Access), and a token in a database that impersonates a real Dymon employee
is a worse thing to hold than an application credential. Every meeting also has to be discovered
through some individual's mailbox, so coverage depends on who opted in.

**Application (client credentials)** means the app has its own identity, runs unattended, survives
Efan's laptop and Efan's employment, and is auditable as itself. The cost is one round of tenant
admin consent, and the default grant is tenant-wide.

**Recommendation: application permissions, scoped by an Exchange application access policy.** This
is the same conclusion the SharePoint export plan reached, and for the same reason: a scheduled,
unattended job should not borrow a person's identity.

A defensible middle path if IT balks at app-only: a **delegated pilot** on Efan's own calendar,
consented by Efan, running from a machine he controls, to demonstrate the flow end-to-end before
asking for anything tenant-wide. Cheap, no approval, proves the product. It cannot ship to the firm.

### 2.3 The scoping that makes this approvable

`Calendars.Read` as an application permission is tenant-wide by default, and a security reviewer at
a fund is right to refuse that. Two controls narrow it, and both should be in the request from the
start so the conversation starts at "narrow" rather than "no":

1. **Exchange Online application access policy.** IT creates a mail-enabled security group (say
   `sg-meeting-survey-scope`) containing only the mailboxes in the pilot, then runs
   `New-ApplicationAccessPolicy -AppId <client-id> -PolicyScopeGroupId sg-meeting-survey-scope
   -AccessRight RestrictAccess`. Graph then returns `403 ErrorAccessDenied` for every mailbox
   outside that group — enforced by Exchange, not by our code. The same policy scopes `Mail.Send`
   so the app can only send from the service mailbox.
2. **A calendar category as opt-in.** Even inside the scoped group, only process events carrying an
   agreed Outlook category (e.g. `Survey`). Chairs opt a meeting in rather than opting every 1:1
   out. This is enforced in our code (`requireCategory`), so it is a product control, not a
   security boundary — but it is what makes the pilot socially acceptable.

### 2.4 App registration steps (for Dymon IT)

1. Entra ID → App registrations → New registration. Name: `Meeting Feedback Survey`. Single tenant.
   No redirect URI (app-only flow).
2. Record **Directory (tenant) ID** and **Application (client) ID**.
3. API permissions → Microsoft Graph → **Application permissions** → `Calendars.Read`, `Mail.Send`.
   Then **Grant admin consent** for the tenant. *This step requires a Dymon Global Administrator or
   Privileged Role Administrator. Efan cannot self-serve it; it is a corporate tenant.*
4. Certificates & secrets → new client secret (24 months) or, preferred, upload a certificate.
   Record the expiry in a calendar reminder — an expired secret is a silent outage.
5. Exchange Online PowerShell → create the scope group and the application access policy (2.3), then
   verify with `Test-ApplicationAccessPolicy -Identity <mailbox> -AppId <client-id>`.
6. Provision a shared service mailbox, e.g. `meeting-survey@dymonasia.com`, and add it to the scope
   group. The survey mail comes from here, not from a person.
7. Hand over tenant ID, client ID, and the secret **directly into the AVD's `.env.local`**, which is
   gitignored and readable only by the host account (§7) — not over Teams, not into the repo.

Realistically: steps 1–4 are 30 minutes of an admin's time; getting on the admin's calendar and
through whatever review sits in front of it is the actual schedule risk. Start it now, in parallel
with the build.

---

## 3. Detecting that a meeting has ended

### 3.1 The trap

The obvious move is Graph change notifications (webhooks) on `/users/{id}/events`. They do not solve
this problem. **A calendar subscription fires when an event is created, updated, or deleted — never
when an event's end time passes.** No amount of webhook plumbing will tell you a meeting just
finished; nothing changes at that moment. A design that pins its hopes on subscriptions ends up
polling anyway, plus carrying subscription lifecycle code.

### 3.2 Polling (recommended)

Run a scheduled job every 15 minutes. Call

```
GET /v1.0/users/{userId}/calendarView
      ?startDateTime=<now - lookback>&endDateTime=<now>
      &$select=id,iCalUId,seriesMasterId,subject,start,end,isAllDay,isCancelled,type,organizer,attendees,categories,sensitivity
      &$orderby=start/dateTime&$top=50
Prefer: outlook.timezone="UTC"
```

`calendarView` is the right endpoint rather than `/events`: it **expands recurring series into
individual occurrences** within the window, so recurrence is handled by Microsoft rather than by us
re-implementing RRULE. Take an event when `end < now - settleMinutes`, it is not cancelled, and it
passes the filters in §4. A lookback window of ~3 hours with a 10-minute settle delay gives plenty of
overlap; idempotency comes from the database, not from the window (§3.4).

Cost is trivial: one request per watched mailbox per run, a few hundred requests a day for a pilot.
Graph's mailbox throttling limit is far above that.

**Where the schedule runs.** The app is a long-running process, not a set of functions, so the
scheduler is a free choice and no hosting plan limits the granularity. In order of preference:

1. **An in-process timer** (`setInterval` in `server/index.ts`) calling the sync directly. No
   endpoint, no shared secret, no network hop — and it cannot be triggered from outside. This is the
   simplest correct answer while exactly one process runs the app.
2. **Windows Task Scheduler on the AVD** running a one-shot script, if the sync should survive an app
   restart independently or needs its own log.
3. **Supabase `pg_cron` + `pg_net`** hitting `POST /api/cron/calendar-sync` behind a `CRON_SECRET`
   bearer header — only worth it if the app later moves somewhere horizontally scaled, where an
   in-process timer would fire once per instance.

Option 1 has a caveat to respect: the timer must not overlap itself. Guard with an in-flight flag and
let the database's idempotency (§3.4) absorb any double-run.

### 3.3 Where subscriptions still earn their place (later, optional)

Once polling works, a subscription on the same mailboxes adds one real thing: **prompt reaction to
cancellations and reschedules**, so a survey is not queued for a meeting that got called off after
we saw it. If we adopt them, the mechanics that must be handled:

- **Validation handshake.** On `POST /subscriptions`, Graph immediately calls the notification URL
  with `?validationToken=...`; we must echo the decoded token back as `text/plain`, HTTP 200, within
  10 seconds. The long-running process has no cold start, so this is comfortable — but still keep the
  validation branch at the very top of the handler, ahead of any config load or database connection,
  so a slow pool cannot eat the budget.
- **`clientState`.** Send a random secret on creation, compare it on every notification, drop
  anything that does not match. Notification URLs are public by definition.
- **Renewal.** Outlook resource subscriptions max out at 4230 minutes (~70 hours). Renew on a cron
  at roughly half the lifetime and recreate on failure — a lapsed subscription is silent.
- **Notifications carry no payload we can trust.** The notification says "event X in mailbox Y
  changed". Re-fetch the event by id. (Rich notifications with an encrypted payload exist and add a
  certificate to manage; not worth it here.)
- **Missed notifications happen.** Even with subscriptions, keep the poller as the reconciler.

**Recommendation: poll only for phase 1 and 2. Add subscriptions in phase 4 if, and only if,
stale-meeting noise turns out to be a real complaint.**

### 3.4 Idempotency

Never rely on the polling window not overlapping — it will overlap, and functions get retried. A
`calendar_events` ledger keyed `unique (ical_uid, occurrence_start)` records every occurrence we
have already made a decision about, with its outcome (`scheduled`, `invited`, `skipped` + reason).
The poller consults it before acting. `iCalUId` is stable across mailboxes for the same meeting, so
watching both the organizer's and an attendee's calendar cannot produce two surveys; `id` is
per-mailbox and must **not** be the dedup key. Occurrence start is part of the key so each instance
of a weekly series is surveyed separately.

---

## 4. Which meetings, which people

### 4.1 Skip rules

Implemented as pure functions in `server/domain/calendar.ts` so they are unit-testable without Graph.
Every skip is recorded with a reason, which is what makes the pilot debuggable ("why didn't my
meeting get a survey?").

| Rule | Default | Reason code |
| --- | --- | --- |
| Cancelled (`isCancelled`) | skip | `cancelled` |
| Series master rather than an occurrence | skip (calendarView shouldn't return them) | `series_master` |
| All-day event | skip — these are leave, travel, blocks, not meetings | `all_day` |
| Still running (`end >= now`) | skip | `not_ended` |
| Ended less than `settleMinutes` ago | skip this run, retry next run | `settling` |
| Shorter than `minimumDurationMinutes` (default 20) | skip — no one wants to rate a 15-minute standup | `too_short` |
| Fewer than `minimumAttendees` real people (default 3) | skip — a 1:1 rating is not anonymous and is socially awkward | `too_few_attendees` |
| No organizer | skip | `no_organizer` |
| `sensitivity` is `private` or `confidential` | skip | `private` |
| Opt-in category configured and absent | skip | `category_missing` |
| No eligible recipients after filtering | skip | `no_recipients` |
| Ended more than `maximumAgeHours` ago (default 24) | skip — do not backfill months of history on first run | `too_old` |

The `too_old` guard matters more than it looks: the first successful run against a real calendar
would otherwise mail every attendee of every meeting in the lookback window at once.

### 4.2 Recurring meetings

`calendarView` returns each occurrence with `type: "occurrence"` (or `"exception"` where it was
edited) plus a `seriesMasterId`. Each occurrence is surveyed independently and stored with its own
`occurrence_start`, so the weekly investment review accumulates a comparable score per week — which
is exactly the trend view the `/#/series-demo` page already mocks up. `seriesMasterId` is persisted
so a later phase can group occurrences into a series report without re-deriving anything.

Two nuances: an occurrence that was individually cancelled arrives as `isCancelled` and is skipped;
a series whose master is deleted simply stops appearing in the window, which needs no handling.
Survey fatigue on a daily series is a real risk — the sampling policy ("survey a series at most once
a week") is deferred to phase 4 and flagged for Kenneth in §9.

### 4.3 Attendees and the chair

**Recipients** = event attendees, lowercased and deduplicated by address, minus:

- resource mailboxes (`type: "resource"` — rooms, equipment),
- anyone whose `responseStatus` is `declined`,
- external domains, unless `includeExternalAttendees` is turned on. Off by default: an LP or a
  broker receiving an automated internal survey is a reputational problem, not a data problem.

The organizer is included as a respondent. They sat in the meeting too, and excluding them makes the
attendee count inconsistent with `invited_count`.

**Chair** = the event **organizer**, by default. This is right most of the time and wrong in two
recognisable ways: an EA or a team assistant books on someone else's behalf, and a standing meeting
is owned by whoever created the series years ago. So the rule is organizer *unless overridden*:

- a configured map of scheduler mailboxes (EAs) whose events fall through to the first required
  attendee, and
- a per-series nominated chair, stored on the meeting record and editable from the admin page.

`meetings.chair_label` is already free text, so nothing about the existing report breaks.

---

## 5. Delivering the survey link

| Option | Effort | IT friction | Reach | Verdict |
| --- | --- | --- | --- | --- |
| **A. Graph `sendMail` from a service mailbox** | ~1 day | `Mail.Send` (application), scoped by application access policy | Everyone with email, any device, any client | **Recommended for phase 2** |
| **B. Actionable Message / Adaptive Card in Outlook** | ~1 week | `Mail.Send` **plus** provider registration at `outlook.office.com/connectors/oam`, tenant approval of the originator ID, and a separately-authenticated callback endpoint | Outlook desktop/web/mobile only; degrades to the HTML fallback elsewhere | Phase 4 if response rates disappoint |
| **C. Teams bot message** | ~2 weeks | An Azure Bot resource, a Teams app manifest, sideload or Teams admin-centre approval, an app-service principal | Excellent — Teams is where Dymon already lives | Phase 5, or never |

**Recommendation: A now, evaluate B later.** The email is plain, from `meeting-survey@dymonasia.com`,
subject `How was "<meeting subject>"?`, body: the meeting title and time, five star-links, and a
"more detail" link into the app. Making the five stars *clickable links in the email itself* buys
most of what an Adaptive Card buys — the one-tap Grab experience — for a day's work instead of a
week's, and it works in every mail client. Each star link is `/#/survey/<personal-token>?q1=<n>`,
pre-selecting the first answer and landing the respondent on the existing survey page for the other
two questions.

Option B's genuine advantage is answering all three questions inside the Outlook reading pane with
no browser at all. Its genuine cost is that Actionable Messages need their own registered provider
and their own token validation on the callback, and Dymon IT would have to approve the originator —
a second, unfamiliar approval on top of the one in §2. Not worth spending the political capital
before we know whether people answer at all.

Option C is the best experience and the worst schedule. Revisit only if the pilot proves the concept
and someone asks for it.

Whatever the channel: one message per attendee per meeting, sent 10 minutes after the end, never
resent more than once, with an unsubscribe/opt-out path and a hard cap on messages per person per
day. Automated mail to the whole firm is the fastest way to get the project switched off.

---

## 6. Result routing, and the privacy decision

Kenneth: *"The survey results should go to the meeting chair and the person taking part in the
survey."* Those two audiences want different things, and the difference is where the privacy
question lives.

**The chair** gets the existing aggregate report — averages, distributions, response rate, comments.
Already built (`calculateReport`). It becomes a personal link in a summary email once responses
close, instead of a link an admin pastes into chat.

**The respondent** gets their own submission back. The privacy-preserving way to do this, and the
recommended default:

- the invite token identifies *who was invited*, and is marked used when a response is submitted;
- the response row itself stores **no** invite id — only a fresh, random `receipt_secret_hash`;
- the respondent's receipt link (`/#/receipt/<receipt-secret>`) is shown on submission and emailed
  in the confirmation.

The database therefore records "we invited Alice" and "someone submitted 4/3/5", and **holds no row
that joins the two**. That preserves the property the README already promises, and it means a
compromise of the database — or a subpoena, or a curious admin — cannot reconstruct who said what.
It costs one thing: nobody can compute per-person response rates or chase a specific non-responder
beyond a blanket reminder to everyone who hasn't used their token. That is a fair trade.

### The decision Kenneth must make

**Does the chair see who gave which rating, or only the aggregate?**

- **Aggregate-only + anonymous free text (recommended default).** Honest feedback, especially the
  "would you invite me again" question, depends on it. A junior analyst will not tell a portfolio
  manager his weekly meeting is a 2 out of 5 with his name on it, and a system that pretends
  otherwise just collects 4s. The minimum-response threshold must rise from 1 to **3** before this
  ships to real meetings — at n=1 the "aggregate" *is* the individual, which the README already
  admits.
- **Identified.** Only if Kenneth explicitly asks for it, and then it must be stated on the survey
  page itself, above the questions, in plain words: *"Your name is shown to the chair with your
  answers."* Silent attribution is the one outcome that is genuinely unacceptable — it is both a
  trust problem and, for named opinions about named colleagues, an HR-adjacent data problem.

A middle option worth offering him: aggregate scores, anonymous comments, but the chair can see the
*list of who responded* (not what they said) so they can nudge the rest. Cheap to build, and it is
usually what people actually want when they ask for names.

Related decisions in the same conversation: how long response data is retained (recommend: 24
months, then aggregate and delete raw rows), and whether the survey mail is opt-out per person.

---

## 7. Secrets, tokens, storage

**Application credential.** Client secret (or certificate thumbprint) lives in the AVD's
**`.env.local`**, alongside `DATABASE_URL` and handled exactly the same way: gitignored, readable
only by the host account, entered by whoever holds it — never in the repo, never pasted into Teams.
`.env.example` gets the *names* only, blank.

Note what this concentrates: the credential now sits on one machine under one person's account
rather than in a hosting provider's secret store. That is fewer places to leak from, but it also
means the host's machine is the blast radius, and there is no per-environment separation the way
Production and Preview used to give. If this ever holds a credential with real tenant reach, move it
to a proper secret store.

**Access tokens.** The client-credentials flow returns a bearer token valid ~60 minutes. Cache it in
module scope in the running process and refresh at 5 minutes before expiry — implemented in
`MicrosoftGraphClient`. Because the process is long-lived the cache actually holds, instead of being
rebuilt on every cold start. Never persist it to Postgres: an in-memory token dies with the process,
whereas a token in a table is a durable secret with no owner. There are no
refresh tokens in the app-only flow, which is a further reason to prefer it over delegated.

**Survey and receipt tokens.** Follow the pattern already in the codebase exactly: 32 random bytes,
base64url, SHA-256 hashed for lookup (`server/domain/security.ts`), carried in a hash route and
sent as a header so they stay out of URLs and logs. New per-attendee invite tokens are the same
shape as today's shared survey secret, so `SurveyService` changes very little.

**Attendee email addresses** become the first personal data the system stores. They are needed to
send the mail and to suppress duplicates, and nothing more. Recommendation: store the address on
`survey_invites` only, purge it once the meeting's survey window closes (keeping a salted hash for
duplicate suppression), and never expose it through any report endpoint. `pino`'s redact list in
`server/app.ts` must be extended to cover the new fields.

**Webhook secrets** (if §3.3 is adopted): `clientState` random per subscription, stored hashed,
compared in constant time.

**Supabase.** RLS is already enabled with grants only to the `meeting_app` role; browser-facing
`anon`/`authenticated` roles have no table access at all. The new tables follow the same template in
the migration. No Supabase key ever reaches the browser and that does not change.

---

## 8. Phased plan

Estimates are for one part-time intern, and the calendar risk is approval latency, not code.

| Phase | Scope | Effort | Blocked on |
| --- | --- | --- | --- |
| **0. Scaffolding** *(done in this change)* | Typed Graph client behind an interface, pure eligibility/attendee logic, polling service, config loader, migration file written but unapplied, fake client for tests. All inert behind `M365_ENABLED=false`. | ~1 day | nothing |
| **1. Read-only pilot** | Delegated auth against Efan's own calendar, or app-only once registered. Cron endpoint + `CRON_SECRET`. Poll, evaluate, write the `calendar_events` ledger, **send nothing** — an admin page listing "meetings we would have surveyed, and why we skipped the rest". Apply the migration. | 2–3 days | app registration (or a delegated dev consent) |
| **2. Auto-create + invite** | Auto-create the `meetings` row from an occurrence, mint per-attendee invite tokens, `sendMail` from the service mailbox with star-links, mark invites used, raise the report threshold to 3. | 3–4 days | `Mail.Send` consent, service mailbox |
| **3. Result routing** | Respondent receipt page + confirmation mail; chair summary mail with the report link when the window closes; one reminder to unused invites. | 2–3 days | Kenneth's §6 decision |
| **4. Hardening** | Change subscriptions for cancellations, per-series sampling, chair override UI, opt-out list, retention job, throttling/backoff. | 3–5 days | pilot feedback |
| **5. Teams delivery** | Bot + Teams app manifest, if anyone still wants it. | 2 weeks | Teams admin approval |

Phase 0 and phase 1's code are worth writing before any approval lands, because they are the parts
that are testable without a tenant. Everything after phase 1 is gated on Dymon IT.

---

## 9. Open decisions

**For Kenneth:**
1. **Does the chair see individual identities, or aggregates only?** Recommended: aggregates only,
   anonymous comments, with the response threshold raised to 3. (§6)
2. Which meetings are in the pilot — one team's recurring meetings, opted in with an Outlook
   category? Who are the first chairs?
3. Delivery by email from a service mailbox (recommended), or is it worth the extra approvals to get
   an Adaptive Card inside Outlook? (§5)
4. Should a daily or twice-weekly series be surveyed every occurrence, or sampled?
5. How long is response data kept?

**For Dymon IT / security:**
6. Will they approve an Entra ID app registration with **application** `Calendars.Read` and
   `Mail.Send`, scoped by an Exchange application access policy to one security group? (§2)
7. Who provisions and owns `meeting-survey@dymonasia.com`?
8. Is an app that stores attendee email addresses in a Supabase instance outside the tenant
   acceptable, or must that data stay in-tenant? This is the question most likely to change the
   architecture, so ask it early — the answer could push the whole thing onto Power Automate and a
   SharePoint list.
9. Client secret vs certificate, and who holds the renewal reminder.

**Engineering, non-blocking:**
10. Scheduler — in-process timer, Windows Task Scheduler, or Supabase `pg_cron`. No longer blocked
    by a hosting plan's cron limit; the recommendation is the in-process timer. (§3.2)
11. `supabase/migrations/*.sql` and `server/db/migrations.ts` are two sources of truth for schema.
    The M365 migration has been written only as SQL, deliberately unapplied; version 3 must be added
    to `migrations.ts` when phase 1 starts, and the duplication should be resolved before the schema
    grows further.
