-- The full demo dataset this app ships with: one brand (Vellani), three
-- agencies each with one staff login, three real campaigns distributed
-- across them, and (in 0028+) twelve models. Originally this migration
-- only trimmed/renamed rows that 0003_seed.sql and organic app usage had
-- already created against the live database — but 0027_schema_baseline
-- rebuilds the schema from scratch with no data at all, and two of the
-- three campaigns ("Holiday 2026 Lookbook", "Winter Editorial 2026")
-- were created by someone actually using the app's real CreateCampaign
-- flow, not by any migration — so a fresh database has nothing to trim
-- or rename. This migration now creates everything explicitly instead,
-- matching the real values pulled from the live database, so a fresh
-- `supabase db reset` reaches the same demo state the live app has today
-- without depending on non-reproducible incidental usage data.
--
-- auth.users/auth.identities live in the auth schema, not public, so
-- 0027_schema_baseline's `drop schema public cascade` doesn't touch
-- them — 0003_seed.sql's four original test accounts (explicitly
-- labeled "TEST ACCOUNTS ONLY... do not treat them as real accounts" in
-- its own comment) would otherwise survive as orphaned rows with no
-- matching profiles, and collide on email with the fresh ones below.
do $$
begin
  delete from auth.users;
end $$;

do $$
declare
  v_vellani_id uuid;
  v_marcus uuid := gen_random_uuid();
  v_meridian_id uuid;
  v_solenne_id uuid;
  v_vantage_id uuid;
  v_diana uuid := gen_random_uuid();
  v_priya uuid := gen_random_uuid();
  v_sophie uuid := gen_random_uuid();
  v_aw25 uuid;
  v_holiday uuid;
  v_winter uuid;
  v_uid uuid;
  v_model_id uuid;
  v_agency_id uuid;
  v_model record;
begin
  -- Brand + staff login
  insert into organizations (org_type, name) values ('brand', 'Vellani') returning id into v_vellani_id;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_marcus, 'authenticated', 'authenticated',
    'marcus@acnestudios.example', crypt('placeholder-test-pw', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}',
    jsonb_build_object('role', 'brand_staff', 'full_name', 'Marcus Webb'), false,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_marcus::text, v_marcus, jsonb_build_object('sub', v_marcus::text, 'email', 'marcus@acnestudios.example'), 'email', now(), now(), now());
  -- handle_new_user() creates the profiles row from raw_user_meta_data.role above.
  insert into org_memberships (profile_id, org_id, title, access_level)
  values (v_marcus, v_vellani_id, 'Brand Director', 'administrator');

  -- Three agencies, each with one real staff login
  insert into organizations (org_type, name) values ('agency', 'Meridian Models') returning id into v_meridian_id;
  insert into organizations (org_type, name) values ('agency', 'Solenne') returning id into v_solenne_id;
  insert into organizations (org_type, name) values ('agency', 'Vantage Model Mgmt.') returning id into v_vantage_id;

  insert into brand_agency_partnerships (brand_org_id, agency_org_id)
  values (v_vellani_id, v_meridian_id), (v_vellani_id, v_solenne_id), (v_vellani_id, v_vantage_id);

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values
    ('00000000-0000-0000-0000-000000000000', v_diana, 'authenticated', 'authenticated', 'diana@meridianmodels.example', crypt('placeholder-test-pw', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('role', 'agency_staff', 'full_name', 'Diana Park'), false, '', '', '', '', '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_priya, 'authenticated', 'authenticated', 'priya@solenne.example', crypt('placeholder-test-pw', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('role', 'agency_staff', 'full_name', 'Priya Sharma'), false, '', '', '', '', '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_sophie, 'authenticated', 'authenticated', 'sophie@vantagemodels.example', crypt('placeholder-test-pw', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('role', 'agency_staff', 'full_name', 'Sophie Chen'), false, '', '', '', '', '', '', '', '');

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) values
    (gen_random_uuid(), v_diana::text, v_diana, jsonb_build_object('sub', v_diana::text, 'email', 'diana@meridianmodels.example'), 'email', now(), now(), now()),
    (gen_random_uuid(), v_priya::text, v_priya, jsonb_build_object('sub', v_priya::text, 'email', 'priya@solenne.example'), 'email', now(), now(), now()),
    (gen_random_uuid(), v_sophie::text, v_sophie, jsonb_build_object('sub', v_sophie::text, 'email', 'sophie@vantagemodels.example'), 'email', now(), now(), now());

  insert into org_memberships (profile_id, org_id, title, access_level) values
    (v_diana, v_meridian_id, 'Agent', 'administrator'),
    (v_priya, v_solenne_id, 'Booking Coordinator', 'administrator'),
    (v_sophie, v_vantage_id, 'Senior Agent', 'administrator');

  -- Three real campaigns, distributed to the agencies (values match what's live today)
  insert into campaigns (brand_org_id, name, type, status, due_date, submission_open, submission_close, talent_needed, budget, created_by_profile_id)
  values (v_vellani_id, 'AW25 Womenswear Campaign', 'Campaign', 'active', '2026-07-22', '2026-06-22', '2026-08-05', 4, 18000, v_marcus)
  returning id into v_aw25;
  insert into campaigns (brand_org_id, name, type, status, due_date, talent_needed, created_by_profile_id)
  values (v_vellani_id, 'Holiday 2026 Lookbook', 'Campaign', 'active', '2026-08-13', 3, v_marcus)
  returning id into v_holiday;
  insert into campaigns (brand_org_id, name, type, status, due_date, submission_open, submission_close, talent_needed, budget, created_by_profile_id)
  values (v_vellani_id, 'Winter Editorial 2026', 'Campaign', 'active', '2026-11-08', '2026-09-01', '2026-10-01', 4, 22000, v_marcus)
  returning id into v_winter;

  insert into campaign_agency_distributions (campaign_id, agency_org_id, invited_by_profile_id) values
    (v_aw25, v_meridian_id, v_marcus), (v_aw25, v_vantage_id, v_marcus),
    (v_holiday, v_meridian_id, v_marcus), (v_holiday, v_solenne_id, v_marcus), (v_holiday, v_vantage_id, v_marcus),
    (v_winter, v_meridian_id, v_marcus), (v_winter, v_solenne_id, v_marcus), (v_winter, v_vantage_id, v_marcus);

  -- Twelve models, four per agency, each with a real login
  for v_model in
    select * from (values
      ('meridian', 'Elena Marsh',      'elena.marsh92@example.com',    'New York, NY',     'New York', 950::numeric,  '5''10"', '5 yrs', '1998-03-14'::date, '+1-212-555-0148'),
      ('meridian', 'Jordan Vale',      'jordan.vale@example.com',      'New York, NY',     'New York', 800::numeric,  '6''1"',  '3 yrs', '2000-07-22'::date, '+1-212-555-0172'),
      ('meridian', 'Talia Reyes',      'talia.reyes01@example.com',    'Miami, FL',        'New York', 700::numeric,  '5''9"',  '2 yrs', '2001-11-05'::date, '+1-305-555-0119'),
      ('meridian', 'Owen Blackwood',   'owen.blackwood@example.com',   'New York, NY',     'New York', 1100::numeric, '6''0"',  '7 yrs', '1996-01-30'::date, '+1-212-555-0193'),
      ('solenne',  'Camille Fontaine', 'camille.fontaine@example.com', 'Paris, France',    'Paris',    1200::numeric, '5''11"', '6 yrs', '1997-05-18'::date, '+33-6-55-010147'),
      ('solenne',  'Mateo Rousseau',   'mateo.rousseau@example.com',   'Paris, France',    'Paris',    900::numeric,  '6''2"',  '4 yrs', '1999-09-09'::date, '+33-6-55-010162'),
      ('solenne',  'Ingrid Solberg',   'ingrid.solberg@example.com',   'Milan, Italy',     'Paris',    850::numeric,  '5''10"', '3 yrs', '2000-02-27'::date, '+39-345-555-0110'),
      ('solenne',  'Rafael Duarte',    'rafael.duarte7@example.com',   'Los Angeles, CA',  'Paris',    780::numeric,  '6''0"',  '2 yrs', '2001-06-12'::date, '+1-323-555-0184'),
      ('vantage',  'Freya Ashworth',   'freya.ashworth@example.com',   'London, UK',       'London',   1050::numeric, '5''9"',  '5 yrs', '1998-12-01'::date, '+44-7700-900148'),
      ('vantage',  'Kai Nakamura',     'kai.nakamura@example.com',     'Tokyo, Japan',     'London',   890::numeric,  '5''11"', '4 yrs', '1999-04-23'::date, '+81-90-5550-0173'),
      ('vantage',  'Delphine Moreau',  'delphine.moreau3@example.com', 'London, UK',       'London',   760::numeric,  '5''8"',  '2 yrs', '2002-08-17'::date, '+44-7700-900162'),
      ('vantage',  'Theo Whitfield',   'theo.whitfield@example.com',   'London, UK',       'London',   1300::numeric, '6''3"',  '8 yrs', '1995-10-09'::date, '+44-7700-900190')
    ) as t(agency, full_name, email, location, territory, rate, height, experience, dob, phone)
  loop
    v_agency_id := case v_model.agency
      when 'meridian' then v_meridian_id
      when 'solenne' then v_solenne_id
      when 'vantage' then v_vantage_id
    end;

    v_uid := gen_random_uuid();

    -- model_profiles is created first, with no profile_id yet — the
    -- invite below carries model_id so handle_new_user() can backfill it
    -- once the matching auth.users row lands.
    insert into model_profiles (
      full_name, location, default_day_rate, height, experience,
      email, date_of_birth, phone, verified_email, verified_phone, identity_verification_status
    ) values (
      v_model.full_name, v_model.location, v_model.rate, v_model.height, v_model.experience,
      v_model.email, v_model.dob, v_model.phone, true, true, 'verified'
    )
    returning id into v_model_id;

    insert into agency_model_relationships (
      model_id, agency_org_id, relationship_type, is_mother_agency, territories, exclusivity
    ) values (
      v_model_id, v_agency_id, 'mother', true, array[v_model.territory], 'exclusive'
    );

    insert into invites (email, role, model_id, status, expires_at)
    values (v_model.email, 'model', v_model_id, 'pending', now() + interval '1 year');

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_model.email, crypt('placeholder-test-pw', gen_salt('bf')),
      now(), now(), now(), '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', v_model.full_name), false,
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', v_model.email), 'email', now(), now(), now());
  end loop;
end $$;
