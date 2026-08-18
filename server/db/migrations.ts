import type { DbPool } from "../domain/repositories.js";

type Migration = {
  version: number;
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
        re_invite smallint not null check (re_invite between 1 and 5),
        comment varchar(1000) not null default '',
        submitted_at timestamptz not null
      )`,
      "create index if not exists responses_meeting_id_idx on responses(meeting_id)"
    ]
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
        for (const statement of migration.statements) {
          await client.query(statement);
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
