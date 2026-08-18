create table if not exists public.schema_migrations (
  version integer primary key
);

create table if not exists public.meetings (
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

create table if not exists public.responses (
  id uuid primary key,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  usefulness smallint not null check (usefulness between 1 and 5),
  actionability smallint not null check (actionability between 1 and 5),
  re_invite smallint not null check (re_invite between 1 and 5),
  comment varchar(1000) not null default '',
  submitted_at timestamptz not null
);

create index if not exists responses_meeting_id_idx on public.responses(meeting_id);

alter table public.meetings enable row level security;
alter table public.responses enable row level security;
alter table public.schema_migrations enable row level security;

revoke all on table public.meetings from anon, authenticated;
revoke all on table public.responses from anon, authenticated;
revoke all on table public.schema_migrations from anon, authenticated;
