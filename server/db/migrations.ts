import type { DbPool } from "../domain/repositories.js";

type Migration = {
  version: number;
  // A migration that only fixes up older databases can name a guard: a query returning one boolean
  // row, and the statements run only when it is true. Keeping the condition here rather than in a
  // plpgsql DO block matters because the in-memory Postgres the tests run on has no plpgsql.
  guard?: { sql: string; params?: unknown[] };
  statements: string[];
};

const migrations: Migration[] = [
  {
    version: 1,
    statements: [
      `create table if not exists meetings (
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
      )`,
      `create table if not exists responses (
        id uuid primary key,
        meeting_id uuid not null references meetings(id) on delete cascade,
        usefulness smallint not null check (usefulness between 1 and 5),
        actionability smallint not null check (actionability between 1 and 5),
        necessity smallint not null check (necessity between 1 and 5),
        comment varchar(1000) not null default '',
        submitted_at timestamptz not null
      )`,
      "create index if not exists responses_meeting_id_idx on responses(meeting_id)"
    ]
  },
  {
    version: 2,
    statements: [
      "alter table meetings add column if not exists survey_secret text",
      "alter table meetings add column if not exists report_secret text"
    ]
  },
  {
    // The third question stopped asking about a re-invite and now asks how necessary the meeting
    // was, so its column is renamed to match. Databases created after this change already get the
    // new name from migration 1, hence the guard.
    version: 3,
    guard: {
      sql: `select exists (
        select 1 from information_schema.columns
        where table_name = $1 and column_name = $2
      ) as ok`,
      params: ["responses", "re_invite"]
    },
    statements: ["alter table responses rename column re_invite to necessity"]
  }
];

export async function runMigrations(pool: DbPool): Promise<void> {
  const client = await pool.connect();

  try {
    const migrationTable = await client.query<{ exists: boolean }>(
      `select exists (
        select 1 from information_schema.tables where table_schema = $1 and table_name = $2
      ) as exists`,
      ["public", "schema_migrations"]
    );
    if (!migrationTable.rows[0]?.exists) {
      await client.query("create table schema_migrations (version integer primary key)");
    }
    const applied = await client.query<{ version: number }>("select version from schema_migrations");
    const appliedVersions = new Set(applied.rows.map((migration) => migration.version));

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;

      await client.query("begin");
      try {
        const guard = migration.guard
          ? await client.query<{ ok: boolean }>(migration.guard.sql, migration.guard.params ?? [])
          : null;
        // A guarded migration that has nothing to do still records its version, so it is not
        // re-checked on every start-up.
        if (!guard || guard.rows[0]?.ok) {
          for (const statement of migration.statements) {
            await client.query(statement);
          }
        }
        await client.query("insert into schema_migrations (version) values ($1)", [migration.version]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}
