# Dymon Meeting Feedback Prototype Design

## Goal

Build a polished, self-contained localhost prototype for an anonymous post-meeting feedback survey and a chair-facing demo report. The prototype must be easy to navigate during a boss demo, work on mobile, and require no production integrations or confidential assets.

## Product surface

The prototype has two switchable views in one browser page:

1. **Attendee survey**
   - Neutral placeholder meeting context: “Title of the meeting” and “Meeting date · Meeting chair”.
   - Three required 1–5 star questions:
     1. How useful was this meeting in helping you achieve your goals?
     2. Did you leave with actionable ideas or clear follow-up tasks?
     3. Would you want to be invited to this meeting again?
   - One optional free-text question: “What is one thing that would make this meeting more valuable?”
   - Clear anonymous-feedback notice.
   - Inline required-field validation, focus on the first invalid rating, keyboard-accessible native radio groups, and mobile-friendly layout.
   - After valid submission, show a receipt/success screen that displays the respondent’s own three ratings and optional comment.

2. **Chair report**
   - Clearly labeled demo data.
   - Static realistic aggregate metrics: response rate, average question scores, response distributions, overall Meeting Value Score, and anonymous comments.
   - A compact navigation control returns to the attendee view.

## Visual direction

Use a restrained investment-firm aesthetic without reproducing an official logo: deep ink/navy text, warm ivory background, a muted emerald accent, generous spacing, fine rules, serif display typography paired with a clean sans-serif body, and understated status pills. Use CSS and semantic text rather than invented logos or proprietary imagery. Provide visible focus states, adequate contrast, labelled controls, and touch targets of at least 44px where practical.

## Architecture and state

Use a minimal React + Vite + TypeScript app. Keep demo data in a typed constants module, validation in a pure function, and page state in the root React component:

- `mode`: `"attendee" | "report"`
- `submittedAnswers`: `null | SurveyAnswers`
- `answers`: controlled star values and comment text

No backend, authentication, persistence, Outlook/calendar automation, or external connector is required. Switching modes preserves the current in-memory state for the duration of the page session. Resetting the survey from the receipt screen returns to a clean form.

## Validation and accessibility

The rating inputs remain real radio inputs grouped by `fieldset`/`legend` so browser keyboard navigation works. Each group has a concise required error message tied with `aria-describedby`. Submission prevents the receipt state when any required rating is missing, marks invalid groups, and focuses the first incomplete group. Success and validation feedback use `aria-live` where appropriate. The report uses headings and labelled metric sections, not color alone, to communicate values.

## Testing and verification

Use Vitest and Testing Library for unit/component behavior tests covering:

- missing required ratings are rejected;
- a complete submission shows the receipt and echoes the respondent’s ratings/comment;
- the mode switch shows the chair report and returns to the survey.

Run the test suite, a production build, and a browser smoke check against the local dev server. The smoke check must cover the empty-submit validation, successful receipt, report navigation, and a narrow viewport layout. Keep the dev server running at the final localhost URL and document exact setup/run commands in the README.

## Scope exclusions

This is a demo-only local prototype. It does not persist submissions, calculate live aggregates, send invitations, integrate with Microsoft Outlook, identify respondents, or imply that demo report values are real Dymon data.
