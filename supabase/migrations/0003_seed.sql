-- Placeholder seed data — TEST ACCOUNTS ONLY, purely to verify the RLS
-- policies in 0002_rls.sql actually behave as designed before any real
-- signup/invite flow exists. All four users share the same throwaway
-- password below. Delete these rows (or at least change the password)
-- once verification is done — do not treat them as real accounts.
--
-- Scenario seeded:
--   Acne Studios (brand) runs a campaign, distributed to two agencies:
--   Elite Model Mgmt. and IMG Models. Model "Zara Okafor" has Elite as
--   her MOTHER agency and IMG as a BOUTIQUE agency. Elite submits Zara
--   to the campaign; IMG (linked to Zara, but didn't submit her) should
--   NOT see that submission. A third agency, Wilhelmina, has no
--   relationship to Zara and no distribution on the campaign at all —
--   the negative-case control for "can't see what you're not part of."

do $$
declare
  v_marcus uuid := gen_random_uuid();
  v_sophie uuid := gen_random_uuid();
  v_diana  uuid := gen_random_uuid();
  v_priya  uuid := gen_random_uuid();
  v_acne_id uuid;
  v_elite_id uuid;
  v_img_id uuid;
  v_wilhelmina_id uuid;
  v_zara_id uuid;
  v_campaign_id uuid;
  v_submission_id uuid;
begin

  -- auth.users + auth.identities — the documented pattern for seeding
  -- test accounts directly via SQL (see Supabase's own seed examples).
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
  ) values
    ('00000000-0000-0000-0000-000000000000', v_marcus, 'authenticated', 'authenticated', 'marcus@acnestudios.example', crypt('placeholder-test-pw', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, ''),
    ('00000000-0000-0000-0000-000000000000', v_sophie, 'authenticated', 'authenticated', 'sophie@elite.example',       crypt('placeholder-test-pw', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, ''),
    ('00000000-0000-0000-0000-000000000000', v_diana,  'authenticated', 'authenticated', 'diana@imgmodels.example',    crypt('placeholder-test-pw', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, ''),
    ('00000000-0000-0000-0000-000000000000', v_priya,  'authenticated', 'authenticated', 'priya@wilhelmina.example',   crypt('placeholder-test-pw', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, '');

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
  from auth.users u where u.id in (v_marcus, v_sophie, v_diana, v_priya);

  -- Organizations
  insert into organizations (org_type, name) values ('brand', 'Acne Studios') returning id into v_acne_id;
  insert into organizations (org_type, name) values ('agency', 'Elite Model Mgmt.') returning id into v_elite_id;
  insert into organizations (org_type, name) values ('agency', 'IMG Models') returning id into v_img_id;
  insert into organizations (org_type, name) values ('agency', 'Wilhelmina') returning id into v_wilhelmina_id;

  -- Profiles + org_memberships (all administrators, for simplicity of testing)
  insert into profiles (id, role, full_name, email) values
    (v_marcus, 'brand_staff', 'Marcus Webb', 'marcus@acnestudios.example'),
    (v_sophie, 'agency_staff', 'Sophie Chen', 'sophie@elite.example'),
    (v_diana,  'agency_staff', 'Diana Park', 'diana@imgmodels.example'),
    (v_priya,  'agency_staff', 'Priya Sharma', 'priya@wilhelmina.example');

  insert into org_memberships (profile_id, org_id, title, access_level) values
    (v_marcus, v_acne_id, 'Brand Director', 'administrator'),
    (v_sophie, v_elite_id, 'Senior Agent', 'administrator'),
    (v_diana,  v_img_id, 'Agent', 'administrator'),
    (v_priya,  v_wilhelmina_id, 'Booking Coordinator', 'administrator');

  -- Standing brand<->agency partnerships
  insert into brand_agency_partnerships (brand_org_id, agency_org_id) values
    (v_acne_id, v_elite_id), (v_acne_id, v_img_id), (v_acne_id, v_wilhelmina_id);

  -- Model with a mother agency (Elite) and a boutique agency (IMG).
  -- Wilhelmina has no relationship to her at all.
  insert into model_profiles (full_name, location, default_day_rate, height, experience)
  values ('Zara Okafor', 'New York, NY', 980, '5''10"', '6 yrs')
  returning id into v_zara_id;

  insert into agency_model_relationships (model_id, agency_org_id, relationship_type) values
    (v_zara_id, v_elite_id, 'mother'),
    (v_zara_id, v_img_id, 'boutique');

  -- Campaign, distributed to Elite and IMG but NOT Wilhelmina.
  insert into campaigns (brand_org_id, name, type, status, submission_open, submission_close, talent_needed, budget, created_by_profile_id)
  values (v_acne_id, 'AW25 Womenswear Campaign', 'Editorial', 'active', now() - interval '30 days', now() + interval '14 days', 4, 18000, v_marcus)
  returning id into v_campaign_id;

  insert into campaign_agency_distributions (campaign_id, agency_org_id, invited_by_profile_id) values
    (v_campaign_id, v_elite_id, v_marcus),
    (v_campaign_id, v_img_id, v_marcus);

  -- Elite (mother agency) submits Zara. IMG is linked to Zara but did
  -- NOT submit her here — IMG should see zero rows for this submission.
  insert into submissions (campaign_id, model_id, submitting_agency_id, submitted_by_profile_id, stage)
  values (v_campaign_id, v_zara_id, v_elite_id, v_sophie, 'submitted')
  returning id into v_submission_id;

  -- Brand-internal comment — no agency, including Elite who submitted
  -- her, should ever be able to read this.
  insert into submission_comments (submission_id, author_profile_id, author_org_id, body)
  values (v_submission_id, v_marcus, v_acne_id, 'Rate feels high for this budget — let''s see who else comes in before deciding.');

  raise notice 'Seed complete. Test logins (all use password: placeholder-test-pw):';
  raise notice '  Brand (Acne Studios):     marcus@acnestudios.example';
  raise notice '  Agency mother (Elite):    sophie@elite.example';
  raise notice '  Agency boutique (IMG):    diana@imgmodels.example';
  raise notice '  Agency control (Wilhelmina, unrelated): priya@wilhelmina.example';

end $$;
