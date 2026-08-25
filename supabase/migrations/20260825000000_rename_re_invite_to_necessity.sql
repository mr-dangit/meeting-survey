-- The third rating question changed from "would you want to be invited again" to "how necessary
-- was this meeting", so the column it lands in is renamed to match the new meaning.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'responses' and column_name = 're_invite'
  ) then
    alter table public.responses rename column re_invite to necessity;
  end if;

  if exists (
    select 1 from pg_constraint where conname = 'responses_re_invite_check'
  ) then
    alter table public.responses rename constraint responses_re_invite_check to responses_necessity_check;
  end if;
end $$;
