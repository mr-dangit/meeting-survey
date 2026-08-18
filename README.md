# Dymon Meeting Feedback Prototype

A self-contained localhost prototype for an anonymous post-meeting feedback survey and a chair-facing demo report.

## Setup and run

From the project directory:

```bash
pnpm install
pnpm dev -- --host 127.0.0.1
```

Open the localhost URL printed by Vite for the attendee survey. The chair report demo is available directly at `http://localhost:5173/?view=report`; it is intentionally not exposed as a survey control.

## Verify

```bash
pnpm test
pnpm build
```

The test suite covers required-rating validation, the submitted-answer receipt, and attendee/report navigation.

## Scope

The chair report is populated with fictional demo data. This prototype has no Outlook/calendar automation, backend persistence, authentication, respondent identification, or external integrations. Feedback is presented as anonymous and the meeting title/context is intentionally left as a neutral placeholder.
