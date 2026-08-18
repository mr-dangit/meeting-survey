# Dymon Meeting Feedback Prototype

A self-contained prototype for an anonymous post-meeting feedback survey, a chair-facing report, and a historical meeting-series dashboard.

## Setup and run

From the project directory:

```bash
pnpm install
pnpm dev -- --host 127.0.0.1
```

Open the localhost URL printed by Vite for the attendee survey. The chair report demo is available at `http://localhost:5173/?view=report`, and the historical series dashboard at `http://localhost:5173/?view=series`; both are intentionally absent from the attendee survey controls.

## Verify

```bash
pnpm test
pnpm build
```

The test suite covers required-rating validation, the submitted-answer receipt, and attendee/report navigation.

## Scope

The report surfaces are populated only with fictional demo data. This prototype has no Outlook/calendar automation, export flow, authentication, respondent identification, or production analytics. Feedback is presented as anonymous and the attendee survey keeps neutral placeholder context.
