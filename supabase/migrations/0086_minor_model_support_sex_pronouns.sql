-- Minor-model support (ToS 7.17, added this pass): the brand-facing
-- profile still belongs to the minor -- name, measurements, photos,
-- comp card, all unchanged -- but the signing authority for contracts
-- belongs to the identified parent/guardian, not the minor. No permit
-- tracking yet (that's phase 2 -- the pilot doesn't launch in NYC or
-- CA, the two states that would require it right now). Deliberately
-- small: no separate guardian login/account system, no age-gate on
-- signup -- just enough that a guardian's name is what has to be typed
-- to execute a minor's contract, checked server-side, not just in the
-- UI.
--
-- is_minor is derived from date_of_birth at check-time, not stored as
-- its own flag -- a stored boolean would silently go stale the day
-- someone turns 18.
--
-- date_of_birth itself: roster.ts/AgencyApp already call an
-- add_new_model_to_roster RPC with a p_date_of_birth param, but that
-- function (and check_possible_model_duplicate, also referenced there)
-- isn't in this repo's migration history at all -- created directly
-- against the live DB at some point, same gap already found once this
-- session with create_booking. Adding the column IF NOT EXISTS so this
-- is safe whether or not it's already there.
alter table model_profiles add column if not exists date_of_birth date;
alter table model_profiles add column if not exists guardian_name text;
alter table model_profiles add column if not exists guardian_email text;
alter table model_profiles add column if not exists guardian_relationship text;
alter table model_profiles add column if not exists sex text check (sex in ('male', 'female', 'non_binary', 'other'));
alter table model_profiles add column if not exists pronouns text;

create or replace function is_model_minor(p_model_id uuid)
returns boolean
language sql stable as $$
  select coalesce(
    (select date_of_birth > (current_date - interval '18 years') from model_profiles where id = p_model_id),
    false
  );
$$;

revoke all on function is_model_minor(uuid) from public;
grant execute on function is_model_minor(uuid) to authenticated;

-- Re-created from 0083 with two changes: (1) a minor's contract now
-- checks the signature against guardian_name, not the model's own
-- full_name; (2) the name-match check that ContractSignBox (ModelApp)
-- already does client-side is now also enforced here, server-side --
-- the real gate, not just the UI's.
create or replace function sign_contract_as_model(p_contract_id uuid, p_typed_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_model_id uuid;
  v_campaign_id uuid;
  v_status contract_status;
  v_full_name text;
  v_guardian_name text;
  v_is_minor boolean;
  v_expected_name text;
begin
  if trim(coalesce(p_typed_name, '')) = '' then
    raise exception 'Type your full legal name to sign.';
  end if;

  select model_id, campaign_id, status into v_model_id, v_campaign_id, v_status
  from contracts where id = p_contract_id;

  if v_model_id is null then
    raise exception 'Contract not found.';
  end if;
  if v_model_id <> my_model_id() then
    raise exception 'Not your contract.';
  end if;
  if v_status <> 'awaiting_signature' then
    raise exception 'This contract isn''t awaiting your signature.';
  end if;

  select full_name, guardian_name into v_full_name, v_guardian_name
  from model_profiles where id = v_model_id;
  v_is_minor := is_model_minor(v_model_id);
  v_expected_name := case when v_is_minor then v_guardian_name else v_full_name end;

  if v_is_minor and (v_expected_name is null or trim(v_expected_name) = '') then
    raise exception 'No parent or guardian is on file for this model yet -- add one before signing.';
  end if;

  if regexp_replace(lower(trim(p_typed_name)), '\s+', ' ', 'g')
     <> regexp_replace(lower(trim(coalesce(v_expected_name, ''))), '\s+', ' ', 'g') then
    raise exception 'That name doesn''t match % on file -- check the spelling and try again.',
      case when v_is_minor then 'the parent/guardian' else 'the profile' end;
  end if;

  update contracts set
    model_signature_name = trim(p_typed_name),
    signed_by_model_at = now(),
    status = 'fully_executed',
    executed_at = now()
  where id = p_contract_id;

  perform record_audit_event(
    p_action := 'contract.signed_by_model',
    p_object_type := 'contract',
    p_object_id := p_contract_id,
    p_campaign_id := v_campaign_id,
    p_new_value := jsonb_build_object('model_signature_name', trim(p_typed_name), 'signed_by_guardian', v_is_minor)
  );
end;
$$;

revoke all on function sign_contract_as_model(uuid, text) from public;
grant execute on function sign_contract_as_model(uuid, text) to authenticated;

-- Pronouns are the one field on this list the model sets for
-- themselves, not the agency -- a narrow RPC rather than a broad
-- self-update policy on model_profiles, matching how every other
-- model-initiated write in this schema works.
create or replace function update_my_pronouns(p_pronouns text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_model_id() is null then
    raise exception 'No model profile on this account.';
  end if;
  update model_profiles set pronouns = nullif(trim(p_pronouns), '') where id = my_model_id();
end;
$$;

revoke all on function update_my_pronouns(text) from public;
grant execute on function update_my_pronouns(text) to authenticated;

-- Sex and guardian info are set at agency intake (AddModelModal) but
-- deliberately NOT folded into add_new_model_to_roster / the roster
-- link RPC -- neither is in this repo's migration history (same gap
-- already found once this session with create_booking: created
-- directly against the live DB, never committed), so their real full
-- signatures aren't known here and can't be safely redefined blind.
-- This is a separate, narrow, fully-new RPC called right after the
-- model exists, scoped to an agency that actually has an active
-- relationship with that model -- same authorization shape used
-- elsewhere in this schema for agency-initiated writes.
create or replace function set_model_intake_details(
  p_model_id uuid,
  p_sex text default null,
  p_guardian_name text default null,
  p_guardian_email text default null,
  p_guardian_relationship text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from agency_model_relationships
    where model_id = p_model_id and agency_org_id = my_org_id() and status = 'active'
  ) then
    raise exception 'No active relationship with this model.';
  end if;

  update model_profiles set
    sex = coalesce(p_sex, sex),
    guardian_name = coalesce(nullif(trim(p_guardian_name), ''), guardian_name),
    guardian_email = coalesce(nullif(trim(p_guardian_email), ''), guardian_email),
    guardian_relationship = coalesce(nullif(trim(p_guardian_relationship), ''), guardian_relationship)
  where id = p_model_id;
end;
$$;

revoke all on function set_model_intake_details(uuid, text, text, text, text) from public;
grant execute on function set_model_intake_details(uuid, text, text, text, text) to authenticated;
