alter table public.meetings add column if not exists survey_secret text;
alter table public.meetings add column if not exists report_secret text;
