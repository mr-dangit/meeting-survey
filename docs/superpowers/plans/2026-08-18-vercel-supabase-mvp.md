# Vercel + Supabase Meeting Feedback MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the existing meeting-feedback MVP on Vercel with durable storage in the existing Supabase `meeting-survey` project.

**Architecture:** Keep React/Vite, Fastify, and the existing PostgreSQL repositories. Add one catch-all Vercel Node Function that forwards Node request/response objects to a module-cached Fastify instance, use Supabase's transaction pooler for runtime traffic, and commit/apply one locked-down Supabase migration.

**Tech Stack:** React 18, Vite 5, Fastify 5, Node.js 22, node-postgres 8, Supabase Postgres 17, Vercel Functions, Vitest 2

**Spec:** `docs/superpowers/specs/2026-08-18-vercel-supabase-mvp-design.md`

## Global Constraints

- Preserve the current administrator passphrase, anonymous survey/report links, secret hashing, three-response privacy threshold, and API contracts.
- Do not add Next.js, Supabase Auth, Supabase browser clients, Edge Functions, email, or Microsoft 365 integration.
- Runtime traffic uses the Supabase transaction-pooler URL in `DATABASE_URL`; migrations use `MIGRATION_DATABASE_URL`.
- Do not expose Supabase URLs, keys, database credentials, administrator secrets, or cookie secrets to client code, logs, commits, or command output.
- Enable RLS on every application table and grant no Data API access to `anon` or `authenticated`.
- Keep the Vercel function close to the existing `ap-south-1` database by using Vercel region `bom1`.
- Preserve the user's unrelated working-tree change in `src/styles.css`.

---

## File structure

- `server/runtime.ts` — constructs Fastify with PostgreSQL repositories for both local and Vercel runtimes.
- `server/vercel-handler.ts` — caches the production Fastify app and adapts Node HTTP request/response objects.
- `server/vercel-handler.test.ts` — verifies one-time initialization and request forwarding.
- `api/[...path].ts` — Vercel's catch-all `/api/*` entrypoint.
- `server/db/pool.ts` — creates a small serverless-safe `pg` pool.
- `server/db/pool.test.ts` — verifies the pool's connection cap without opening a network connection.
- `server/db/migrate-cli.ts` — prefers the migration-only database URL.
- `server/db/migrate-cli.test.ts` — proves the migration URL takes precedence.
- `supabase/migrations/20260818000000_vercel_supabase_mvp_schema.sql` — committed schema, RLS, and privilege migration.
- `vercel.json` — Vite output, Node Function region, and function limits.
- `.env.example` and `README.md` — exact local/deployment configuration and verification instructions.

---

### Task 1: Add the Vercel Fastify runtime

**Files:**
- Create: `server/runtime.ts`
- Create: `server/vercel-handler.ts`
- Create: `server/vercel-handler.test.ts`
- Create: `api/[...path].ts`
- Modify: `server/index.ts`
- Modify: `server/db/pool.ts`
- Create: `server/db/pool.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.server.json`

**Interfaces:**
- Produces: `buildRuntime(config: AppConfig, pool: DbPool, staticRoot?: string): Promise<FastifyInstance>`.
- Produces: `createVercelHandler(loadApp?: () => Promise<FastifyInstance>): (request: IncomingMessage, response: ServerResponse) => Promise<void>`.
- Produces: `createPool(connectionString: string, options?: { max?: number }): DbPool` with a default maximum of `1` connection.
- Consumes: existing `buildApp`, `PostgresMeetingRepository`, and `PostgresResponseRepository`.

- [ ] **Step 1: Write failing pool and handler tests**

Create `server/db/pool.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createPool } from "./pool.js";

describe("createPool", () => {
  it("limits each serverless instance to one database connection by default", async () => {
    const pool = createPool("postgresql://127.0.0.1:1/postgres") as { options: { max: number }; end(): Promise<void> };
    expect(pool.options.max).toBe(1);
    await pool.end();
  });
});
```

Create `server/vercel-handler.test.ts` with a fake Fastify server emitter. Call the produced handler twice and assert the loader runs once, `ready()` runs once, and `server.emit("request", request, response)` runs twice.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm test -- server/db/pool.test.ts server/vercel-handler.test.ts`

Expected: FAIL because the pool ignores `max` and the handler module does not exist.

- [ ] **Step 3: Implement the runtime and adapter**

Implement `server/runtime.ts` by constructing the two PostgreSQL repositories and calling the existing `buildApp`. Implement `server/vercel-handler.ts` with a module-scoped promise:

```ts
let appPromise: Promise<FastifyInstance> | undefined;

export function createVercelHandler(loadApp = loadProductionApp) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    appPromise ??= loadApp().then(async (app) => {
      await app.ready();
      return app;
    });
    const app = await appPromise;
    app.server.emit("request", request, response);
  };
}
```

`loadProductionApp` loads validated environment configuration, creates a pool with `max: 1`, and calls `buildRuntime`. Do not attach an `onClose` hook in Vercel; warm instances reuse the pool until the platform retires them.

Change `server/index.ts` to import `node:path`, call `buildRuntime`, attach the pool close hook for the long-running local server, and keep static hosting only in that local/legacy runtime.

Create `api/[...path].ts`:

```ts
import { createVercelHandler } from "../server/vercel-handler.js";

export default createVercelHandler();
```

Set `package.json.engines.node` to `22.x`. Include both `server/**/*.ts` and `api/**/*.ts` in `tsconfig.server.json`.

- [ ] **Step 4: Run focused and full local verification**

Run: `npm test -- server/db/pool.test.ts server/vercel-handler.test.ts server/app.test.ts server/full-flow.test.ts`

Run: `npm run build`

Expected: all selected tests pass and the Vite/tsup build succeeds.

- [ ] **Step 5: Commit the Vercel runtime**

```powershell
git add -- package.json server/runtime.ts server/vercel-handler.ts server/vercel-handler.test.ts 'api/[...path].ts' server/index.ts server/db/pool.ts server/db/pool.test.ts tsconfig.server.json
git commit -m "feat: run meeting API on Vercel Functions"
```

---

### Task 2: Add and apply the locked-down Supabase schema

**Files:**
- Create via Supabase CLI, then rename to: `supabase/migrations/20260818000000_vercel_supabase_mvp_schema.sql`
- Modify: `server/db/migrate-cli.ts`
- Modify: `server/db/migrate-cli.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `MIGRATION_DATABASE_URL`, falling back to `DATABASE_URL` only for existing local workflows.
- Produces: `public.meetings`, `public.responses`, and `public.schema_migrations` with constraints, index, RLS enabled, and no `anon`/`authenticated` privileges.

- [ ] **Step 1: Write the failing migration URL test**

Extend `server/db/migrate-cli.test.ts` with `DATABASE_URL` pointing at port `1` and `MIGRATION_DATABASE_URL` pointing at port `2`. Assert the emitted CLI failure mentions `127.0.0.1:2`, proving the migration-only URL was selected.

- [ ] **Step 2: Run the migration CLI test and confirm failure**

Run: `npm test -- server/db/migrate-cli.test.ts`

Expected: FAIL because the CLI still connects to `DATABASE_URL` on port `1`.

- [ ] **Step 3: Implement migration URL selection**

In `server/db/migrate-cli.ts`, use:

```ts
const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL ?? config.databaseUrl;
const pool = createPool(migrationDatabaseUrl, { max: 1 });
```

Add `MIGRATION_DATABASE_URL` to `.env.example` and label `DATABASE_URL` as the transaction-pooler connection in comments.

- [ ] **Step 4: Create the Supabase migration through the CLI**

Run `npx supabase@latest migration new vercel_supabase_mvp_schema`, then rename the generated file to the exact planned path with PowerShell `Move-Item -LiteralPath`. Populate it with the existing table definitions and index from `server/db/migrations.ts`, followed by:

```sql
alter table public.meetings enable row level security;
alter table public.responses enable row level security;
alter table public.schema_migrations enable row level security;

revoke all on table public.meetings from anon, authenticated;
revoke all on table public.responses from anon, authenticated;
revoke all on table public.schema_migrations from anon, authenticated;
```

Do not create Data API policies. Keep all constraints and the `responses_meeting_id_idx` index identical to the tested application migration.

- [ ] **Step 5: Run local migration verification**

Run: `npm test -- server/db/migrate-cli.test.ts server/db/postgres-repositories.test.ts server/full-flow.test.ts`

Expected: all tests pass.

- [ ] **Step 6: Apply and inspect the remote migration**

Use the Supabase connector's migration operation once against project `taedpmoumdrfvqqvjfed`, using the committed SQL and migration name `vercel_supabase_mvp_schema`. Then list `public` tables with verbose metadata and run a read-only SQL query against `pg_class` and `pg_policies` to confirm all three tables have RLS enabled and zero policies.

Run both Supabase security and performance advisors. Fix blocking findings in the local migration and remote project; record any informational/non-blocking notices.

- [ ] **Step 7: Commit the Supabase migration**

```powershell
git add -- .env.example server/db/migrate-cli.ts server/db/migrate-cli.test.ts supabase/migrations/20260818000000_vercel_supabase_mvp_schema.sql
git commit -m "feat: provision meeting schema on Supabase"
```

---

### Task 3: Configure, deploy, and smoke-test Vercel

**Files:**
- Create: `vercel.json`
- Modify: `README.md`
- Delete after successful Vercel verification: `render.yaml`

**Interfaces:**
- Consumes Vercel secrets: `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `ADMIN_PASSPHRASE`, and `SESSION_SECRET`.
- Produces: one Vercel Vite project with `/api/*` handled by `api/[...path].ts` in region `bom1`.

- [ ] **Step 1: Add Vercel configuration**

Create `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist/client",
  "regions": ["bom1"],
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

No SPA rewrite is required because the application uses URL fragments and all browser document requests resolve to `/`.

- [ ] **Step 2: Update deployment documentation**

Replace Render instructions in `README.md` with the Vercel + Supabase architecture, exact environment variable names, `npx vercel link`, `npx vercel env pull .env.local`, test/build commands, migration command, deploy command, and privacy limitations. Do not include real values.

- [ ] **Step 3: Run the complete pre-deployment gate**

Run:

```powershell
npm test
npm run build
git diff --check
git status --short
```

Expected: every test passes, the build succeeds, no whitespace errors appear, and `src/styles.css` remains the only unrelated user change.

- [ ] **Step 4: Link or create the Vercel project**

Run `npx vercel@latest whoami`, inspect teams with `npx vercel@latest teams ls`, and inspect candidate projects before linking. Reuse a matching meeting-survey project if one exists; otherwise create/link a project named `meeting-survey` in the authenticated team. Confirm `.vercel/project.json` matches the chosen project.

- [ ] **Step 5: Configure secrets without printing values**

Use the Supabase dashboard's transaction-pooler URI for `DATABASE_URL` and direct/session URI for `MIGRATION_DATABASE_URL`. Add both plus `ADMIN_PASSPHRASE` and `SESSION_SECRET` to Vercel Development, Preview, and Production through stdin or dashboard entry. Run `npx vercel@latest env ls` and compare names only against `.env.example`.

- [ ] **Step 6: Deploy and verify the live MVP**

Run `npx vercel@latest --prod`. At the returned HTTPS URL:

1. verify `/api/health` returns only `{ "status": "ok" }`;
2. log into `/#/admin` and create a meeting with invited count `5`;
3. verify the report hides values before three responses;
4. submit `(5,4,3)`, `(4,4,5)`, and `(3,2,4)` through the shared survey link;
5. verify the report shows `3 of 5`, `60%`, and Meeting Value Score `3.78 / 5`;
6. close the survey and verify a fourth response is rejected;
7. redeploy and verify the report still contains the three Supabase-backed responses.

- [ ] **Step 7: Remove Render configuration and commit deployment files**

Only after the live checks pass, delete `render.yaml` and commit:

```powershell
git add -- vercel.json README.md render.yaml
git commit -m "docs: deploy meeting feedback MVP on Vercel"
```

- [ ] **Step 8: Record final verification**

Re-run `npm test`, `npm run build`, `git diff --check`, and Supabase advisors. Report the Vercel URL, linked project, Supabase project ref, migration state, advisor findings, and the preserved `src/styles.css` change without revealing secrets.
