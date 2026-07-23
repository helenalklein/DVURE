-- One more test account: a model with a real login, for verifying the
-- model role end to end (0003_seed.sql's Zara Okafor has no auth.users
-- row). Deliberately a NEW model rather than backfilling Zara — Zara's
-- only real submission slot on the AW25 campaign is already consumed by
-- the unique (campaign_id, model_id) constraint, so reusing her would
-- only let you re-test the rejection path, never a fresh successful
-- submission. Nora gives Elite (her mother agency) a model nobody has
-- submitted yet.
--
-- Unlike 0003_seed.sql's accounts, this insert runs AFTER
-- 0004_auth_provisioning.sql's handle_new_user() trigger already exists,
-- and a trigger fires on ANY insert into auth.users, direct SQL included
-- — session_replication_role = replica (tried first) needs superuser,
-- which Supabase's hosted SQL Editor role doesn't have, and errored the
-- same way. So instead this gives the trigger what it's designed to
-- want: raw_user_meta_data with a role key, which makes it create the
-- profiles row itself (see 0004's first branch) — the manual `insert
-- into profiles` from the original version of this file is removed
-- below since the trigger now does that step.

do $$
declare
  v_nora uuid := gen_random_uuid();
  v_elite_id uuid;
  v_nora_model_id uuid;
begin
  select id into v_elite_id from organizations where name = 'Elite Model Mgmt.';

  -- Every one of these token columns is nullable with no default, but
  -- GoTrue's password-grant flow scans them into non-nullable Go string
  -- fields — a NULL here surfaces as an opaque 500 "Database error
  -- querying schema" rather than any clearer error. Setting them all to
  -- '' (not just confirmation_token, which 0003_seed.sql only did
  -- partially) avoids that for this seeded account.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_nora, 'authenticated', 'authenticated',
    'nora@elitetalent.example', crypt('placeholder-test-pw', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}',
    '{"role":"model","full_name":"Nora Kim"}', false,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_nora::text, v_nora, jsonb_build_object('sub', v_nora::text, 'email', 'nora@elitetalent.example'), 'email', now(), now(), now());

  -- profiles row is created by handle_new_user() off raw_user_meta_data
  -- above, not inserted manually here (that would now violate the
  -- primary key — the trigger already created it in this same statement).

  insert into model_profiles (profile_id, full_name, location, default_day_rate, height, experience)
  values (v_nora, 'Nora Kim', 'Los Angeles, CA', 850, '5''9"', '3 yrs')
  returning id into v_nora_model_id;

  insert into agency_model_relationships (model_id, agency_org_id, relationship_type)
  values (v_nora_model_id, v_elite_id, 'mother');

  raise notice 'Model test login added: nora@elitetalent.example (password: placeholder-test-pw)';
end $$;
