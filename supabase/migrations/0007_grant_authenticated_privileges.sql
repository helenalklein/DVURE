-- Fixes a second real bug found while verifying real sign-in: 0002_rls.sql
-- enabled RLS and wrote policies for every table, but never GRANTed the
-- underlying table privileges to the `authenticated` role. RLS policies
-- only restrict which ROWS a role can see/touch once it already has base
-- access to the table — they don't substitute for GRANT. Because every
-- table here was created via raw SQL in the SQL Editor (no Supabase CLI
-- available), none of them got the standard baseline grant Supabase's
-- own Table Editor adds automatically for new tables. Confirmed via a
-- direct authenticated request to /rest/v1/profiles: 403 "permission
-- denied for table profiles... GRANT SELECT ON public.profiles TO
-- authenticated" — Postgres's own error message names the exact fix.
--
-- Granting full CRUD here is safe: RLS policies (0002_rls.sql) already
-- precisely define which rows each action is actually allowed to touch,
-- so a broad table-level grant doesn't widen what any user can really
-- do — it just lets the already-written policies take effect at all.
-- `anon` is deliberately left with no grants — nothing in this app's
-- design expects unauthenticated table access, RLS or not.

grant select, insert, update, delete on
  profiles,
  organizations,
  org_memberships,
  model_profiles,
  agency_model_relationships,
  brand_agency_partnerships,
  runway_shows,
  campaigns,
  campaign_agency_distributions,
  campaign_submission_extensions,
  campaign_submission_extension_agencies,
  submissions,
  submission_comments,
  casting_entries,
  crew_members,
  looks,
  bookings,
  invites
to authenticated;

-- profiles already has its own tighter column-level grant from
-- 0002_rls.sql (revoke update on profiles from authenticated; grant
-- update (full_name, phone) on profiles to authenticated;) — re-apply it
-- after the blanket grant above so it isn't clobbered back to full-row
-- update access.
revoke update on profiles from authenticated;
grant update (full_name, phone) on profiles to authenticated;
