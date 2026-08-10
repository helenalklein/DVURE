-- Real, brand/agency-uploaded logo, replacing the plain initial-letter
-- box in both sidebars. Stored as a data URI directly on the row rather
-- than in Supabase Storage -- same pattern this project already uses for
-- model headshots (model_profiles.photo_url), and a logo is small enough
-- that a dedicated bucket + storage policies would be more machinery
-- than the problem needs right now.
alter table organizations add column logo_url text;

-- organizations_update (0019) column-GRANTs only 'name' to a self-editing
-- admin, closing a real self-escalation gap (an org could otherwise PATCH
-- its own verification_status/subscription_status/etc.) -- logo_url is
-- exactly the same kind of harmless, legitimate self-edit 'name' already
-- is, so it's added to that same grant rather than reopening the column
-- restriction generally. Row access is still gated by organizations_update's
-- existing RLS (id = my_org_id() and my_access_level() = 'administrator'),
-- unchanged.
grant update (logo_url) on organizations to authenticated;
