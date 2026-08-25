# Restored Live Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the previously built Dymon visual frontend across the production admin, survey, receipt, report, and demo-series surfaces while keeping the existing Fastify/Supabase API behavior unchanged.

**Architecture:** Keep `App` as the hash-route composition root and keep `src/api.ts` as the only browser-to-backend boundary. Rebuild each live page around the original Dymon visual structure, map live API responses directly into those structures, and keep the historical series dashboard isolated behind an explicit demo-only hash route.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, Fastify API, Supabase Postgres.

**Spec:** `docs/superpowers/specs/2026-08-19-frontend-backend-ui-merge-design.md`

## Global Constraints

- Preserve the current Fastify/Supabase backend, API contracts, privacy rules, and secure access-link routing.
- Keep the existing hash routes: `/#/admin`, `/#/survey/encoded-access-value`, and `/#/report/encoded-access-value`.
- The browser continues to call same-origin `/api` endpoints and receives no Supabase key, database credential, or access secret in code.
- No demo data is used for live survey or report values.
- Keep loading, invalid-link, threshold-not-met, API-error, validation-error, empty-list, and closed-survey states.
- Keep secrets in URL fragments and send them to the API through headers, never through HTTP request paths.
- Do not change administrator passphrase behavior, anonymous response storage, the three-response threshold, or access-secret hashing.
- Preserve the existing user-owned `src/styles.css` edits by reapplying their numeric-font and readability changes when restoring the historical visual baseline.
- Do not add a dependency, backend endpoint, database migration, or authentication mechanism.

---

### Task 1: Restore the live survey form and receipt

**Files:**
- Create: `src/pages/SurveyPage.test.tsx`
- Create: `src/components/SurveyReceipt.tsx`
- Modify: `src/pages/SurveyPage.tsx`
- Modify: `src/components/RatingField.tsx`

**Interfaces:**
- Consumes: `SurveyContext` from `src/types.ts`, `getSurvey()` and `submitSurvey()` from `src/api.ts`, and `validateSurvey()` from `src/validation.ts`.
- Produces: `SurveyPage({ access: string })` with live API-backed survey/loading/error/closed/submitted states and `SurveyReceipt({ meeting: SurveyContext, answers: SurveyAnswers, onEdit: () => void })`.

- [ ] **Step 1: Write the failing survey rendering tests**

Create a mocked API test that verifies the visual contract without contacting production:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SurveyPage } from "./SurveyPage";
import { getSurvey, submitSurvey } from "../api";

vi.mock("../api", () => ({
  getSurvey: vi.fn(),
  submitSurvey: vi.fn()
}));

const meeting = {
  id: "meeting-1",
  title: "Investment Committee",
  chairLabel: "Amelia Tan",
  meetingAt: "2026-08-12T09:30:00.000Z",
  invitedCount: 31,
  status: "open" as const
};

describe("SurveyPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the restored survey composition with live meeting context", async () => {
    vi.mocked(getSurvey).mockResolvedValue(meeting);
    render(<SurveyPage access="survey-secret" />);

    expect(await screen.findByRole("heading", { name: "Meeting feedback" })).toBeInTheDocument();
    expect(screen.getByText("Investment Committee")).toBeInTheDocument();
    expect(screen.getByText("Anonymous feedback")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit feedback/i })).toBeInTheDocument();
    expect(getSurvey).toHaveBeenCalledWith("survey-secret");
  });

  it("shows the receipt with the real meeting context after a successful submission", async () => {
    vi.mocked(getSurvey).mockResolvedValue(meeting);
    vi.mocked(submitSurvey).mockResolvedValue({ status: "recorded" });
    render(<SurveyPage access="survey-secret" />);
    await screen.findByRole("heading", { name: "Meeting feedback" });

    for (const prompt of [
      /How useful was this meeting/i,
      /actionable ideas/i,
      /invited to this meeting again/i
    ]) {
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(`${prompt.source}.*5 out of 5`, "i") }));
    }
    fireEvent.click(screen.getByRole("button", { name: /submit feedback/i }));

    expect(await screen.findByRole("heading", { name: "Feedback received" })).toBeInTheDocument();
    expect(screen.getByText("Investment Committee")).toBeInTheDocument();
    expect(submitSurvey).toHaveBeenCalledWith("survey-secret", {
      usefulness: 5,
      actionability: 5,
      reInvite: 5,
      comment: ""
    });
  });

  it("keeps the existing closed-survey state", async () => {
    vi.mocked(getSurvey).mockResolvedValue({ ...meeting, status: "closed" });
    render(<SurveyPage access="survey-secret" />);
    expect(await screen.findByRole("heading", { name: /survey is closed/i })).toBeInTheDocument();
  });
});
```

Use explicit radio labels in the implementation so the test remains accessible and stable; do not select ratings by CSS selectors.

- [ ] **Step 2: Run the focused tests and confirm the visual contract fails**

Run:

```text
$nodeDir='C:\Users\sg.bizdev.intern\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'; $env:Path="$nodeDir;$env:Path"; pnpm exec vitest run src/pages/SurveyPage.test.tsx --reporter verbose
```

Expected: FAIL because the current page uses a plain heading/form structure and has no restored receipt component or star rating labels.

- [ ] **Step 3: Implement the restored live survey structure**

Update `SurveyPage.tsx` to:

```tsx
return <main className="content-wrap survey-layout" aria-labelledby="survey-heading">
  <section className="survey-column">
    <div className="intro-block">
      <p className="eyebrow">Anonymous meeting feedback</p>
      <h1 id="survey-heading">Meeting feedback</h1>
      <p className="intro-copy">Help the chair understand what was useful and what would make the next meeting more valuable.</p>
    </div>
    <section className="meeting-context" aria-label="Meeting context">
      <div><span className="context-label">Title of the meeting</span><h2>{meeting.title}</h2></div>
      <span className="context-meta">{formatMeetingContext(meeting)}</span>
    </section>
    <aside className="anonymous-notice" role="note">
      <strong>Anonymous feedback</strong><span>Shared in aggregate only.</span>
    </aside>
    <form className="survey-form" onSubmit={submit} noValidate>
      {ids.map((id) => <RatingField key={id} id={id} prompt={prompts[id]} value={answers[id]} error={errors[id]}
        fieldRef={(node) => { if (node) refs.current[id] = node; }}
        onChange={(value) => setAnswers((current) => ({ ...current, [id]: value }))} />)}
      <div className="comment-field">
        <div className="comment-label-row"><label htmlFor="comment">Anything to improve?</label><span>Optional</span></div>
        <textarea id="comment" name="comment" rows={2} maxLength={1000} value={answers.comment}
          onChange={(event) => setAnswers((current) => ({ ...current, comment: event.target.value }))}
          placeholder="One small suggestion" />
      </div>
      <p className="privacy-note">Do not include names or confidential meeting content.</p>
      {errors.comment ? <p className="field-error" role="alert">{errors.comment}</p> : null}
      {message ? <p className="field-error" role="alert">{message}</p> : null}
      <div className="form-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving feedback…" : "Submit feedback"} <span aria-hidden="true">→</span></button></div>
    </form>
  </section>
</main>;
```

Add a local `formatMeetingContext(meeting: SurveyContext)` helper that returns the existing meeting date and chair label, using `new Date(meeting.meetingAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })`. Preserve the existing API calls, validation, focus behavior, saving state, invalid-link error, and closed-survey state. On successful submission render `SurveyReceipt` with the loaded meeting and answers; the receipt's Edit response button returns to the form without another API call.

Update `RatingField.tsx` to render five accessible radio inputs with the original star treatment:

```tsx
<div className="rating-control" role="radiogroup" aria-label={prompt}>
  {[1, 2, 3, 4, 5].map((rating) => {
    const inputId = `${id}-${rating}`;
    return <div className="rating-option" key={rating}>
      <input id={inputId} type="radio" name={id} value={rating} checked={value === rating}
        onChange={() => onChange(rating)} aria-label={`${prompt} — ${rating} out of 5`} />
      <label htmlFor={inputId}><span className={`star-symbol ${rating <= (value ?? 0) ? "is-filled" : "is-outline"}`} aria-hidden="true">{rating <= (value ?? 0) ? "★" : "☆"}</span></label>
    </div>;
  })}
</div>
```

- [ ] **Step 4: Run the survey tests and commit the live survey slice**

Run:

```text
$nodeDir='C:\Users\sg.bizdev.intern\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'; $env:Path="$nodeDir;$env:Path"; pnpm exec vitest run src/pages/SurveyPage.test.tsx src/App.test.tsx --reporter verbose
```

Expected: all focused tests pass. Commit only the survey files and its test:

```text
git add -- src/pages/SurveyPage.tsx src/pages/SurveyPage.test.tsx src/components/SurveyReceipt.tsx src/components/RatingField.tsx
git commit -m "feat: restore live survey presentation"
```

### Task 2: Restore the live chair report presentation

**Files:**
- Create: `src/pages/ReportPage.test.tsx`
- Modify: `src/pages/ReportPage.tsx`

**Interfaces:**
- Consumes: `ReportView` from `src/types.ts` and `getReport(access)` from `src/api.ts`.
- Produces: the same `ReportPage({ access: string })` with live threshold and complete-report states rendered using the restored report layout.

- [ ] **Step 1: Write failing report state tests**

Create tests with mocked `getReport` for both API states:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportPage } from "./ReportPage";
import { getReport } from "../api";

vi.mock("../api", () => ({ getReport: vi.fn() }));

describe("ReportPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the privacy threshold state without scores or counts", async () => {
    vi.mocked(getReport).mockResolvedValue({ status: "threshold_not_met", minimumResponses: 3 });
    render(<ReportPage access="report-secret" />);
    expect(await screen.findByRole("heading", { name: "Chair report" })).toBeInTheDocument();
    expect(screen.getByText(/at least 3 anonymous responses/i)).toBeInTheDocument();
    expect(screen.queryByText(/Meeting Value Score/i)).not.toBeInTheDocument();
  });

  it("renders live aggregate metrics, distributions, and comments", async () => {
    vi.mocked(getReport).mockResolvedValue({
      status: "complete",
      meeting: { title: "Investment Committee", chairLabel: "Amelia Tan", meetingAt: "2026-08-12T09:30:00.000Z", status: "open" },
      responseCount: 3,
      invitedCount: 5,
      responseRate: 60,
      valueScore: 3.78,
      questions: [
        { id: "usefulness", prompt: "How useful was this meeting?", average: 4, distribution: [{ rating: 1, count: 0 }, { rating: 2, count: 0 }, { rating: 3, count: 1 }, { rating: 4, count: 1 }, { rating: 5, count: 1 }] },
        { id: "actionability", prompt: "Did you leave with actionable ideas?", average: 3.33, distribution: [{ rating: 1, count: 0 }, { rating: 2, count: 1 }, { rating: 3, count: 1 }, { rating: 4, count: 0 }, { rating: 5, count: 1 }] },
        { id: "reInvite", prompt: "Would you want to be invited again?", average: 4, distribution: [{ rating: 1, count: 0 }, { rating: 2, count: 0 }, { rating: 3, count: 0 }, { rating: 4, count: 3 }, { rating: 5, count: 0 }] }
      ],
      comments: ["Useful discussion."]
    });
    render(<ReportPage access="report-secret" />);
    expect(await screen.findByRole("heading", { name: "Chair report" })).toBeInTheDocument();
    expect(screen.getByText("3.78")).toBeInTheDocument();
    expect(screen.getByText("3 of 5 attendees")).toBeInTheDocument();
    expect(screen.getByText("Useful discussion.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused report tests and confirm failure**

Run the same Vitest command against `src/pages/ReportPage.test.tsx`; expected failure is missing restored headings/metric markup.

- [ ] **Step 3: Implement the restored report layout**

Keep the existing `getReport` lifecycle and error handling, but replace the plain sections with the original structure:

```tsx
<main className="content-wrap report-layout" aria-labelledby="report-heading">
  <section className="report-intro">
    <div><p className="eyebrow">Live meeting report · {report.responseCount} responses</p><h1 id="report-heading">Chair report</h1><p className="intro-copy">A quick read on how the meeting landed, with anonymous comments to guide the next one.</p></div>
    <span className="live-badge">Live report</span>
  </section>
  <section className="report-overview" aria-label="Meeting overview">
    <div className="overview-score"><span>Meeting Value Score</span><strong>{report.valueScore.toFixed(2)}<small> / 5</small></strong><div className="overview-track"><span style={{ width: `${report.valueScore * 20}%` }} /></div><p>{report.responseCount} of {report.invitedCount} attendees responded.</p></div>
    <div className="overview-facts"><div className="overview-fact"><span>Response rate</span><strong>{report.responseRate}%</strong><p>{report.responseCount} of {report.invitedCount} attendees</p></div><div className="overview-fact"><span>Highest score</span><strong>{highestRatedQuestion.average.toFixed(2)} / 5</strong><p>{highestRatedQuestion.prompt}</p></div></div>
  </section>
  <div className="report-body-grid">
    <section className="report-section scorecard-section"><div className="section-heading-row"><div><p className="eyebrow">Question scores</p><h2 id="scorecard-heading">What stood out</h2></div><span className="section-count">{report.responseCount} responses</span></div><div className="scorecard-list">{report.questions.map((question, index) => <div className="scorecard-row" key={question.id}><span className="scorecard-index">0{index + 1}</span><div className="scorecard-row-copy"><p>{question.prompt}</p><div className="scorecard-track"><span style={{ width: `${question.average * 20}%` }} /></div></div><strong>{question.average.toFixed(2)} <small>/ 5</small></strong></div>)}</div></section>
    <section className="report-section comments-section"><div className="section-heading-row"><div><p className="eyebrow">Anonymous comments</p><h2 id="comments-heading">What people said</h2></div><span className="section-count">{report.comments.length} notes</span></div><div className="comment-list">{report.comments.length ? report.comments.map((comment, index) => <blockquote key={`${comment}-${index}`}>{comment}</blockquote>) : <p>No comments.</p>}</div></section>
  </div>
  <section className="distribution-section report-section"><div className="section-heading-row"><div><p className="eyebrow">Response distribution</p><h2 id="distribution-heading">A fuller picture</h2></div><span className="section-count">Scale of 1 to 5</span></div><div className="distribution-grid">{report.questions.map((question) => <div className="distribution-card" key={question.id}><p>{question.prompt}</p><div className="distribution-bars">{question.distribution.map((point) => <div className="distribution-bar-wrap" key={point.rating}><span className="distribution-count">{point.count}</span><div className="distribution-bar-track"><span style={{ height: `${Math.max(point.count / report.responseCount * 100, 4)}%` }} /></div><span className="distribution-label">{point.rating}</span></div>)}</div></div>)}</div></section>
</main>
```

Compute each distribution percentage as `Math.round((point.count / report.responseCount) * 100)` and render zero-count bars at a visible minimum height of `4%`. Compute the highest-rated question from `report.questions` rather than from demo data. Render the threshold state inside the same `content-wrap report-layout` frame with a concise `Results will appear after at least 3 anonymous responses.` message and no score/count values.

- [ ] **Step 4: Run report and full-flow tests and commit**

Run the focused report tests plus `server/full-flow.test.ts`; expected result is all pass. Commit:

```text
git add -- src/pages/ReportPage.tsx src/pages/ReportPage.test.tsx
git commit -m "feat: restore live report presentation"
```

### Task 3: Restore the live administrator presentation

**Files:**
- Create: `src/pages/AdminPage.test.tsx`
- Modify: `src/pages/AdminPage.tsx`

**Interfaces:**
- Consumes: `login`, `listMeetings`, `createMeeting`, and `setMeetingStatus` from `src/api.ts`.
- Produces: the existing `AdminPage` API behavior with restored Dymon layout, forms, link cards, status pills, and responsive meeting list.

- [ ] **Step 1: Write failing admin presentation tests**

Mock the four API functions and cover login, creation, and status action:

```tsx
it("renders the restored administrator shell and creates meeting links", async () => {
  vi.mocked(login).mockResolvedValue(undefined);
  vi.mocked(listMeetings).mockResolvedValue([]);
  vi.mocked(createMeeting).mockResolvedValue({
    meeting: { id: "m1", title: "Investment Committee", chairLabel: "Amelia Tan", meetingAt: "2026-08-12T09:30:00.000Z", invitedCount: 5, status: "open" },
    surveyAccess: "survey-secret",
    reportAccess: "report-secret"
  });
  render(<AdminPage />);
  expect(screen.getByRole("heading", { name: /meeting feedback administration/i })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/administrator passphrase/i), { target: { value: "correct-passphrase" } });
  fireEvent.click(screen.getByRole("button", { name: /log in/i }));
  expect(await screen.findByRole("heading", { name: /set up a meeting/i })).toBeInTheDocument();
  expect(screen.getByText(/no meetings yet/i)).toBeInTheDocument();
});
```

Add a second test that renders an open meeting from `listMeetings`, clicks `Close survey`, and asserts `setMeetingStatus("m1", "closed")`.

- [ ] **Step 2: Run the focused admin tests and confirm failure**

Run `pnpm exec vitest run src/pages/AdminPage.test.tsx --reporter verbose`; expected failure is missing the restored heading and form labels.

- [ ] **Step 3: Implement the restored admin layout**

Keep the current login/create/toggle request flow and error handling. Use the visual structure from the original design:

```tsx
<main className="content-wrap admin-layout" aria-labelledby="admin-heading">
  <section className="admin-intro"><p className="eyebrow">Meeting feedback administration</p><h1 id="admin-heading">Set up a meeting</h1><p className="intro-copy">Create a private survey link and a chair report for each meeting.</p></section>
  <section className="admin-panel"><form className="admin-form" onSubmit={handleCreate}><label htmlFor="title">Meeting title<input id="title" name="title" required maxLength={200} /></label><label htmlFor="chairLabel">Chair label<input id="chairLabel" name="chairLabel" required maxLength={120} /></label><label htmlFor="meetingAt">Meeting date and time<input id="meetingAt" name="meetingAt" type="datetime-local" required /></label><label htmlFor="invitedCount">Invited attendees<input id="invitedCount" name="invitedCount" type="number" min="1" max="10000" required /></label><button className="primary-button" type="submit">Create meeting <span aria-hidden="true">→</span></button></form></section>
  <section className="admin-meetings"><div className="section-heading-row"><div><p className="eyebrow">Saved meetings</p><h2 id="meetings-heading">Meeting list</h2></div><span className="section-count">{meetings.length} meetings</span></div>{meetings.length === 0 ? <p className="empty-state">No meetings yet.</p> : meetings.map((meeting) => <article className="meeting-row" key={meeting.id}><div><h3>{meeting.title}</h3><p>{meeting.chairLabel} · {new Date(meeting.meetingAt).toLocaleDateString()}</p></div><span className={`status-pill status-${meeting.status}`}>{meeting.status}</span><button className="secondary-button" type="button" disabled={savingId === meeting.id} onClick={() => void toggle(meeting)}>{meeting.status === "open" ? "Close survey" : "Reopen survey"}</button></article>)}</section>
</main>
```

After creation, render survey/report links in a clearly labeled `.link-card` and preserve the `window.location.origin/#/survey/encoded-access-value` and `/#/report/encoded-access-value` formats. Render each meeting's status as an accessible text pill and keep the existing disabled state while saving. Do not expose the access values in the meeting list after the creation result is dismissed.

- [ ] **Step 4: Run admin, App, and API-flow tests and commit**

Run the focused admin tests, `src/App.test.tsx`, and `server/full-flow.test.ts`; commit the passing slice:

```text
git add -- src/pages/AdminPage.tsx src/pages/AdminPage.test.tsx
git commit -m "feat: restore admin presentation"
```

### Task 4: Restore the Dymon visual system and responsive styling

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: the class names introduced by Tasks 1–3.
- Produces: consistent desktop/mobile visual styling, shared logo header, global page frame, and route-level titles without changing data flow.

- [ ] **Step 1: Add shell assertions for the shared visual frame**

Extend `src/App.test.tsx` to assert `role="banner"`, the Dymon logo alt text, and the `page-rule` element for `#/admin`, `#/survey/encoded-access-value`, and `#/report/encoded-access-value` route renders. Keep the existing not-found assertion.

- [ ] **Step 2: Restore the historical CSS baseline without deleting user edits**

Use `git show codex/historical-meeting-series-dashboard:src/styles.css` as the baseline for typography, palette, spacing, panels, metrics, report bars, star ratings, responsive breakpoints, and focus states. Merge its rules into the current `src/styles.css` instead of replacing the file wholesale. Reapply the current user edits:

```css
:root { --numeric-font: "Aptos", "Inter", "Segoe UI", sans-serif; }

.receipt-answer strong,
.report-overview strong,
.overview-fact > strong,
.distribution-count,
.distribution-label {
  font-family: var(--numeric-font);
  font-variant-numeric: tabular-nums;
}
```

Add the admin-specific classes from Task 3 and the live badge/threshold classes from Task 2. Ensure every new interactive element has a visible `:focus-visible` style and that `@media (max-width: 760px)` reduces columns to one without horizontal page overflow.

- [ ] **Step 3: Run the client build and CSS sanity checks**

Run:

```text
$nodeDir='C:\Users\sg.bizdev.intern\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'; $env:Path="$nodeDir;$env:Path"; pnpm run build; git diff --check
```

Expected: the Vite/tsup build succeeds, no whitespace errors appear, and the existing numeric-font markers remain in `src/styles.css`.

- [ ] **Step 4: Commit the visual system**

```text
git add -- src/styles.css src/App.tsx src/App.test.tsx
git commit -m "feat: restore Dymon frontend visual system"
```

### Task 5: Preserve the historical series dashboard as a demo-only route

**Files:**
- Create: `src/pages/SeriesDemoPage.tsx`
- Modify: `src/routing.ts`
- Modify: `src/App.tsx`
- Modify: `src/data.ts`
- Modify: `src/types.ts`
- Modify: `src/routing.test.ts`
- Create: `src/pages/SeriesDemoPage.test.tsx`

**Interfaces:**
- Consumes: fictional `seriesOccurrences` data ported from commit `1b77346`.
- Produces: `HashRoute` kind `series_demo` for `/#/series-demo`, rendering an explicitly labeled “Fictional demo data” historical dashboard without calling the backend.

- [ ] **Step 1: Add the failing route and demo tests**

Extend the route union and tests with:

```ts
it("recognizes the explicitly labeled series demo route", () => {
  expect(parseHashRoute("#/series-demo")).toEqual({ kind: "series_demo" });
});
```

Add a page test asserting `Investment Committee`, `Six-meeting history`, and `Fictional demo data` render, and asserting no `/api` function is called.

- [ ] **Step 2: Port the existing demo data and dashboard composition**

Add `SeriesOccurrence` to `src/types.ts`, port the six existing fictional rows into `src/data.ts`, and extract the `SeriesDashboard` composition from commit `1b77346` into `SeriesDemoPage.tsx`. Keep the original chart/table calculations, label the page with `Fictional demo data`, and render each history-row action as a non-actionable `Demo report` label so the static page cannot imply live report access.

- [ ] **Step 3: Wire and test the route**

Render `<SeriesDemoPage />` from `App.tsx` only for `route.kind === "series_demo"`. Run route and page tests, then commit:

```text
git add -- src/pages/SeriesDemoPage.tsx src/pages/SeriesDemoPage.test.tsx src/routing.ts src/routing.test.ts src/App.tsx src/data.ts src/types.ts
git commit -m "feat: preserve historical series demo view"
```

### Task 6: Full verification, local smoke check, and production deployment

**Files:**
- Modify only if verification finds a real frontend issue: the affected frontend file and its test.

**Interfaces:**
- Consumes: all live pages, route tests, and backend API contracts.
- Produces: a verified production deployment with the restored frontend and unchanged backend behavior.

- [ ] **Step 1: Run the complete automated test suite in the stable Windows worker mode**

Run:

```text
$nodeDir='C:\Users\sg.bizdev.intern\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'; $env:Path="$nodeDir;$env:Path"; pnpm exec vitest run --pool forks --maxWorkers 1 --minWorkers 1 --reporter dot
```

Expected: every test file passes with zero failures.

- [ ] **Step 2: Run the production build and repository checks**

Run:

```text
$nodeDir='C:\Users\sg.bizdev.intern\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'; $env:Path="$nodeDir;$env:Path"; pnpm run build; git diff --check; git status --short --branch
```

Expected: build exit code `0`, no diff-check errors, and only intentional frontend changes are present.

- [ ] **Step 3: Run a local browser-level smoke check**

Start the existing dev command with the bundled Node path available:

```text
$nodeDir='C:\Users\sg.bizdev.intern\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'; $env:Path="$nodeDir;$env:Path"; pnpm run dev
```

Verify the client shell at `http://127.0.0.1:5173/#/admin`, the series demo at `http://127.0.0.1:5173/#/series-demo`, and a mocked/live test fixture for the survey and report layouts. Check desktop and a 390px-wide viewport for overflow, focus rings, star ratings, metric cards, distribution bars, and the meeting table.

- [ ] **Step 4: Serve the verified build from the single Fastify process**

Start the built app the way it is actually hosted, with the client served by Fastify rather than Vite:

```text
$env:HOST='127.0.0.1'; $env:PORT='3001'; & "$env:LOCALAPPDATA\Programs\node-v22.23.2-win-x64\node.exe" --env-file=.env.local dist\server\index.js
```

Expected: the process stays up and serves both `dist/client` and `/api` on port 3001.

- [ ] **Step 5: Verify same-origin routing and restored client assets**

Run a read-only smoke check against the running process:

```text
$base='http://127.0.0.1:3001'; $health=Invoke-WebRequest -UseBasicParsing "$base/api/health"; $root=Invoke-WebRequest -UseBasicParsing "$base/"; if($health.StatusCode -ne 200 -or $health.Content -notmatch '"status":"ok"'){ throw 'Health check failed' }; if($root.StatusCode -ne 200){ throw 'Client shell failed' }; "HEALTH $($health.StatusCode) $($health.Content)"; "ROOT $($root.StatusCode)"
```

Also confirm the HTML references a built `/assets/index-*.css` file and that the CSS contains the restored visual marker `.report-overview` plus `--numeric-font`.

- [ ] **Step 6: Commit any final verification-only adjustments**

If all checks pass, do not alter backend files. Commit only any small frontend correction discovered by the smoke check:

```text
git add -- src
git commit -m "fix: polish restored meeting feedback frontend"
```

If no correction is needed, leave the implementation commits as-is and report the production URL, verification counts, and preserved working-tree changes.
