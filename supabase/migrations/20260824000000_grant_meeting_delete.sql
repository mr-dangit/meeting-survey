-- The delete button failed on Supabase: meeting_app was never granted delete, so
-- `delete from meetings` raised "permission denied for table meetings" and the API answered 500.
-- The responses grant is for symmetry; the meetings cascade itself runs with the table owner's rights.
grant delete on table public.meetings to meeting_app;
grant delete on table public.responses to meeting_app;
