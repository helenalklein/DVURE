-- Found live-testing the roster archive feature (0091): archiving a
-- model (end_representation_relationship -> status='inactive') made
-- them silently disappear entirely, not just drop off the active
-- roster. Confirmed directly: querying agency_model_relationships
-- filtered to status='inactive' correctly returns the row, but its
-- embedded model_profiles join comes back null -- model_profiles' own
-- existing select policy only grants visibility through an ACTIVE
-- relationship, so an inactive one reads as if the model doesn't exist
-- at all. That defeats the entire point of archiving ("you can still
-- see them under Archived") -- right now it's actually a black hole.
--
-- Additive, not a replacement: multiple permissive policies on the same
-- command combine with OR in Postgres RLS, so this only WIDENS
-- visibility (an org that ever had a relationship, active or not, can
-- still read the model's basic profile) -- it can't accidentally
-- narrow whatever the existing active-relationship policy already
-- allows, and a brand/other agency with no relationship at all still
-- sees nothing new.
create policy model_profiles_select_any_agency_relationship on model_profiles for select using (
  exists (
    select 1 from agency_model_relationships
    where model_id = model_profiles.id and agency_org_id = my_org_id()
  )
);
