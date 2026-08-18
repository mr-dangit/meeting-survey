# Meeting Feedback Backend MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a hosted meeting-feedback MVP that persists anonymous survey submissions in PostgreSQL and exposes thresholded aggregate results through a private chair link.

**Architecture:** Extend the existing React/Vite application with a Fastify TypeScript API and PostgreSQL repositories. The browser uses hash routes so survey and report secrets do not enter HTTP access logs; the API hashes those secrets, persists only anonymous answers, and calculates reports server-side. Tests use `pg-mem` through the same `pg` interface because Docker is unavailable, while the hosted deployment uses real Render PostgreSQL.

**Tech Stack:** React 18, TypeScript, Vite, Fastify 5, Zod 4, node-postgres 8, pg-mem 3, Vitest, Testing Library, tsup, Render Web Service, Render PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-08-18-meeting-feedback-backend-mvp-design.md`

## Global Constraints

- Collect exactly three required integer scores from 1 through 5 and one optional comment of at most 1,000 characters.
- Never store attendee names, email addresses, access secrets, IP addresses, browser fingerprints, or user-agent strings with responses.
- Use one shared survey secret and one unrelated report secret per meeting; persist only SHA-256 hashes.
- Return no scores, distributions, comments, or precise response count until at least three responses exist.
- Never expose raw response rows through an HTTP endpoint.
- Use parameterized SQL for every value written to or read from PostgreSQL.
- Keep administrator, survey, and report API view models separate.
- Treat repeat submissions through the shared link as an accepted MVP limitation.
- Preserve unrelated existing working-tree changes in `src/App.tsx`, `src/App.test.tsx`, and `src/styles.css`.
- Require HTTPS in the hosted environment; use secure cookies when `NODE_ENV=production`.
- Keep Microsoft 365, email, unique attendee links, scheduled jobs, automatic retention, and audit logging out of this implementation.

---

## File structure

### Server

- `server/config.ts` — validates environment configuration.
- `server/app.ts` — builds the Fastify application and registers plugins/routes.
- `server/index.ts` — production process entrypoint.
- `server/domain/types.ts` — meeting, response, access, and report types.
- `server/domain/repositories.ts` — storage interfaces used by services.
- `server/domain/security.ts` — secret generation, hashing, and constant-time passphrase comparison.
- `server/domain/report.ts` — pure aggregate-report calculation.
- `server/db/pool.ts` — production PostgreSQL pool construction.
- `server/db/migrations.ts` — versioned schema and migration runner.
- `server/db/migrate-cli.ts` — deployment migration command.
- `server/db/postgres-repositories.ts` — parameterized PostgreSQL repositories.
- `server/services/meeting-service.ts` — meeting creation and status changes.
- `server/services/survey-service.ts` — public context and anonymous submission.
- `server/services/report-service.ts` — thresholded report retrieval.
- `server/routes/admin.ts` — administrator login and meeting routes.
- `server/routes/survey.ts` — attendee routes.
- `server/routes/report.ts` — chair-report route.
- `server/testing/database.ts` — pg-mem test pool using the production driver shape.

### Client

- `src/routing.ts` — parses `#/admin`, `#/survey/<secret>`, and `#/report/<secret>`.
- `src/api.ts` — typed API client and normalized errors.
- `src/pages/AdminPage.tsx` — login, meeting creation, link copying, close/reopen controls.
- `src/pages/SurveyPage.tsx` — loads meeting context and submits anonymous answers.
- `src/pages/ReportPage.tsx` — renders threshold state or live aggregate results.
- `src/components/RatingField.tsx` — accessible reusable 1–5 rating control.
- `src/App.tsx` — route composition only.
- `src/types.ts` — shared client view-model types.
- `src/styles.css` — existing visual system plus admin/loading/error states.

### Deployment and documentation

- `.env.example` — required local configuration names without secrets.
- `render.yaml` — temporary Render web service and PostgreSQL Blueprint.
- `README.md` — local verification, deployment, and MVP limitations.

---

### Task 1: Add the Fastify server foundation

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `tsconfig.server.json`
- Create: `.env.example`
- Create: `server/config.ts`
- Create: `server/app.ts`
- Create: `server/index.ts`
- Test: `server/app.test.ts`

**Interfaces:**
- Produces: `loadConfig(env: NodeJS.ProcessEnv): AppConfig`.
- Produces: `buildApp(options: { config: AppConfig }): Promise<FastifyInstance>`.
- Produces: `GET /api/health -> { status: "ok" }`.
- Later tasks extend `buildApp` with repositories without changing its return type.

- [ ] **Step 1: Install runtime and test dependencies and add scripts**

Run with the bundled package manager if `npm` is unavailable on `PATH`:

```powershell
$env:PATH = "C:\Users\sg.bizdev.intern\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\sg.bizdev.intern\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback;$env:PATH"
npm install fastify@^5.10 @fastify/cookie@^11 @fastify/static@^8 pg@^8.22 zod@^4
npm install --save-dev @types/pg@^8 concurrently@^9 pg-mem@^3 tsup@^8 tsx@^4
```

Set these `package.json` scripts:

```json
{
  "scripts": {
    "dev": "concurrently -k \"vite --host 127.0.0.1\" \"tsx watch server/index.ts\"",
    "build": "vite build && tsup server/index.ts --format esm --out-dir dist/server --sourcemap --clean",
    "start": "node dist/server/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Write failing health and configuration tests**

Create `server/app.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { loadConfig } from "./config";

describe("server foundation", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("reports health without exposing configuration", async () => {
    const app = await buildApp({
      config: {
        nodeEnv: "test",
        port: 3001,
        databaseUrl: "postgresql://unused",
        adminPassphrase: "test-admin-passphrase",
        sessionSecret: "test-session-secret-at-least-32-characters"
      }
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    expect(response.body).not.toContain("test-admin-passphrase");
  });

  it("rejects missing production secrets", () => {
    expect(() => loadConfig({ NODE_ENV: "production", DATABASE_URL: "postgresql://db" })).toThrow(
      /ADMIN_PASSPHRASE/
    );
  });
});
```

- [ ] **Step 3: Run the test and verify the missing modules fail**

Run: `npm test -- server/app.test.ts`

Expected: FAIL because `server/app.ts` and `server/config.ts` do not exist.

- [ ] **Step 4: Implement validated config, app construction, and process startup**

Define `AppConfig` in `server/config.ts`:

```ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  ADMIN_PASSPHRASE: z.string().min(12),
  SESSION_SECRET: z.string().min(32)
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  adminPassphrase: string;
  sessionSecret: string;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const value = envSchema.parse(env);
  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    databaseUrl: value.DATABASE_URL,
    adminPassphrase: value.ADMIN_PASSPHRASE,
    sessionSecret: value.SESSION_SECRET
  };
}
```

Implement `buildApp` as async, register `@fastify/cookie`, add the health route, and set Fastify logging to redact `req.headers.x-survey-access`, `req.headers.x-report-access`, `req.body`, and `res.body`. In `server/index.ts`, call `loadConfig(process.env)`, build the app, and listen on `{ host: "0.0.0.0", port: config.port }`.

Create `.env.example` with non-secret names only:

```dotenv
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://meeting_feedback:meeting_feedback@127.0.0.1:5432/meeting_feedback
ADMIN_PASSPHRASE=replace-with-a-long-local-passphrase
SESSION_SECRET=replace-with-at-least-32-random-characters
```

Set Vite's development proxy for `/api` to `http://127.0.0.1:3001`. Set `tsconfig.server.json` to strict TypeScript, target ES2022, use `module: "NodeNext"`, and include `server/**/*.ts`.

- [ ] **Step 5: Run foundation tests and production build**

Run: `npm test -- server/app.test.ts && npm run build`

Expected: two passing tests and both Vite and tsup builds complete successfully.

- [ ] **Step 6: Commit the server foundation**

```powershell
git add package.json package-lock.json vite.config.ts tsconfig.server.json .env.example server/config.ts server/app.ts server/index.ts server/app.test.ts
git commit -m "chore: add meeting feedback API foundation"
```

---

### Task 2: Add the PostgreSQL schema and repository boundary

**Files:**
- Create: `server/domain/types.ts`
- Create: `server/domain/repositories.ts`
- Create: `server/db/pool.ts`
- Create: `server/db/migrations.ts`
- Create: `server/db/migrate-cli.ts`
- Create: `server/db/postgres-repositories.ts`
- Create: `server/testing/database.ts`
- Test: `server/db/postgres-repositories.test.ts`

**Interfaces:**
- Produces: `MeetingRepository.create`, `list`, `findBySurveyHash`, `findByReportHash`, and `setStatus`.
- Produces: `ResponseRepository.create` and `listForMeeting`.
- Produces: `runMigrations(pool: DbPool): Promise<void>` and `createTestDatabase()`.
- Stores no respondent identity fields in the `responses` table.

- [ ] **Step 1: Define domain and repository contracts**

Create these types in `server/domain/types.ts`:

```ts
export type MeetingStatus = "open" | "closed";

export type Meeting = {
  id: string;
  title: string;
  chairLabel: string;
  meetingAt: Date;
  invitedCount: number;
  status: MeetingStatus;
  surveySecretHash: string;
  reportSecretHash: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AnonymousResponse = {
  id: string;
  meetingId: string;
  usefulness: number;
  actionability: number;
  reInvite: number;
  comment: string;
  submittedAt: Date;
};
```

Create `DbPool`, `MeetingRepository`, and `ResponseRepository` in `server/domain/repositories.ts`. `ResponseRepository` must expose only `create(input)` and `listForMeeting(meetingId)`; no method may join responses to an identity table.

```ts
import type { AnonymousResponse, Meeting, MeetingStatus } from "./types";

export type DbPool = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: Row[]; rowCount: number | null }>;
  connect(): Promise<{
    query<Row extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values?: unknown[]
    ): Promise<{ rows: Row[]; rowCount: number | null }>;
    release(): void;
  }>;
  end(): Promise<void>;
};

export type CreateMeetingRecord = Meeting;

export interface MeetingRepository {
  create(input: CreateMeetingRecord): Promise<Meeting>;
  list(): Promise<Meeting[]>;
  findBySurveyHash(hash: string): Promise<Meeting | null>;
  findByReportHash(hash: string): Promise<Meeting | null>;
  setStatus(id: string, status: MeetingStatus, updatedAt: Date): Promise<Meeting | null>;
}

export interface ResponseRepository {
  create(input: AnonymousResponse): Promise<AnonymousResponse>;
  listForMeeting(meetingId: string): Promise<AnonymousResponse[]>;
}
```

- [ ] **Step 2: Write failing repository tests**

Create `server/db/postgres-repositories.test.ts` with tests that migrate a pg-mem pool, create a meeting, insert a response, reload both records, and inspect the response columns:

```ts
it("persists an anonymous response without identity columns", async () => {
  const { pool, meetings, responses } = await createTestDatabase();
  const meeting = await meetings.create(meetingFixture());

  await responses.create({
    id: "20000000-0000-4000-8000-000000000001",
    meetingId: meeting.id,
    usefulness: 4,
    actionability: 5,
    reInvite: 3,
    comment: "End with a decision recap.",
    submittedAt: new Date("2026-08-18T08:30:00.000Z")
  });

  expect(await responses.listForMeeting(meeting.id)).toHaveLength(1);
  const columns = await pool.query<{ column_name: string }>(
    "select column_name from information_schema.columns where table_name = 'responses' order by column_name"
  );
  expect(columns.rows.map((row) => row.column_name)).toEqual([
    "actionability", "comment", "id", "meeting_id", "re_invite", "submitted_at", "usefulness"
  ]);
  await pool.end();
});
```

Also test that database checks reject a rating of `6` and that deleting a meeting cascades to its anonymous responses.

- [ ] **Step 3: Run repository tests and verify failure**

Run: `npm test -- server/db/postgres-repositories.test.ts`

Expected: FAIL because the migration and repository modules do not exist.

- [ ] **Step 4: Implement the versioned schema**

In `server/db/migrations.ts`, define migration version `1` with this schema and record applied versions in `schema_migrations`:

```sql
create table if not exists meetings (
  id uuid primary key,
  title varchar(200) not null check (char_length(title) between 1 and 200),
  chair_label varchar(120) not null check (char_length(chair_label) between 1 and 120),
  meeting_at timestamptz not null,
  invited_count integer not null check (invited_count > 0),
  status varchar(10) not null check (status in ('open', 'closed')),
  survey_secret_hash char(64) not null unique,
  report_secret_hash char(64) not null unique,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists responses (
  id uuid primary key,
  meeting_id uuid not null references meetings(id) on delete cascade,
  usefulness smallint not null check (usefulness between 1 and 5),
  actionability smallint not null check (actionability between 1 and 5),
  re_invite smallint not null check (re_invite between 1 and 5),
  comment varchar(1000) not null default '',
  submitted_at timestamptz not null
);

create index if not exists responses_meeting_id_idx on responses(meeting_id);
```

Run each unapplied migration inside `BEGIN`/`COMMIT`; on failure issue `ROLLBACK` and rethrow. `server/db/migrate-cli.ts` must create the production pool, call `runMigrations`, and always close the pool.

- [ ] **Step 5: Implement parameterized repositories and pg-mem test construction**

Use `pg.Pool` in `server/db/pool.ts`. In `server/db/postgres-repositories.ts`, map snake-case database rows to the domain types and use positional parameters for every value. For example:

```ts
const result = await this.pool.query<MeetingRow>(
  `insert into meetings
   (id, title, chair_label, meeting_at, invited_count, status, survey_secret_hash, report_secret_hash, created_at, updated_at)
   values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
   returning *`,
  [input.id, input.title, input.chairLabel, input.meetingAt, input.invitedCount, input.status,
   input.surveySecretHash, input.reportSecretHash, input.createdAt, input.updatedAt]
);
```

In `server/testing/database.ts`, use `newDb().adapters.createPg().Pool`, run migrations, and return `{ pool, meetings: new PostgresMeetingRepository(pool), responses: new PostgresResponseRepository(pool) }`.

Update `package.json` in this task so the build includes the new migration entrypoint:

```json
{
  "scripts": {
    "build": "vite build && tsup server/index.ts server/db/migrate-cli.ts --format esm --out-dir dist/server --sourcemap --clean",
    "migrate": "node dist/server/migrate-cli.js"
  }
}
```

- [ ] **Step 6: Run database tests**

Run: `npm test -- server/db/postgres-repositories.test.ts`

Expected: all persistence, constraint, cascade, and identity-column tests pass.

- [ ] **Step 7: Commit the database boundary**

```powershell
git add package.json server/domain server/db server/testing
git commit -m "feat: add anonymous PostgreSQL persistence"
```

---

### Task 3: Add administrator authentication and meeting creation

**Files:**
- Create: `server/domain/security.ts`
- Create: `server/services/meeting-service.ts`
- Create: `server/routes/admin.ts`
- Modify: `server/app.ts`
- Modify: `server/app.test.ts`
- Test: `server/routes/admin.test.ts`

**Interfaces:**
- Consumes: `MeetingRepository` and `AppConfig`.
- Produces: `POST /api/admin/session`, `DELETE /api/admin/session`, `GET /api/admin/meetings`, `POST /api/admin/meetings`, and `PATCH /api/admin/meetings/:id/status`.
- Produces: meeting creation response `{ meeting, surveyAccess, reportAccess }`; raw access values are returned only once.

- [ ] **Step 1: Write failing administrator-route tests**

Cover all of these behaviors in `server/routes/admin.test.ts` using `app.inject` and the pg-mem repositories:

```ts
it("requires login and creates unrelated hashed access secrets", async () => {
  const unauthenticated = await app.inject({ method: "GET", url: "/api/admin/meetings" });
  expect(unauthenticated.statusCode).toBe(401);

  const login = await app.inject({
    method: "POST",
    url: "/api/admin/session",
    payload: { passphrase: "test-admin-passphrase" }
  });
  const cookie = login.cookies.find((item) => item.name === "admin_session")!;

  const created = await app.inject({
    method: "POST",
    url: "/api/admin/meetings",
    cookies: { admin_session: cookie.value },
    payload: {
      title: "Weekly investment review",
      chairLabel: "Meeting chair",
      meetingAt: "2026-08-18T08:00:00.000Z",
      invitedCount: 5
    }
  });

  expect(created.statusCode).toBe(201);
  const body = created.json();
  expect(body.surveyAccess).not.toBe(body.reportAccess);
  expect(JSON.stringify(await repositories.meetings.list())).not.toContain(body.surveyAccess);
  expect(JSON.stringify(await repositories.meetings.list())).not.toContain(body.reportAccess);
});
```

Also test invalid passphrases, invalid invited counts, list responses excluding both hashes, and close/reopen status changes.

- [ ] **Step 2: Run administrator tests and verify failure**

Run: `npm test -- server/routes/admin.test.ts`

Expected: FAIL because security, service, and routes are absent.

- [ ] **Step 3: Implement secret and passphrase helpers**

In `server/domain/security.ts`:

```ts
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const generateAccessSecret = () => randomBytes(32).toString("base64url");
export const hashAccessSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

export function passphraseMatches(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
```

- [ ] **Step 4: Implement the meeting service and administrator routes**

`MeetingService.create` must trim title/chair label, generate `crypto.randomUUID()`, generate two secrets independently, hash them, and store only the hashes. Define Zod schemas with title length 1–200, chair label length 1–120, ISO datetime, and invited count as an integer from 1 through 10,000.

Register signed cookies with `config.sessionSecret`. On successful login set `admin_session=authenticated` with `httpOnly: true`, `sameSite: "strict"`, `secure: config.nodeEnv === "production"`, `signed: true`, and `path: "/"`. Every `/api/admin/meetings` route must verify the signed cookie before invoking the service.

`GET /api/admin/meetings` returns only `id`, `title`, `chairLabel`, `meetingAt`, `invitedCount`, and `status`. `PATCH` accepts exactly `{ status: "open" | "closed" }`.

- [ ] **Step 5: Wire repositories into `buildApp` and run tests**

Change `buildApp` to consume:

```ts
type BuildAppOptions = {
  config: AppConfig;
  meetings: MeetingRepository;
  responses: ResponseRepository;
};
```

Production `server/index.ts` constructs the real pool and PostgreSQL repositories. Tests pass pg-mem repositories.

Update `server/app.test.ts` to call `createTestDatabase()` and pass its meeting and response repositories to `buildApp`; close both the Fastify app and test pool after each test.

Run: `npm test -- server/routes/admin.test.ts server/app.test.ts`

Expected: all administrator and foundation tests pass.

- [ ] **Step 6: Commit administrator and meeting behavior**

```powershell
git add server/domain/security.ts server/services/meeting-service.ts server/routes/admin.ts server/app.ts server/app.test.ts server/index.ts server/routes/admin.test.ts
git commit -m "feat: add test meeting administration"
```

---

### Task 4: Persist anonymous survey submissions

**Files:**
- Create: `server/services/survey-service.ts`
- Create: `server/routes/survey.ts`
- Modify: `server/app.ts`
- Test: `server/routes/survey.test.ts`

**Interfaces:**
- Consumes: `MeetingRepository`, `ResponseRepository`, and `hashAccessSecret`.
- Produces: `GET /api/survey` and `POST /api/survey/responses`, both requiring `x-survey-access`.
- Produces public meeting context `{ id, title, chairLabel, meetingAt, status }` only.

- [ ] **Step 1: Write failing survey access and persistence tests**

Create a meeting through `MeetingService`, retain the returned survey secret in the fixture, and test:

```ts
it("stores a valid response and returns no stored row", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/survey/responses",
    headers: { "x-survey-access": surveyAccess },
    payload: {
      usefulness: 4,
      actionability: 5,
      reInvite: 3,
      comment: "End with a decision recap."
    }
  });

  expect(response.statusCode).toBe(201);
  expect(response.json()).toEqual({ status: "recorded" });
  const stored = await repositories.responses.listForMeeting(meeting.id);
  expect(stored).toMatchObject([{ usefulness: 4, actionability: 5, reInvite: 3 }]);
});
```

Also test an invalid secret returns `404`, closed meetings return `409`, ratings outside 1–5 return `400`, a 1,001-character comment returns `400`, and multiple valid submissions through one shared secret are accepted.

- [ ] **Step 2: Run survey tests and verify failure**

Run: `npm test -- server/routes/survey.test.ts`

Expected: FAIL because the survey service and routes do not exist.

- [ ] **Step 3: Implement survey validation and persistence**

Define this Zod input schema:

```ts
const submissionSchema = z.object({
  usefulness: z.number().int().min(1).max(5),
  actionability: z.number().int().min(1).max(5),
  reInvite: z.number().int().min(1).max(5),
  comment: z.string().max(1000).default("")
}).strict();
```

`SurveyService` hashes the header, looks up the meeting, checks `status === "open"`, generates the response UUID server-side, trims the comment, inserts the anonymous record, and returns `{ status: "recorded" }`. It must not pass request headers or request metadata to the response repository.

- [ ] **Step 4: Register routes and normalize errors**

Map missing/invalid access to `404 { error: "Survey not found." }`, closed meetings to `409 { error: "This survey is closed." }`, invalid payloads to `400 { error: "Check the survey answers and try again." }`, and unexpected database failures to `503 { error: "Feedback could not be saved. Please try again." }`.

- [ ] **Step 5: Run survey and database tests**

Run: `npm test -- server/routes/survey.test.ts server/db/postgres-repositories.test.ts`

Expected: all tests pass, including repeat shared-link submissions and the identity-column assertion.

- [ ] **Step 6: Commit survey persistence**

```powershell
git add server/services/survey-service.ts server/routes/survey.ts server/app.ts server/routes/survey.test.ts
git commit -m "feat: persist anonymous survey submissions"
```

---

### Task 5: Calculate and protect the chair report

**Files:**
- Create: `server/domain/report.ts`
- Modify: `server/domain/types.ts`
- Create: `server/services/report-service.ts`
- Create: `server/routes/report.ts`
- Modify: `server/app.ts`
- Test: `server/domain/report.test.ts`
- Test: `server/routes/report.test.ts`

**Interfaces:**
- Produces: `calculateReport(meeting, responses): CompleteReport`.
- Produces: `GET /api/report` requiring `x-report-access`.
- Returns either `{ status: "threshold_not_met", minimumResponses: 3 }` or `{ status: "complete", ...aggregates }`.

Add these report contracts to `server/domain/types.ts`:

```ts
export type ReportQuestionId = "usefulness" | "actionability" | "reInvite";
export type ReportDistributionPoint = { rating: 1 | 2 | 3 | 4 | 5; count: number };
export type ReportQuestion = {
  id: ReportQuestionId;
  prompt: string;
  average: number;
  distribution: ReportDistributionPoint[];
};
export type CompleteReport = {
  status: "complete";
  meeting: { title: string; chairLabel: string; meetingAt: string; status: MeetingStatus };
  responseCount: number;
  invitedCount: number;
  responseRate: number;
  valueScore: number;
  questions: ReportQuestion[];
  comments: string[];
};
export type ReportResult =
  | { status: "threshold_not_met"; minimumResponses: 3 }
  | CompleteReport;
```

- [ ] **Step 1: Write failing pure report-calculation tests**

Use three fixed responses and assert exact values:

```ts
const report = calculateReport(meetingWithFiveInvitees, [
  response({ usefulness: 5, actionability: 4, reInvite: 3, comment: "Shorter pre-read." }),
  response({ usefulness: 4, actionability: 4, reInvite: 5, comment: "" }),
  response({ usefulness: 3, actionability: 2, reInvite: 4, comment: "More decision time." })
]);

expect(report.responseCount).toBe(3);
expect(report.responseRate).toBe(60);
expect(report.valueScore).toBe(3.78);
expect(report.questions.find((q) => q.id === "usefulness")).toMatchObject({
  average: 4,
  distribution: [
    { rating: 1, count: 0 }, { rating: 2, count: 0 }, { rating: 3, count: 1 },
    { rating: 4, count: 1 }, { rating: 5, count: 1 }
  ]
});
expect(report.comments).toEqual(["Shorter pre-read.", "More decision time."]);
```

Also test response rate is capped at `100` when submissions exceed invited count.

- [ ] **Step 2: Write failing report-route privacy tests**

Test an invalid report secret returns `404`. With zero, one, or two responses, assert the response equals exactly:

```json
{ "status": "threshold_not_met", "minimumResponses": 3 }
```

With three responses, assert aggregate values are present and serialized JSON contains none of `responseId`, `meetingId`, `submittedAt`, `surveySecretHash`, or `reportSecretHash`.

- [ ] **Step 3: Run report tests and verify failure**

Run: `npm test -- server/domain/report.test.ts server/routes/report.test.ts`

Expected: FAIL because report calculation and routes do not exist.

- [ ] **Step 4: Implement deterministic report calculation**

Round averages and Meeting Value Score to two decimal places. Create distributions for every rating 1–5 even when its count is zero. Calculate `valueScore` from all required scores:

```ts
const total = responses.reduce(
  (sum, item) => sum + item.usefulness + item.actionability + item.reInvite,
  0
);
const valueScore = round2(total / (responses.length * 3));
const responseRate = Math.min(100, round2((responses.length / meeting.invitedCount) * 100));
```

Exclude blank comments after trimming. Use the existing question prompts from a server-owned constant rather than accepting prompt text from the browser.

- [ ] **Step 5: Implement thresholded report retrieval**

`ReportService` hashes the supplied report access value, retrieves the meeting and its anonymous responses, and returns the threshold object before calling `calculateReport` when `responses.length < 3`. The route must never include the below-threshold response count.

- [ ] **Step 6: Run all server tests**

Run: `npm test -- server`

Expected: all server tests pass with no raw-row or secret leakage.

- [ ] **Step 7: Commit reporting**

```powershell
git add server/domain/report.ts server/domain/report.test.ts server/domain/types.ts server/services/report-service.ts server/routes/report.ts server/routes/report.test.ts server/app.ts
git commit -m "feat: add thresholded chair reporting"
```

---

### Task 6: Connect hash routing and the test-administration UI

**Files:**
- Create: `src/routing.ts`
- Create: `src/routing.test.ts`
- Create: `src/api.ts`
- Create: `src/pages/AdminPage.tsx`
- Create: `src/pages/AdminPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/types.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes administrator endpoints from Task 3.
- Produces route types `{ kind: "admin" }`, `{ kind: "survey"; access: string }`, `{ kind: "report"; access: string }`, and `{ kind: "not_found" }`.
- Produces meeting links as `/#/survey/<encoded secret>` and `/#/report/<encoded secret>`.

- [ ] **Step 1: Write failing hash-route tests**

```ts
expect(parseHashRoute("#/admin")).toEqual({ kind: "admin" });
expect(parseHashRoute("#/survey/a%2Fb")).toEqual({ kind: "survey", access: "a/b" });
expect(parseHashRoute("#/report/chair-secret")).toEqual({ kind: "report", access: "chair-secret" });
expect(parseHashRoute("#/unknown")).toEqual({ kind: "not_found" });
```

Also assert `window.location.pathname` is not used to hold either access secret.

- [ ] **Step 2: Write failing administrator component tests**

Mock `src/api.ts` and test login, creation validation, creation success, and link construction:

```ts
expect(await screen.findByRole("link", { name: "Open attendee survey" })).toHaveAttribute(
  "href", `${window.location.origin}/#/survey/survey-secret`
);
expect(screen.getByRole("link", { name: "Open chair report" })).toHaveAttribute(
  "href", `${window.location.origin}/#/report/report-secret`
);
```

Test that the page labels both links as secrets and warns that access values cannot be recovered after leaving the creation result.

- [ ] **Step 3: Run client tests and verify failure**

Run: `npm test -- src/routing.test.ts src/pages/AdminPage.test.tsx`

Expected: FAIL because routing, API client, and page modules do not exist.

- [ ] **Step 4: Implement route parsing and typed API calls**

`parseHashRoute` splits the decoded hash after removing `#/`. `src/api.ts` defines `ApiError` and these functions:

```ts
login(passphrase: string): Promise<void>
logout(): Promise<void>
listMeetings(): Promise<AdminMeeting[]>
createMeeting(input: CreateMeetingInput): Promise<{ meeting: AdminMeeting; surveyAccess: string; reportAccess: string }>
setMeetingStatus(id: string, status: "open" | "closed"): Promise<AdminMeeting>
getSurvey(access: string): Promise<SurveyContext>
submitSurvey(access: string, answers: SurveyAnswers): Promise<{ status: "recorded" }>
getReport(access: string): Promise<ReportView>
```

All requests use same-origin relative URLs and `credentials: "same-origin"`. Survey and report access values go in their dedicated headers, never in query strings or request URLs.

Add these client view models to `src/types.ts`:

```ts
export type AdminMeeting = {
  id: string;
  title: string;
  chairLabel: string;
  meetingAt: string;
  invitedCount: number;
  status: "open" | "closed";
};
export type CreateMeetingInput = Omit<AdminMeeting, "id" | "status">;
export type SurveyContext = Pick<AdminMeeting, "id" | "title" | "chairLabel" | "meetingAt" | "status">;
export type CompleteReportView = {
  status: "complete";
  meeting: Pick<AdminMeeting, "title" | "chairLabel" | "meetingAt" | "status">;
  responseCount: number;
  invitedCount: number;
  responseRate: number;
  valueScore: number;
  questions: Array<{
    id: RatingQuestionId;
    prompt: string;
    average: number;
    distribution: Array<{ rating: 1 | 2 | 3 | 4 | 5; count: number }>;
  }>;
  comments: string[];
};
export type ReportView =
  | { status: "threshold_not_met"; minimumResponses: 3 }
  | CompleteReportView;
```

- [ ] **Step 5: Implement the administration page and route composition**

The page first shows a passphrase form. After login it lists meetings and provides a create form with title, chair label, `datetime-local`, and invited count. On creation, construct both hash links using `window.location.origin` and `encodeURIComponent(access)`.

Replace the static mode switch in `App.tsx` with hash-route composition. `App` listens for `hashchange`, renders `AdminPage`, `SurveyPage`, or `ReportPage`, and renders a concise not-found page for invalid hashes. Do not add React Router.

- [ ] **Step 6: Run route and administrator tests**

Run: `npm test -- src/routing.test.ts src/pages/AdminPage.test.tsx src/App.test.tsx`

Expected: all tests pass and existing unrelated frontend edits remain preserved or intentionally adapted.

- [ ] **Step 7: Commit client routing and administration**

```powershell
git add src/routing.ts src/routing.test.ts src/api.ts src/pages/AdminPage.tsx src/pages/AdminPage.test.tsx src/App.tsx src/App.test.tsx src/types.ts src/styles.css
git commit -m "feat: add hosted test meeting administration"
```

---

### Task 7: Connect the attendee survey to live persistence

**Files:**
- Create: `src/components/RatingField.tsx`
- Create: `src/pages/SurveyPage.tsx`
- Create: `src/pages/SurveyPage.test.tsx`
- Modify: `src/validation.ts`
- Modify: `src/validation.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `getSurvey(access)` and `submitSurvey(access, answers)`.
- Produces: a persisted confirmation state; it does not offer “Edit response” because editing would create another anonymous row.
- Preserves accessible fieldsets, native radio inputs, focus-on-first-error behavior, and optional comment warning.

- [ ] **Step 1: Extend failing validation tests**

Add assertions that ratings `0`, `6`, and non-integers are invalid and a comment over 1,000 characters returns `comment: "Keep the comment to 1,000 characters or fewer."`. Keep the existing required-rating tests.

- [ ] **Step 2: Write failing connected survey tests**

Mock `getSurvey` and `submitSurvey`. Test loading, invalid link, closed survey, required fields, successful API submission, retry after a `503`, and the privacy warning. The success test must assert the exact API payload and confirmation:

```ts
expect(submitSurvey).toHaveBeenCalledWith("survey-secret", {
  usefulness: 4,
  actionability: 5,
  reInvite: 3,
  comment: "End with a decision recap."
});
expect(await screen.findByRole("heading", { name: "Feedback received" })).toBeInTheDocument();
expect(screen.queryByRole("button", { name: "Edit response" })).not.toBeInTheDocument();
```

- [ ] **Step 3: Run the connected survey tests and verify failure**

Run: `npm test -- src/validation.test.ts src/pages/SurveyPage.test.tsx`

Expected: FAIL on range/comment validation and missing page components.

- [ ] **Step 4: Implement shared validation and rating control**

Update `validateSurvey` to reject non-integer/out-of-range values and comments longer than 1,000 characters. Extract the existing star-radio fieldset into `RatingField.tsx` with props `{ id, prompt, value, error, onChange, fieldRef }`.

- [ ] **Step 5: Implement survey loading, submission, and retry**

`SurveyPage` loads meeting context using the hash access value. While submitting, disable the submit button and label it “Saving feedback…”. On `ApiError`, preserve answers and show the server-safe error. On success, replace the form with a confirmation that says the response was stored anonymously.

Show this comment warning adjacent to the textarea:

```text
Do not include names or confidential meeting content. Your wording or context may still identify you.
```

- [ ] **Step 6: Run survey UI and server-route tests together**

Run: `npm test -- src/validation.test.ts src/pages/SurveyPage.test.tsx server/routes/survey.test.ts`

Expected: all validation, UI, and persistence-contract tests pass.

- [ ] **Step 7: Commit the connected attendee flow**

```powershell
git add src/components/RatingField.tsx src/pages/SurveyPage.tsx src/pages/SurveyPage.test.tsx src/validation.ts src/validation.test.ts src/styles.css
git commit -m "feat: connect attendee survey to persistence"
```

---

### Task 8: Connect live reporting and survey status controls

**Files:**
- Create: `src/pages/ReportPage.tsx`
- Create: `src/pages/ReportPage.test.tsx`
- Modify: `src/pages/AdminPage.tsx`
- Modify: `src/pages/AdminPage.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `getReport(access)` and `setMeetingStatus(id, status)`.
- Produces: threshold-only, complete-report, invalid-link, and retry states.
- Renders only API aggregate view models; it has no raw-response type.

- [ ] **Step 1: Write failing threshold and complete-report tests**

For the threshold response, assert only the threshold notice appears and none of “Responses”, “Meeting Value Score”, “Anonymous comments”, or a response count appears.

For a complete response, provide fixed data and assert the UI renders `3 of 5`, `60%`, `3.78 / 5`, all three averages, all fifteen distribution counts, and two comments.

- [ ] **Step 2: Write failing close/reopen UI tests**

In `AdminPage.test.tsx`, return one open and one closed meeting from `listMeetings`. Assert “Close survey” calls `setMeetingStatus(openId, "closed")`, “Reopen survey” calls `setMeetingStatus(closedId, "open")`, and the visible status updates after the mocked promise resolves.

- [ ] **Step 3: Run report and status tests and verify failure**

Run: `npm test -- src/pages/ReportPage.test.tsx src/pages/AdminPage.test.tsx`

Expected: FAIL because `ReportPage` and status controls are not implemented.

- [ ] **Step 4: Implement live chair reporting**

Render these states explicitly:

- loading: “Loading report…”;
- invalid secret: “This report link is invalid.”;
- threshold: “Results will appear after at least 3 anonymous responses.”;
- complete: response count/rate, value score, three averages, 1–5 distributions, and anonymous comments;
- transient error: error message plus “Try again”.

Remove all imports of static `reportData` from the application path. Keep fictional fixtures only inside tests.

- [ ] **Step 5: Implement close/reopen controls**

Render a status pill and one action per meeting. Disable the action while saving and restore the prior status if the API fails. Do not show survey/report hashes in the meeting list because the API does not return them.

- [ ] **Step 6: Run the full client test suite and build**

Run: `npm test -- src && npm run build`

Expected: all client tests pass and the production build succeeds.

- [ ] **Step 7: Commit live reporting and status controls**

```powershell
git add src/pages/ReportPage.tsx src/pages/ReportPage.test.tsx src/pages/AdminPage.tsx src/pages/AdminPage.test.tsx src/styles.css
git commit -m "feat: add live chair report and survey controls"
```

---

### Task 9: Add full-flow verification and temporary deployment

**Files:**
- Create: `server/full-flow.test.ts`
- Create: `render.yaml`
- Create: `README.md`
- Modify: `server/app.ts`
- Modify: `package.json`

**Interfaces:**
- Verifies the complete admin → shared survey → thresholded report → close flow against pg-mem.
- Produces one Render web service and one free Render PostgreSQL database.
- Serves the built React application and API from the same HTTPS origin.

- [ ] **Step 1: Write the failing full-flow integration test**

Use only HTTP injection after arranging repositories and config. The test must:

1. log in as administrator;
2. create a meeting with five invitees;
3. retrieve the report and receive only the threshold object;
4. submit three distinct answer sets through the same survey secret;
5. retrieve and assert the exact report calculations from Task 5;
6. close the survey through the administrator route;
7. verify a fourth submission returns `409`;
8. query `responses` directly and confirm three durable rows and no identity columns.

- [ ] **Step 2: Run the full-flow test and verify any missing static-host behavior**

Run: `npm test -- server/full-flow.test.ts`

Expected before static hosting is added: API assertions pass; a final injected `GET /` assertion fails because the built client is not served by Fastify.

- [ ] **Step 3: Serve the Vite build from Fastify**

Add `staticRoot?: string` to `BuildAppOptions`. When provided, register `@fastify/static` with that directory; production passes `path.resolve(process.cwd(), "dist/client")`. Return `index.html` for non-API browser paths and never apply the fallback to `/api/*`. In the integration test, create a temporary directory containing a minimal `index.html`, pass it as `staticRoot`, assert `GET /` returns that HTML, and remove the directory during teardown. Keep secrets in the hash so Fastify receives `/`, not the survey/report access value.

- [ ] **Step 4: Add a Render Blueprint**

Create `render.yaml`:

```yaml
services:
  - type: web
    name: meeting-feedback-mvp
    runtime: node
    plan: free
    buildCommand: npm ci && npm run build
    preDeployCommand: npm run migrate
    startCommand: npm start
    healthCheckPath: /api/health
    autoDeployTrigger: checksPass
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: meeting-feedback-db
          property: connectionString
      - key: ADMIN_PASSPHRASE
        sync: false
      - key: SESSION_SECRET
        generateValue: true

databases:
  - name: meeting-feedback-db
    plan: free
    databaseName: meeting_feedback
    user: meeting_feedback_app
```

Render gives the service a temporary `onrender.com` HTTPS URL. Record in the README that the free PostgreSQL database expires after 30 days and has no backups, so it is suitable only for this MVP test.

- [ ] **Step 5: Document exact local and deployment verification**

The README must include:

```text
npm install
npm test
npm run build
npm run migrate
npm run dev
```

Document required environment variables, hash-route formats, the three-response threshold, shared-link duplicate limitation, no identity storage, and the Render Blueprint steps: push the repository to an approved Git provider, create a Blueprint from `render.yaml`, enter `ADMIN_PASSPHRASE` when prompted, wait for health checks, and open `https://<assigned-service>.onrender.com/#/admin`.

- [ ] **Step 6: Run final automated verification**

Run:

```powershell
npm test
npm run build
git diff --check
git status --short
```

Expected: all tests pass, the build succeeds, no whitespace errors appear, and status contains only intended files plus any pre-existing user changes.

- [ ] **Step 7: Deploy and browser-smoke-test the public URL**

After the user authorizes deployment and supplies access to the chosen Git/Render accounts, deploy the Blueprint. At the assigned HTTPS URL:

1. log into `/#/admin`;
2. create a meeting with invited count `5`;
3. copy the shared survey and private report links;
4. confirm the report hides all values before three responses;
5. submit ratings `(5,4,3)`, `(4,4,5)`, and `(3,2,4)` through the shared survey link;
6. reload the report and verify `3 of 5`, `60%`, and Meeting Value Score `3.78 / 5`;
7. close the survey in administration;
8. confirm another submission is rejected as closed;
9. restart/redeploy the web service and confirm the report still contains the three PostgreSQL-backed responses;
10. repeat survey and report checks at a narrow mobile viewport.

- [ ] **Step 8: Commit deployment and documentation**

```powershell
git add server/full-flow.test.ts server/app.ts render.yaml README.md package.json package-lock.json
git commit -m "docs: add temporary MVP deployment and verification"
```

---

## Final verification gate

Before declaring the MVP complete, confirm all of the following:

- `npm test` passes without skipped privacy or persistence tests.
- `npm run build` produces `dist/client` and `dist/server`.
- The deployed `/api/health` returns only `{ "status": "ok" }`.
- Three shared-link submissions survive a service restart.
- The below-threshold report never exposes a precise response count.
- No response database column or API payload contains identity data.
- No access secret appears in PostgreSQL, browser request URLs, server logs, or report payloads.
- The administrator can create, close, and reopen meetings.
- The chair report calculates exact averages, distributions, response rate, and value score.
- The public deployment uses HTTPS and the production administrator cookie is secure and HTTP-only.
- The README clearly labels Render free PostgreSQL as temporary, expiring after 30 days, and not backed up.
