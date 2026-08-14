-- Removes leftover accounts from earlier ad hoc QA/verification passes —
-- none seeded with a known password (created live through the real
-- signup/accept-invite forms, so nobody can log into them intentionally
-- anymore), none attached to an org, model, or working crew grant. auth
-- deletes here cascade to profiles/org_memberships (confdeltype 'c') and
-- set model_profiles.profile_id / crew_payees.profile_id to null
-- (confdeltype 'n') rather than blocking — confirmed none of the "model"
-- role rows here still have a model_profiles row at all (that data was
-- already gone from the earlier full roster wipe; only the orphaned
-- login survived it).
--
-- demo.crew@dvure-test.example (crew_payees "Jordan Ives") is one of
-- these — seeded by 0024_crew_persistent_login.sql without a password by
-- design ("set a password via /accept-invite"), and whoever did that at
-- some point chose a password nobody now knows. His crew_payees row is
-- also removed below (cascades his one pending invite) rather than
-- reused, since he has zero campaign_guest_access grants and zero call
-- sheet assignments — nothing to preserve.
--
-- The crew demo account below, "Riley Chen," was originally built by
-- finishing a record that already half-existed live (she was already
-- the Photography department lead on the real AW25 Womenswear Campaign
-- call sheet, just missing a discipline and a login) — but that
-- crew_payees row and its call sheet assignment were themselves created
-- by someone actually using the app's Call Sheet UI, not by any
-- migration, so 0027_schema_baseline's fresh rebuild has nothing to
-- find. Creates her and her two AW25 call sheet slots explicitly here
-- instead, matching what's live today. Both parts run as one DO block —
-- this database is only reachable via `supabase db query`, which
-- rejects multi-statement input.
do $$
declare
  v_riley_id uuid;
  v_uid uuid;
  v_marcus uuid;
  v_aw25_id uuid;
  v_holiday_id uuid;
begin
  delete from auth.users where email in (
    'seedtest@dvure-test.example',
    'seedtest-1722200000@dvure-test.example',
    'qa-verify2@dvure-test.example',
    'audit-check-1785471325540@dvure-test.example',
    'taxonomy-check-1785357123860@dvure-test.example',
    'dvure.test.signup.verify4@gmail.com',
    'dvure.verify.fresh5@gmail.com',
    'demo.crew@dvure-test.example',
    'nora@elitetalent.example',
    'zara.okafor@example.com',
    'sasha.kowalczyk@independent.example',
    'noor.al-rashid@independent.example',
    'theo-bergstrom@independent.example'
  );

  delete from crew_payees where email = 'demo.crew@dvure-test.example';

  select id into v_marcus from profiles where email = 'marcus@acnestudios.example';
  select id into v_aw25_id from campaigns where name = 'AW25 Womenswear Campaign';
  select id into v_holiday_id from campaigns where name = 'Holiday 2026 Lookbook';

  insert into crew_payees (email, full_name, discipline)
  values ('riley.chen@example.com', 'Riley Chen', 'photographer')
  returning id into v_riley_id;

  insert into campaign_crew_slots (campaign_id, role_key, crew_payee_id, assigned_by_profile_id, is_department_lead) values
    (v_aw25_id, 'photographer', v_riley_id, v_marcus, true),
    (v_aw25_id, 'creative_director', v_riley_id, v_marcus, false);

  insert into invites (email, role, crew_payee_id, status, expires_at)
  values ('riley.chen@example.com', 'crew', v_riley_id, 'pending', now() + interval '1 year');

  v_uid := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'riley.chen@example.com', crypt('placeholder-test-pw', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', 'Riley Chen'), false,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', 'riley.chen@example.com'), 'email', now(), now(), now());

  -- Active grant on the campaign she's already lead on, plus one expired
  -- grant on a second campaign — same "current vs. history" pairing
  -- 0024's original (now-deleted) demo crew data modeled.
  if v_aw25_id is not null then
    insert into campaign_guest_access (campaign_id, crew_payee_id, access_code, expires_at)
    values (v_aw25_id, v_riley_id, gen_random_uuid(), now() + interval '90 days');
  end if;

  if v_holiday_id is not null then
    insert into campaign_guest_access (campaign_id, crew_payee_id, access_code, expires_at)
    values (v_holiday_id, v_riley_id, gen_random_uuid(), now() - interval '10 days');
  end if;
end $$;
