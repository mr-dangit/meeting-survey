do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'meeting_app') then
    create role meeting_app login noinherit;
  end if;
end
$$;

grant connect on database postgres to meeting_app;
grant usage on schema public to meeting_app;
grant select, insert, update on table public.meetings to meeting_app;
grant select, insert on table public.responses to meeting_app;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'meetings' and policyname = 'meeting_app_access'
  ) then
    create policy meeting_app_access on public.meetings
      for all to meeting_app
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'responses' and policyname = 'meeting_app_access'
  ) then
    create policy meeting_app_access on public.responses
      for all to meeting_app
      using (true)
      with check (true);
  end if;
end
$$;
