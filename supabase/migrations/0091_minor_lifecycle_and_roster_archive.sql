-- Minor/guardian lifecycle hardening, plus finally wiring up roster
-- archiving. Three real gaps found auditing the minor/guardian flow:
-- (1) date_of_birth had no sanity bounds at all -- a future date or a
-- 150-year-old birthdate was silently accepted; (2) turning 18 already
-- auto-resolves the SIGNING gate (is_model_minor is computed live, 0086)
-- but nothing ever told the agency their guardian fields were now stale,
-- and nothing let them clear/edit those fields; (3) agency_model_
-- relationships.status already supports 'inactive' and fetchAgencyRoster
-- (roster.ts) already filters to 'active' -- the read side has been
-- ready this whole time, agencies just had no UI action that ever wrote
-- 'inactive'.
--
-- NOTE on end_representation_relationship: roster.ts already has a real
-- client wrapper calling this RPC, and it already works live (confirmed
-- directly -- calling it with a dummy id returns the function's own
-- "not authorized" business-logic error, not a "function does not
-- exist" error). Like create_booking/add_new_model_to_roster earlier
-- this session, it was created directly against the live DB and never
-- committed to this repo's migration history. Not redefined here --
-- redefining a function that already works from a guess at its
-- behavior risks a real regression. The roster archive UI (agency side)
-- just needed a caller, which it's never had until now.

-- Real bound, not just a UI nicety -- someone could otherwise submit a
-- future date_of_birth (breaks is_model_minor's own math) or an
-- implausible one. Age 0 is deliberately allowed: infant/baby modeling
-- is real and common, the floor is on plausibility, not decency.
alter table model_profiles add constraint date_of_birth_sane check (
  date_of_birth is null or (
    date_of_birth <= current_date and
    date_of_birth >= current_date - interval '150 years'
  )
);

-- Dedupe flag for the 18th-birthday notification below -- without it,
-- every roster load would re-notify the same transition forever, since
-- there's no cron in this repo to fire the check exactly once on the
-- actual birthday (see notify_adult_transitions' own comment).
alter table model_profiles add column if not exists adult_transition_notified_at timestamptz;

-- Re-created from 0087's 7-param version (the real current signature —
-- confirmed live; 0086's original 5-param version was already
-- superseded once) with two additions: p_date_of_birth (the intake form
-- never had a way to fix a wrong DOB after the fact) and
-- p_clear_guardian_info (the "mark as adult" action — today's
-- coalesce(nullif(trim(x),''), old) shape can update guardian fields
-- but can never actually clear one back to null; an explicit flag is
-- needed to distinguish "leave alone" from "wipe it"). secondary_email/
-- secondary_phone handling (0087) and the active-relationship
-- authorization check both carry over unchanged.
drop function if exists set_model_intake_details(uuid, text, text, text, text, text, text);

create or replace function set_model_intake_details(
  p_model_id uuid,
  p_sex text default null,
  p_guardian_name text default null,
  p_guardian_email text default null,
  p_guardian_relationship text default null,
  p_secondary_email text default null,
  p_secondary_phone text default null,
  p_date_of_birth date default null,
  p_clear_guardian_info boolean default false
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

  if p_date_of_birth is not null and (
    p_date_of_birth > current_date or p_date_of_birth < current_date - interval '150 years'
  ) then
    raise exception 'Date of birth must be a real past date, not more than 150 years ago.';
  end if;

  update model_profiles set
    sex = coalesce(p_sex, sex),
    date_of_birth = coalesce(p_date_of_birth, date_of_birth),
    guardian_name = case when p_clear_guardian_info then null else coalesce(nullif(trim(p_guardian_name), ''), guardian_name) end,
    guardian_email = case when p_clear_guardian_info then null else coalesce(nullif(trim(p_guardian_email), ''), guardian_email) end,
    guardian_relationship = case when p_clear_guardian_info then null else coalesce(nullif(trim(p_guardian_relationship), ''), guardian_relationship) end,
    secondary_email = coalesce(nullif(trim(p_secondary_email), ''), secondary_email),
    secondary_phone = coalesce(nullif(trim(p_secondary_phone), ''), secondary_phone)
  where id = p_model_id;
end;
$$;

revoke all on function set_model_intake_details(uuid, text, text, text, text, text, text, date, boolean) from public;
grant execute on function set_model_intake_details(uuid, text, text, text, text, text, text, date, boolean) to authenticated;

-- Called opportunistically from the roster fetch path (fire-and-forget,
-- non-blocking) rather than on a schedule -- no pg_cron/scheduled Edge
-- Function exists anywhere in this repo, and the user's own call here
-- was that minors are unlikely to matter much for this pilot but they
-- still want to be prepared. Real limitation, stated plainly: this
-- fires the next time an agency staffer happens to open the app after
-- the birthday, not on the exact calendar day.
create or replace function notify_adult_transitions()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid := my_org_id();
  v_model record;
begin
  if v_org_id is null then
    return;
  end if;

  for v_model in
    select mp.id, mp.full_name
    from agency_model_relationships amr
    join model_profiles mp on mp.id = amr.model_id
    where amr.agency_org_id = v_org_id
      and amr.status = 'active'
      and mp.guardian_name is not null
      and mp.adult_transition_notified_at is null
      and not is_model_minor(mp.id)
  loop
    insert into notifications (org_id, type, title, body)
    values (
      v_org_id,
      'model_adult_transition',
      v_model.full_name || ' just turned 18',
      'Their guardian info is still on file -- update or clear it from the roster before their next contract.'
    );

    update model_profiles set adult_transition_notified_at = now() where id = v_model.id;
  end loop;
end;
$$;

revoke all on function notify_adult_transitions() from public;
grant execute on function notify_adult_transitions() to authenticated;
