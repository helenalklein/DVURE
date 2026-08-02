-- The "living call sheet" — one slot per named role per campaign,
-- optionally filled with a crew_payees row. Role definitions themselves
-- (which ~50 roles exist, which category/row each belongs to) are NOT
-- modeled here as a table — they're a fixed, curated list that lives in
-- the client (src/app/shared/callSheetRoles.ts) as plain config, not
-- data. A Postgres enum would have made both defining the initial list
-- and any future edit to it painful (enum value removal requires a
-- full type swap, confirmed the hard way in 0017) for a list that's
-- entirely presentation/labeling, never queried by value elsewhere.
create table campaign_crew_slots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  role_key text not null,
  crew_payee_id uuid references crew_payees(id),
  assigned_by_profile_id uuid references profiles(id),
  assigned_at timestamptz,
  unique (campaign_id, role_key)
);
create index campaign_crew_slots_campaign_idx on campaign_crew_slots (campaign_id);
create index campaign_crew_slots_payee_idx on campaign_crew_slots (crew_payee_id);

alter table campaign_crew_slots enable row level security;

create policy campaign_crew_slots_select on campaign_crew_slots for select using (
  is_campaigns_brand(campaign_id)
);

-- No direct client insert/update — both go through the RPCs below,
-- which validate the caller is brand staff on this exact campaign and
-- keep crew_payees/invites writes atomic with the slot assignment
-- itself (same posture as every other multi-table write in this schema).
grant select on campaign_crew_slots to authenticated;

-- Lets a brand admin search "people we've worked with before" — scoped
-- to crew ever assigned to ANY of the caller's own campaigns, not a
-- global directory of every crew member on the platform (that would
-- leak other brands' rosters/rates). This is the missing half of
-- crew_payees_select_self (0024) — a payee sees their own row; this is
-- how a brand sees the payees THEY'VE actually worked with.
create policy crew_payees_select_via_brand_history on crew_payees for select using (
  exists (
    select 1 from campaign_crew_slots ccs
    where ccs.crew_payee_id = crew_payees.id and is_campaigns_brand(ccs.campaign_id)
  )
);

-- Fills a slot with an existing payee (someone this brand has already
-- worked with, found via the directory search above).
create or replace function assign_call_sheet_role(
  p_campaign_id uuid,
  p_role_key text,
  p_crew_payee_id uuid
)
returns uuid
security definer set search_path = public
language plpgsql as $$
declare
  v_slot_id uuid;
begin
  if not is_campaigns_brand(p_campaign_id) then
    raise exception 'assign_call_sheet_role: not authorized on this campaign';
  end if;

  insert into campaign_crew_slots (campaign_id, role_key, crew_payee_id, assigned_by_profile_id, assigned_at)
  values (p_campaign_id, p_role_key, p_crew_payee_id, auth.uid(), now())
  on conflict (campaign_id, role_key)
    do update set crew_payee_id = excluded.crew_payee_id, assigned_by_profile_id = excluded.assigned_by_profile_id, assigned_at = excluded.assigned_at
  returning id into v_slot_id;

  perform record_audit_event(
    'call_sheet.role_assigned', 'campaign_crew_slot', v_slot_id, p_campaign_id,
    null, jsonb_build_object('role_key', p_role_key, 'crew_payee_id', p_crew_payee_id)
  );

  return v_slot_id;
end;
$$;

create or replace function clear_call_sheet_role(p_campaign_id uuid, p_role_key text)
returns void
security definer set search_path = public
language plpgsql as $$
begin
  if not is_campaigns_brand(p_campaign_id) then
    raise exception 'clear_call_sheet_role: not authorized on this campaign';
  end if;
  delete from campaign_crew_slots where campaign_id = p_campaign_id and role_key = p_role_key;
end;
$$;

-- Fills a slot with someone new — creates the crew_payees row (looked
-- up by email first, same "don't duplicate a real person" rule
-- 0012's own comment already established for issuance), sends them a
-- real invite (so they can activate a login per 0024), and assigns the
-- slot, all as one transaction so a partial failure can't leave an
-- invite with no slot or a slot with no way for the person to ever sign
-- in and see it.
create or replace function invite_crew_to_call_sheet(
  p_campaign_id uuid,
  p_role_key text,
  p_full_name text,
  p_email text,
  p_discipline crew_discipline default null
)
returns uuid
security definer set search_path = public
language plpgsql as $$
declare
  v_payee_id uuid;
  v_slot_id uuid;
begin
  if not is_campaigns_brand(p_campaign_id) then
    raise exception 'invite_crew_to_call_sheet: not authorized on this campaign';
  end if;

  insert into crew_payees (email, full_name, discipline)
  values (lower(trim(p_email)), p_full_name, p_discipline)
  on conflict (email) do update set full_name = excluded.full_name
  returning id into v_payee_id;

  insert into invites (email, role, crew_payee_id, invited_by_profile_id, expires_at)
  select lower(trim(p_email)), 'crew', v_payee_id, auth.uid(), now() + interval '30 days'
  where not exists (
    select 1 from invites where crew_payee_id = v_payee_id and status = 'pending' and expires_at > now()
  );

  insert into campaign_crew_slots (campaign_id, role_key, crew_payee_id, assigned_by_profile_id, assigned_at)
  values (p_campaign_id, p_role_key, v_payee_id, auth.uid(), now())
  on conflict (campaign_id, role_key)
    do update set crew_payee_id = excluded.crew_payee_id, assigned_by_profile_id = excluded.assigned_by_profile_id, assigned_at = excluded.assigned_at
  returning id into v_slot_id;

  perform record_audit_event(
    'call_sheet.role_invited', 'campaign_crew_slot', v_slot_id, p_campaign_id,
    null, jsonb_build_object('role_key', p_role_key, 'crew_payee_id', v_payee_id, 'email', p_email)
  );

  return v_slot_id;
end;
$$;

revoke all on function assign_call_sheet_role(uuid, text, uuid) from public;
revoke all on function clear_call_sheet_role(uuid, text) from public;
revoke all on function invite_crew_to_call_sheet(uuid, text, text, text, crew_discipline) from public;
grant execute on function assign_call_sheet_role(uuid, text, uuid) to authenticated;
grant execute on function clear_call_sheet_role(uuid, text) to authenticated;
grant execute on function invite_crew_to_call_sheet(uuid, text, text, text, crew_discipline) to authenticated;
