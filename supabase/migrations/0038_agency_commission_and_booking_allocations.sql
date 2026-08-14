-- Task 34 (mother/boutique fee split, scoped 8/11) + tonight's addition
-- (agency-vs-model split, previously a flat platform-wide 20% constant
-- in bookings.ts, now per-relationship). Per direct instruction, kept
-- deliberately simple for the pilot rather than a fully general
-- contract model — that's real future work for when there's a dev team
-- to design it properly:
--   - Two fee_entitlement modes only: 'always' (paid on every booking of
--     this model regardless of who actually books it — the real
--     "mother agency" case; a model can have more than one 'always'
--     relationship simultaneously) and 'when_booking' (paid only when
--     THIS agency is the one who booked — the normal/default case).
--   - Each relationship carries its own commission_pct — real contracts
--     vary agency to agency, so this isn't a platform-wide default
--     anymore, just a fallback (default_commission_pct()) for
--     relationships that haven't set one.
alter table agency_model_relationships
  add column commission_pct numeric check (commission_pct is null or (commission_pct >= 0 and commission_pct <= 1)),
  add column fee_entitlement text not null default 'when_booking' check (fee_entitlement in ('always', 'when_booking'));

create or replace function default_commission_pct() returns numeric language sql immutable as $$ select 0.20 $$;

-- create_representation_relationship's signature is changing (2 new
-- trailing params) — CREATE OR REPLACE can't change a function's
-- parameter list, only its body, so the old signature has to be
-- dropped explicitly or it'd stick around as a second, stale overload.
drop function if exists create_representation_relationship(uuid, text, boolean, text[], representation_exclusivity, date, date);
drop function if exists add_new_model_to_roster(text, text, text, numeric, text, text, date, text, text, boolean, text[], representation_exclusivity, date, date);

create or replace function create_representation_relationship(
  p_model_id uuid, p_representation_type text, p_is_mother_agency boolean, p_territories text[],
  p_exclusivity representation_exclusivity, p_effective_start_date date, p_effective_end_date date default null,
  p_commission_pct numeric default null, p_fee_entitlement text default 'when_booking'
)
returns table(relationship_id uuid, overlap_warning text)
language plpgsql security definer set search_path = public as $$
declare
  v_agency_id uuid := my_org_id();
  v_rel_id uuid;
  v_overlap boolean;
begin
  if my_org_type() <> 'agency' or my_access_level() not in ('administrator', 'enhanced') then
    raise exception 'create_representation_relationship: not authorized';
  end if;
  if p_fee_entitlement not in ('always', 'when_booking') then
    raise exception 'create_representation_relationship: fee_entitlement must be ''always'' or ''when_booking''';
  end if;

  insert into agency_model_relationships (
    model_id, agency_org_id, relationship_type, is_mother_agency, territories,
    exclusivity, effective_start_date, effective_end_date, commission_pct, fee_entitlement
  ) values (
    p_model_id, v_agency_id, p_representation_type, p_is_mother_agency, p_territories,
    p_exclusivity, p_effective_start_date, p_effective_end_date, p_commission_pct, p_fee_entitlement
  ) returning id into v_rel_id;

  v_overlap := representation_overlap_exists(
    p_model_id, v_rel_id, v_agency_id, p_territories, p_exclusivity,
    p_effective_start_date, p_effective_end_date
  );

  perform record_audit_event(
    'relationship.created', 'agency_model_relationship', v_rel_id, null,
    null, jsonb_build_object(
      'model_id', p_model_id, 'representation_type', p_representation_type,
      'is_mother_agency', p_is_mother_agency, 'territories', p_territories,
      'exclusivity', p_exclusivity, 'overlap_detected', v_overlap,
      'commission_pct', p_commission_pct, 'fee_entitlement', p_fee_entitlement
    )
  );

  return query select v_rel_id,
    case when v_overlap then
      'This model has another active exclusive representation relationship covering one or more of the same territories. Please confirm you are authorized to represent this model here before proceeding.'
    else null end;
end;
$$;
revoke all on function create_representation_relationship(uuid, text, boolean, text[], representation_exclusivity, date, date, numeric, text) from public;
grant execute on function create_representation_relationship(uuid, text, boolean, text[], representation_exclusivity, date, date, numeric, text) to authenticated;

create or replace function add_new_model_to_roster(
  p_full_name text, p_email text, p_location text, p_default_day_rate numeric, p_height text, p_experience text,
  p_date_of_birth date, p_phone text, p_representation_type text, p_is_mother_agency boolean, p_territories text[],
  p_exclusivity representation_exclusivity, p_effective_start_date date, p_effective_end_date date default null,
  p_commission_pct numeric default null, p_fee_entitlement text default 'when_booking'
)
returns table(model_id uuid, relationship_id uuid, overlap_warning text, duplicate_confidence text)
language plpgsql security definer set search_path = public as $$
declare
  v_model_id uuid;
  v_rel_result record;
  v_dup_confidence text;
begin
  if my_org_type() <> 'agency' or my_access_level() not in ('administrator', 'enhanced') then
    raise exception 'add_new_model_to_roster: not authorized';
  end if;

  select match_confidence into v_dup_confidence
    from check_possible_model_duplicate(p_full_name, p_email, p_phone, p_date_of_birth, p_location)
    limit 1;

  insert into model_profiles (full_name, email, location, default_day_rate, height, experience, date_of_birth, phone)
  values (p_full_name, p_email, p_location, p_default_day_rate, p_height, p_experience, p_date_of_birth, p_phone)
  returning id into v_model_id;

  select * into v_rel_result from create_representation_relationship(
    v_model_id, p_representation_type, p_is_mother_agency, p_territories, p_exclusivity,
    p_effective_start_date, p_effective_end_date, p_commission_pct, p_fee_entitlement
  );

  return query select v_model_id, v_rel_result.relationship_id, v_rel_result.overlap_warning, v_dup_confidence;
end;
$$;
revoke all on function add_new_model_to_roster(text, text, text, numeric, text, text, date, text, text, boolean, text[], representation_exclusivity, date, date, numeric, text) from public;
grant execute on function add_new_model_to_roster(text, text, text, numeric, text, text, date, text, text, boolean, text[], representation_exclusivity, date, date, numeric, text) to authenticated;

-- One row per agency actually owed money on a given booking — usually
-- one (the agency that booked), sometimes two or more (a booking agency
-- plus one or more 'always'-entitled mother agencies on the same
-- model). Replaces bookings.agency_org_id/agency_pct as the source of
-- truth for payouts; those two columns stay on bookings as a rollup
-- (agency_pct = sum of every allocation's pct) so booking_breakdown_v
-- keeps meaning the same thing it always has.
create table booking_agency_allocations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  agency_org_id uuid not null references organizations(id),
  relationship_id uuid references agency_model_relationships(id),
  pct numeric not null check (pct >= 0 and pct <= 1),
  entitlement_reason text not null check (entitlement_reason in ('always', 'when_booking')),
  created_at timestamptz not null default now(),
  unique (booking_id, agency_org_id)
);
create index booking_agency_allocations_booking_idx on booking_agency_allocations (booking_id);
create index booking_agency_allocations_agency_idx on booking_agency_allocations (agency_org_id);

alter table booking_agency_allocations enable row level security;
create policy booking_agency_allocations_select on booking_agency_allocations for select using (
  agency_org_id = my_org_id() or exists (select 1 from bookings b where b.id = booking_id and b.brand_org_id = my_org_id())
);
grant select on booking_agency_allocations to authenticated;

-- Backfill: every booking created before this migration has a single
-- agency_org_id/agency_pct on the row itself and no allocation rows yet
-- — without this, create-invoice-payment (rewritten to read from
-- booking_agency_allocations instead of the booking row directly) would
-- silently stop paying out anyone on an existing unpaid booking.
insert into booking_agency_allocations (booking_id, agency_org_id, pct, entitlement_reason)
select b.id, b.agency_org_id, b.agency_pct, 'when_booking'
from bookings b
where b.agency_org_id is not null
  and not exists (select 1 from booking_agency_allocations a where a.booking_id = b.id);

-- bookings has been client-insertable (bookings_insert) since 0001 —
-- moving to an RPC (matching this schema's own established convention:
-- tables get a select policy, every write goes through a
-- security-definer function) because computing the right set of
-- allocations for a booking is real logic, not a simple insert a client
-- should be trusted to get right.
drop policy if exists bookings_insert on bookings;

create or replace function create_booking(
  p_campaign_id uuid, p_submission_id uuid, p_model_id uuid, p_day_rate numeric,
  p_days integer, p_shoot_date date, p_booking_agency_org_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_brand_org_id uuid := my_org_id();
  v_booking_id uuid;
  v_total_agency_pct numeric := 0;
  v_rel record;
  v_booking_agency_covered boolean := false;
  v_booking_agency_rel_id uuid;
  v_booking_agency_pct numeric;
begin
  if my_org_type() <> 'brand' or my_access_level() <> 'administrator' then
    raise exception 'create_booking: not authorized';
  end if;

  insert into bookings (campaign_id, submission_id, brand_org_id, agency_org_id, model_id, day_rate, days, shoot_date, agency_pct, platform_pct)
  values (p_campaign_id, p_submission_id, v_brand_org_id, p_booking_agency_org_id, p_model_id, p_day_rate, p_days, p_shoot_date, 0, 0.06)
  returning id into v_booking_id;

  -- Every 'always'-entitled active relationship on this model, paid
  -- regardless of who actually booked it.
  for v_rel in
    select id, agency_org_id, coalesce(commission_pct, default_commission_pct()) as pct
    from agency_model_relationships
    where model_id = p_model_id and status = 'active' and fee_entitlement = 'always'
  loop
    insert into booking_agency_allocations (booking_id, agency_org_id, relationship_id, pct, entitlement_reason)
    values (v_booking_id, v_rel.agency_org_id, v_rel.id, v_rel.pct, 'always');
    v_total_agency_pct := v_total_agency_pct + v_rel.pct;
    if v_rel.agency_org_id = p_booking_agency_org_id then
      v_booking_agency_covered := true;
    end if;
  end loop;

  -- The agency that actually booked this, unless already paid above via
  -- their own 'always' relationship on this same model.
  if p_booking_agency_org_id is not null and not v_booking_agency_covered then
    select id, coalesce(commission_pct, default_commission_pct())
      into v_booking_agency_rel_id, v_booking_agency_pct
      from agency_model_relationships
      where model_id = p_model_id and agency_org_id = p_booking_agency_org_id and status = 'active'
      limit 1;

    v_booking_agency_pct := coalesce(v_booking_agency_pct, default_commission_pct());
    insert into booking_agency_allocations (booking_id, agency_org_id, relationship_id, pct, entitlement_reason)
    values (v_booking_id, p_booking_agency_org_id, v_booking_agency_rel_id, v_booking_agency_pct, 'when_booking');
    v_total_agency_pct := v_total_agency_pct + v_booking_agency_pct;
  end if;

  if v_total_agency_pct > 0.95 then
    raise exception 'create_booking: combined agency commission is % percent, leaving too little for the model — check the relationships involved', round(v_total_agency_pct * 100);
  end if;

  update bookings set agency_pct = v_total_agency_pct where id = v_booking_id;

  perform record_audit_event('booking.created', 'booking', v_booking_id, p_campaign_id, null,
    jsonb_build_object('model_id', p_model_id, 'day_rate', p_day_rate, 'days', p_days, 'shoot_date', p_shoot_date, 'total_agency_pct', v_total_agency_pct));

  return v_booking_id;
end;
$$;
revoke all on function create_booking(uuid, uuid, uuid, numeric, integer, date, uuid) from public;
grant execute on function create_booking(uuid, uuid, uuid, numeric, integer, date, uuid) to authenticated;
