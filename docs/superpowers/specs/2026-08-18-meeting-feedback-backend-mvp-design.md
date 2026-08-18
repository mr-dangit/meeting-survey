# Meeting Feedback Backend MVP Design

## Goal

Build a publicly hosted, testable backend MVP for the meeting-feedback prototype. An administrator creates a meeting, shares one anonymous survey link with all attendees, and gives the chair a separate private report link. Submitted answers persist in PostgreSQL and appear only as aggregate statistics and anonymous comments.

The MVP proves the storage, anonymity boundary, reporting calculations, and hosted end-to-end experience before Microsoft 365 integration begins.

## MVP scope

The MVP includes:

- a simple test-administration page for creating meetings;
- one shared attendee survey link per meeting;
- one separate private chair-report link per meeting;
- the three required 1–5 rating questions and one optional comment;
- durable PostgreSQL persistence;
- server-side aggregate reporting;
- a three-response reporting threshold;
- manual survey closure and reopening;
- deployment to a temporary public URL;
- automated validation, persistence, and reporting tests;
- browser-based end-to-end testing with multiple submissions.

The MVP excludes Microsoft 365 integration, email, reminders, personal receipts, unique attendee links, strict duplicate prevention, scheduled jobs, automatic retention, audit logging, and production monitoring.

## Architecture

Use the existing React and TypeScript frontend with a small TypeScript HTTP API. The API owns validation, access control, persistence, survey state, and report calculation. PostgreSQL stores meetings and anonymous responses.

Application services depend on repository interfaces rather than database queries. The MVP implements those interfaces with PostgreSQL. A later Microsoft 365 phase can add SharePoint, Microsoft Graph, calendar, and email adapters without rewriting survey or reporting rules.

The hosted application exposes three surfaces:

1. **Test administration** — protected by a deployment-secret passphrase. It creates meetings, records the invited count, copies links, and closes or reopens surveys.
2. **Attendee survey** — available through a meeting-specific shared secret. It exposes only public meeting context and the survey form.
3. **Chair report** — available through a separate meeting-specific secret. It exposes aggregate results only after the reporting threshold is met.

## Data model

### Meetings

Each meeting stores:

- an opaque meeting ID;
- title;
- chair label;
- meeting date and time;
- manually entered invited-attendee count;
- status: open or closed;
- a hash of the shared survey access secret;
- a hash of the private chair-report access secret;
- creation and update timestamps.

### Anonymous responses

Each response stores:

- an opaque response ID;
- meeting ID;
- usefulness score;
- actionability score;
- re-invite score;
- optional improvement comment;
- submission timestamp.

Responses do not store names, email addresses, access secrets, IP addresses, browser fingerprints, or user-agent strings. The meeting ID is the only link needed to calculate a meeting report.

The shared-link MVP cannot reliably prevent repeat submissions. This limitation is accepted for the pilot and must be visible to the administrator.

## Access model

Creating or changing meetings requires an administrator session established with a deployment-secret passphrase. The passphrase is supplied through deployment configuration and is not stored in PostgreSQL.

Survey and report access use unrelated, high-entropy secrets. Only hashes are persisted. Possession of a valid link grants access to that meeting's attendee or chair surface. The attendee surface never returns report or administration data, and the chair surface never returns raw response rows.

The temporary deployment must use HTTPS. No confidential meeting descriptions, attachments, minutes, or attendee identities are collected.

## Core data flow

1. The administrator creates a meeting with its title, chair label, date, and invited count.
2. The API generates unrelated survey and report secrets, stores their hashes, and returns the two links once.
3. Attendees open the shared survey link and retrieve public meeting context.
4. The API accepts a submission only when the meeting is open and all three scores are integers from 1 through 5. The optional comment has a maximum length of 1,000 characters.
5. A successful transaction inserts one anonymous response and returns a confirmation. No personal receipt is produced.
6. The report service calculates submission count, response rate, per-question averages, score distributions, and the Meeting Value Score.
7. When fewer than three responses exist, the chair sees only that the reporting threshold has not been met. Scores, distributions, comments, and the precise response count remain hidden.
8. At three or more responses, the chair sees the aggregate metrics and anonymous comments. Raw rows are never sent to the browser.
9. The administrator can close or reopen the survey manually. Closed surveys reject new submissions while retaining their report.

## Reporting rules

Response rate equals anonymous response count divided by the manually entered invited count. It is capped at 100% for display because the shared link permits repeat submissions.

Each question report includes its arithmetic mean and counts for scores 1 through 5. The Meeting Value Score is the arithmetic mean of all submitted scores across the three required questions, equivalent to averaging the three question means when every response contains all three scores.

Comments appear only after the three-response threshold is met. The survey warns attendees that wording or context may reveal their identity even though the system does not collect it.

## API and component boundaries

The implementation will separate:

- HTTP routing and request parsing;
- administrator-session handling;
- meeting creation and status changes;
- survey-access verification and submission;
- report-access verification and aggregate calculation;
- repository interfaces;
- PostgreSQL repositories and schema migrations;
- React administration, survey, confirmation, and report views.

API responses will use purpose-specific view models. Database rows and secrets will not be serialized directly to clients.

## Error handling

The API returns clear, non-sensitive errors for invalid links, closed surveys, invalid ratings, oversized comments, and unavailable storage. Failed inserts do not create partial responses. The survey keeps entered answers available for retry when a transient error occurs.

Application logs exclude access secrets, response bodies, ratings, and comments. Unexpected failures return a generic message to the browser while retaining enough non-sensitive context for diagnosis.

## Testing

Automated tests will cover:

- score and comment validation;
- meeting creation and secret separation;
- successful PostgreSQL response persistence;
- rejection of submissions to closed meetings;
- report calculations and score distributions;
- the three-response privacy threshold;
- the absence of identity fields from response storage and report payloads;
- administrator, survey, and report access boundaries.

End-to-end browser verification will create a meeting, submit at least three different answer sets through the same shared link, confirm persistence after reload, verify aggregate calculations, close the meeting, and confirm that further submissions are rejected.

## Future Microsoft 365 integration

A later phase can add:

- a Microsoft Graph calendar adapter for meeting registration;
- an invitation register with unique attendee tokens;
- a Microsoft Graph or Power Automate email adapter;
- SharePoint-backed repository implementations;
- reminders, personal receipts, automatic closure, and retention jobs;
- Entra ID authentication for administrators and chairs.

Those additions must preserve the anonymous response record: attendee identity and invitation state belong in a separate store and must never be copied into response rows or chair reports.

## MVP completion criteria

The MVP is complete when it is available at a temporary HTTPS URL and a tester can create a meeting, copy both links, submit at least three anonymous responses, reload the application without losing data, see correct aggregate statistics through the private report link, close the survey, and verify that no attendee identity is stored or displayed.
