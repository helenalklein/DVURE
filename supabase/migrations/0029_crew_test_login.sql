-- A real login for the demo crew payee 0024 already seeded (Jordan
-- Ives / demo.crew@dvure-test.example, one active grant + one past
-- grant) — same gap 0005_model_test_login.sql closed for models: the
-- payee row and its pending invite existed, but nothing could ever
-- actually sign in as them. handle_new_user()'s crew branch (0024)
-- matches this insert to that pending invite by email and links
-- crew_payees.profile_id automatically — same mechanism, no new code.
do $$
declare
  v_jordan uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = 'demo.crew@dvure-test.example') then
    raise notice 'demo.crew@dvure-test.example already has a login — skipping.';
    return;
  end if;

  if not exists (select 1 from invites where email = 'demo.crew@dvure-test.example' and status = 'pending' and expires_at > now()) then
    raise notice 'No live pending invite for demo.crew@dvure-test.example — run 0024''s seed again first.';
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_jordan, 'authenticated', 'authenticated',
    'demo.crew@dvure-test.example', crypt('placeholder-test-pw', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Jordan Ives"}', false,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_jordan::text, v_jordan, jsonb_build_object('sub', v_jordan::text, 'email', 'demo.crew@dvure-test.example'), 'email', now(), now(), now());

  raise notice 'Crew test login added: demo.crew@dvure-test.example (password: placeholder-test-pw)';
end $$;
