-- Fixes a real bug found while verifying real Supabase Auth sign-in:
-- 0003_seed.sql inserted directly into auth.users and only set
-- confirmation_token to '' — several other token/text columns
-- (recovery_token, email_change*, phone_change*, reauthentication_token)
-- were left NULL. Those columns are nullable with no default, but
-- GoTrue's password-grant flow scans them into non-nullable Go string
-- fields, so a NULL there breaks the login query for these accounts —
-- surfaced as an opaque 500 "Database error querying schema" rather than
-- any clearer error, reproduced directly against POST /auth/v1/token.
-- Backfill the four accounts 0003_seed.sql created so they can actually
-- sign in. 0005_model_test_login.sql sets these columns correctly from
-- the start, so this fix-up is only needed for the pre-existing four.

update auth.users set
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where email in (
  'marcus@acnestudios.example',
  'sophie@elite.example',
  'diana@imgmodels.example',
  'priya@wilhelmina.example'
);
