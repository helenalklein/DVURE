-- Independent models: some models aren't repped by any agency and have
-- to be paid directly by the brand. Every real submission/booking today
-- assumes an agency in the middle (submitting_agency_id/agency_org_id
-- are both NOT NULL) -- per direct decision, an independent model is
-- represented as a real submission/booking with a NULL agency, reusing
-- the existing Model Board/booking pipeline rather than building a
-- second, parallel one.

alter table submissions alter column submitting_agency_id drop not null;
alter table bookings alter column agency_org_id drop not null;

-- is_independent marks a model_profiles row as self-serve (no agency in
-- agency_model_relationships) rather than agency-added. attested_
-- independent_at is when they made that claim at signup -- the whole
-- enforcement mechanism today is that attestation plus the roster-add
-- conflict check below (see insertRosterModel in roster.ts); there's no
-- DVURE staff admin app in this codebase yet to build a review queue
-- into, so suspended_at/by/reason exist as real columns an admin can act
-- on directly (same as several other one-off administrative fixes this
-- project has done via a migration) until a real admin surface exists.
alter table model_profiles
  add column is_independent boolean not null default false,
  add column attested_independent_at timestamptz,
  add column suspended_at timestamptz,
  add column suspended_by_profile_id uuid references profiles(id),
  add column suspension_reason text;

-- A brand casting an independent model directly is the same shape of
-- write submissions_insert already allows an agency to make, just
-- without an agency_has_model/agency_distributed_on check that doesn't
-- apply here -- a security-definer RPC (matching this schema's existing
-- pattern for cross-cutting writes: record_manual_payment, createModelInvite,
-- etc.) rather than a parallel RLS policy, so the "is this model actually
-- independent" check lives in one place.
create or replace function submit_independent_model(p_campaign_id uuid, p_model_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_brand_org_id uuid;
  v_is_independent boolean;
  v_submission_id uuid;
begin
  select brand_org_id into v_brand_org_id from campaigns where id = p_campaign_id;
  if v_brand_org_id is null then
    raise exception 'submit_independent_model: campaign % not found', p_campaign_id;
  end if;
  if v_brand_org_id is distinct from my_org_id() then
    raise exception 'submit_independent_model: caller does not belong to this campaign''s brand org';
  end if;

  select is_independent into v_is_independent from model_profiles where id = p_model_id;
  if v_is_independent is not true then
    raise exception 'submit_independent_model: model % is not independent', p_model_id;
  end if;

  insert into submissions (campaign_id, model_id, submitting_agency_id, submitted_by_profile_id, stage)
  values (p_campaign_id, p_model_id, null, auth.uid(), 'submitted')
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

revoke all on function submit_independent_model(uuid, uuid) from public;
grant execute on function submit_independent_model(uuid, uuid) to authenticated;

-- Independent models are visible to any brand for casting purposes
-- (same visibility a brand already effectively has into any model once
-- submitted -- this just makes them findable beforehand). Real name/
-- email search happens client-side against this select.
create policy model_profiles_select_independent on model_profiles for select using (
  is_independent = true
);

-- Self-serve independent-model signup -- gated on an explicit
-- 'independent' flag set only by signUpIndependentModel(), never by the
-- generic brand/agency self-signup form, so this doesn't reopen the
-- self-escalation gap 0021 closed (a repped model still can't self-
-- declare role:model and skip the invite flow -- only this narrow,
-- attested path bypasses it, and it creates no org_membership, no
-- elevated access of any kind).
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_invite invites%rowtype;
begin
  if new.raw_user_meta_data ? 'role'
     and (new.raw_user_meta_data->>'role')::profile_role in ('brand_staff', 'agency_staff') then
    insert into profiles (id, role, full_name, email)
    values (new.id, (new.raw_user_meta_data->>'role')::profile_role, new.raw_user_meta_data->>'full_name', new.email);
    return new;
  end if;

  if new.raw_user_meta_data ? 'role'
     and (new.raw_user_meta_data->>'role') = 'model'
     and (new.raw_user_meta_data->>'independent')::boolean is true then
    insert into profiles (id, role, full_name, email)
    values (new.id, 'model', new.raw_user_meta_data->>'full_name', new.email);

    insert into model_profiles (profile_id, full_name, email, is_independent, attested_independent_at)
    values (new.id, new.raw_user_meta_data->>'full_name', new.email, true, now());

    return new;
  end if;

  if new.raw_user_meta_data ? 'invite_id' then
    select * into v_invite
    from invites
    where id = (new.raw_user_meta_data->>'invite_id')::uuid
      and email = new.email and status = 'pending' and expires_at > now();
  end if;

  if not found then
    select * into v_invite
    from invites
    where email = new.email and status = 'pending' and expires_at > now()
    order by created_at desc
    limit 1;
  end if;

  if found then
    insert into profiles (id, role, full_name, email)
    values (new.id, v_invite.role, new.raw_user_meta_data->>'full_name', new.email);

    if v_invite.role = 'model' and v_invite.model_id is not null then
      update model_profiles set profile_id = new.id where id = v_invite.model_id;
    elsif v_invite.role = 'crew' and v_invite.crew_payee_id is not null then
      update crew_payees set profile_id = new.id where id = v_invite.crew_payee_id;
    elsif v_invite.role not in ('model', 'crew') then
      insert into org_memberships (profile_id, org_id, access_level)
      values (new.id, v_invite.org_id, 'basic');
    end if;

    update invites set status = 'accepted' where id = v_invite.id;
    return new;
  end if;

  raise exception 'handle_new_user: no role metadata or pending invite found for %', new.email;
end;
$$;

-- Three real, seeded independent models -- signed up through the exact
-- same trigger path signUpIndependentModel() uses in the live app (role:
-- model + independent:true in raw_user_meta_data), not a hand-rolled
-- shortcut. No agency_model_relationships row for any of them -- that
-- absence is what "independent" means in this schema.
do $$
declare
  v_profile uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_profile, 'authenticated', 'authenticated',
    'noor.al-rashid@independent.example', crypt('placeholder-test-pw', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}',
    '{"role":"model","independent":true,"full_name":"Noor Al-Rashid"}', false,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_profile::text, v_profile, jsonb_build_object('sub', v_profile::text, 'email', 'noor.al-rashid@independent.example'), 'email', now(), now(), now());
  update model_profiles set location = 'Austin, TX', default_day_rate = 720, height = '5''9"', bust = '32"', waist = '25"', dress = 'US 2', experience = '3 yrs'
  where profile_id = v_profile;
  raise notice 'Independent model seeded: noor.al-rashid@independent.example (password: placeholder-test-pw)';
end $$;

do $$
declare
  v_profile uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_profile, 'authenticated', 'authenticated',
    'theo-bergstrom@independent.example', crypt('placeholder-test-pw', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}',
    '{"role":"model","independent":true,"full_name":"Theo Bergstrom"}', false,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_profile::text, v_profile, jsonb_build_object('sub', v_profile::text, 'email', 'theo-bergstrom@independent.example'), 'email', now(), now(), now());
  update model_profiles set location = 'Portland, OR', default_day_rate = 640, height = '6''1"', bust = '39"', waist = '31"', dress = 'US L', experience = '2 yrs'
  where profile_id = v_profile;
  raise notice 'Independent model seeded: theo-bergstrom@independent.example (password: placeholder-test-pw)';
end $$;

do $$
declare
  v_profile uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_profile, 'authenticated', 'authenticated',
    'sasha.kowalczyk@independent.example', crypt('placeholder-test-pw', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}',
    '{"role":"model","independent":true,"full_name":"Sasha Kowalczyk"}', false,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_profile::text, v_profile, jsonb_build_object('sub', v_profile::text, 'email', 'sasha.kowalczyk@independent.example'), 'email', now(), now(), now());
  update model_profiles set location = 'Chicago, IL', default_day_rate = 810, height = '5''11"', bust = '33"', waist = '24"', dress = 'US 4', experience = '5 yrs'
  where profile_id = v_profile;
  raise notice 'Independent model seeded: sasha.kowalczyk@independent.example (password: placeholder-test-pw)';
end $$;
