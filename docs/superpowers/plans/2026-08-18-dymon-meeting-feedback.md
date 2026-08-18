# Dymon Meeting Feedback Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, self-contained React/Vite localhost prototype for an anonymous meeting feedback survey and a chair-facing demo report.

**Architecture:** A single-page React app keeps `mode`, draft answers, and submitted answers in the root component. Typed demo data lives in a constants module, validation is a pure function, and focused components handle the survey, receipt, and report surfaces. CSS owns the neutral investment-firm visual system and responsive breakpoints; there is no backend or persistence.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, jsdom, plain CSS.

**Spec:** `docs/superpowers/specs/2026-08-18-dymon-meeting-feedback-design.md`

## Global Constraints

- Use the exact meeting context copy “Title of the meeting” and “Meeting date · Meeting chair”.
- Include exactly three required 1–5 star questions and one optional free-text prompt.
- Keep feedback anonymous and clearly label chair metrics as demo data.
- Do not add Outlook/calendar automation, authentication, backend persistence, external connectors, official logos, or confidential assets.
- Keep star controls as semantic native radio groups with visible focus treatment and keyboard support.
- Verify with Vitest, a production build, and a browser smoke check; keep the local dev server running.

---

### Task 1: Scaffold the minimal local React app

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/vite-env.d.ts`

**Interfaces:**
- Produces the Vite app entrypoint at `src/main.tsx` and scripts `dev`, `build`, `test`, and `test:watch` consumed by later tasks.

- [ ] **Step 1: Add package metadata and scripts**

Create `package.json` with React/Vite runtime packages and Vitest/Testing Library test packages. Use these scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Add Vite and TypeScript configuration**

Configure `vite.config.ts` with the React plugin and `test: { environment: "jsdom", setupFiles: "./src/test-setup.ts" }`. Configure strict TypeScript compilation in `tsconfig.json` and a project reference to `tsconfig.node.json`.

- [ ] **Step 3: Add the app entrypoint**

Create `src/main.tsx` that imports React, `createRoot`, `App`, and `styles.css`, then renders `<App />` into `#root`.

- [ ] **Step 4: Install dependencies and run the empty baseline test command**

Run `npm install`, then `npm test`. Expected result: Vitest starts successfully and reports no test files yet; this confirms the local toolchain is usable before behavior tests are added.

- [ ] **Step 5: Commit the scaffold**

```bash
git add package.json pnpm-lock.yaml index.html tsconfig.json tsconfig.node.json vite.config.ts .gitignore src/main.tsx src/vite-env.d.ts
git commit -m "chore: scaffold meeting feedback prototype"
```

### Task 2: Define typed survey data and validation with a failing test first

**Files:**
- Create: `src/types.ts`
- Create: `src/data.ts`
- Create: `src/validation.ts`
- Create: `src/validation.test.ts`
- Create: `src/test-setup.ts`

**Interfaces:**
- `SurveyAnswers = { usefulness: number | null; actionability: number | null; reInvite: number | null; comment: string }`.
- `validateSurvey(answers: SurveyAnswers): { usefulness?: string; actionability?: string; reInvite?: string }` returns one error per missing required rating.
- `meetingQuestions` contains stable question ids, prompt text, and helper text for the three rating questions.
- `reportData` contains response rate, invitee/respondent counts, score, per-question averages/distributions, and three anonymous comments.

- [ ] **Step 1: Write the failing validation tests**

In `src/validation.test.ts`, test that an empty answer object returns errors for all three required ids, that partial answers return only the missing errors, and that ratings from 1 through 5 with any comment return `{}`.

```ts
expect(validateSurvey({ usefulness: null, actionability: null, reInvite: null, comment: "" })).toEqual({
  usefulness: "Please select a rating.",
  actionability: "Please select a rating.",
  reInvite: "Please select a rating."
});
```

- [ ] **Step 2: Run the validation test to verify it fails**

Run `npm test -- src/validation.test.ts`. Expected result: FAIL because `src/validation.ts` and `validateSurvey` do not exist yet.

- [ ] **Step 3: Implement the types, data, and minimal validator**

Implement `validateSurvey` with three explicit null checks and create realistic but fictional report values: 24 of 31 responses, 77% response rate, 4.2 Meeting Value Score, averages between 3.9 and 4.4, distributions totaling 24, and anonymous comments that do not identify real people or meetings.

- [ ] **Step 4: Run the validation test to verify it passes**

Run `npm test -- src/validation.test.ts`. Expected result: all validation tests PASS.

- [ ] **Step 5: Commit the behavior foundation**

```bash
git add src/types.ts src/data.ts src/validation.ts src/validation.test.ts src/test-setup.ts
git commit -m "feat: add survey types demo data and validation"
```

### Task 3: Build the survey form and receipt flow with failing component tests first

**Files:**
- Create: `src/App.tsx`
- Create: `src/App.test.tsx`

**Interfaces:**
- `App` owns `mode`, draft `answers`, and `submittedAnswers` state.
- The survey submit handler calls `validateSurvey`, focuses the first invalid `fieldset`, and sets `submittedAnswers` only for valid input.
- The receipt view exposes a “Edit response” button that clears `submittedAnswers` without losing the current draft values.

- [ ] **Step 1: Write failing component tests**

In `src/App.test.tsx`, add tests that render `<App />`, click “Submit feedback” with no ratings and observe three required error messages while no receipt is shown, select ratings by accessible radio labels and type a comment then submit and observe “Feedback received” plus all selected rating values/comment, and click “Chair report” then “Attendee survey” to verify both view headings.

- [ ] **Step 2: Run the component tests to verify they fail**

Run `npm test -- src/App.test.tsx`. Expected result: FAIL because `App` is not implemented.

- [ ] **Step 3: Implement the attendee surface and receipt**

Build semantic markup with a page header, meeting context block, anonymous notice, three `fieldset` radio groups with five labelled radios each, optional textarea, submit button, and receipt cards. Use button labels and text that match the requirements so tests and keyboard users have stable targets.

- [ ] **Step 4: Run component tests and fix only test-proven issues**

Run `npm test -- src/App.test.tsx`. Expected result: all component tests PASS. If a test fails, adjust the smallest relevant component behavior, not the test’s assertion.

- [ ] **Step 5: Commit the survey flow**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: add attendee survey and receipt flow"
```

### Task 4: Add the chair report and the complete visual system

**Files:**
- Create: `src/styles.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Report mode renders the typed `reportData` without mutating survey answers.
- CSS exposes responsive behavior at a 760px breakpoint, visible `:focus-visible` states, star states, metric bars, report cards, and receipt/survey layout classes used by `App`.

- [ ] **Step 1: Add the report render path**

Render a demo-data eyebrow, “Chair report” heading, response-rate metric, Meeting Value Score metric, three average-score rows, labelled distribution bars for each question, and anonymous comment cards. Add a view switch button in the header that is present in both modes.

- [ ] **Step 2: Add responsive and accessible styling**

Use CSS variables for ink, navy, paper, muted, emerald, and rule colors. Add a two-column desktop layout that collapses to one column on narrow screens, keep action controls full-width on mobile, use `:focus-visible` outlines, and ensure radios remain visually present to assist keyboard navigation while labels show star affordances.

- [ ] **Step 3: Run all tests and perform a build check**

Run `npm test` and `npm run build`. Expected result: zero test failures and a successful Vite production bundle.

- [ ] **Step 4: Commit the report and visual system**

```bash
git add src/App.tsx src/styles.css
git commit -m "feat: add chair report and responsive visual system"
```

### Task 5: Document setup and verify the working demo in a browser

**Files:**
- Modify: `index.html`
- Create: `README.md`

**Interfaces:**
- README gives exact commands for install, test, build, and dev server startup.
- Browser verification uses the stable local URL printed by Vite and does not require external services.

- [ ] **Step 1: Finish document metadata**

Set the page title to `Meeting feedback · Demo prototype` and add a concise description that says it is a demo-only anonymous meeting feedback prototype.

- [ ] **Step 2: Write the README**

Document:

```text
npm install
npm run dev
# open the printed localhost URL
npm test
npm run build
```

Also state that the chair report is populated with fictional demo data and that no Outlook/calendar integration or persistence is included.

- [ ] **Step 3: Start the dev server**

Run `npm run dev -- --host 127.0.0.1` in a retained session and use the exact printed localhost URL. Keep this process running for handoff.

- [ ] **Step 4: Browser-smoke-test the key flows**

Using the available browser tool, open the local URL and verify: empty submit shows required errors; selecting all three ratings and entering a comment shows the receipt with the same answers; “Chair report” shows the report metrics/comments; “Attendee survey” returns to the survey; and the page remains usable at a narrow viewport.

- [ ] **Step 5: Run final verification commands**

Run `npm test`, `npm run build`, and `git status --short`. Confirm the first two exit successfully, the final status shows only intended prototype/spec/plan files, and the dev server remains alive.

- [ ] **Step 6: Commit documentation and metadata**

```bash
git add index.html README.md
git commit -m "docs: add local setup and demo notes"
```
