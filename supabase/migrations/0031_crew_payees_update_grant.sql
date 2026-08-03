-- Bug in 0028: it added the crew_payees_update_self RLS policy but
-- never granted UPDATE on the table itself — Postgres requires both
-- independently, a permissive RLS policy alone doesn't imply the
-- table-level privilege. Confirmed live: the Profile tab's save
-- silently failed with "permission denied for table crew_payees"
-- (42501), and since that's a real PostgREST error (not a thrown JS
-- exception), Promise.all in ProfileTab.save() still resolved and
-- would have shown the error — reproduced directly against PostgREST
-- to isolate it from anything client-side.
grant update on crew_payees to authenticated;
