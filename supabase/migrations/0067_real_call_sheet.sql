-- The actual industry-format call sheet — distinct from the staffing
-- grid (campaign_crew_slots, "Crew" tab), which this reuses
-- my_call_sheet_role() from but doesn't touch. One call sheet per
-- shoot day (shoot_days already models a campaign having several,
-- confirmed live via event_date/deliverables.ts), since that's how
-- call sheets work in practice — a 3-day shoot has 3 different
-- locations/schedules/call times, not one.
--
-- Visibility reuses my_call_sheet_role() exactly as the Crew tab does:
-- brand admin, brand producer (crew role), department leads, any
-- assigned crew, and anyone with a campaign_guest_access grant can all
-- see it — the whole point of a call sheet is that the people showing
-- up need to read it. Editing is simpler than Crew's own tiering:
-- admin/producer only, no per-department-lead partial edit.
create table call_sheets (
  id uuid primary key default gen_random_uuid(),
  shoot_day_id uuid not null unique references shoot_days(id) on delete cascade,
  location_name text,
  address text,
  parking_notes text,
  nearest_hospital text,
  weather text,
  crew_call_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Free-text time labels ("7:00 AM", "TBD") rather than a `time` column —
-- a real call sheet has entries like "Sunrise" or "TBD pending weather"
-- that don't fit a strict time type, same rationale shoot_days.hours
-- already used.
create table call_sheet_schedule_items (
  id uuid primary key default gen_random_uuid(),
  call_sheet_id uuid not null references call_sheets(id) on delete cascade,
  item_time text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index call_sheet_schedule_items_call_sheet_idx on call_sheet_schedule_items(call_sheet_id);

alter table call_sheets enable row level security;
alter table call_sheet_schedule_items enable row level security;

create policy call_sheets_select on call_sheets for select using (
  exists (select 1 from shoot_days sd where sd.id = call_sheets.shoot_day_id and my_call_sheet_role(sd.campaign_id) is not null)
);
create policy call_sheet_schedule_items_select on call_sheet_schedule_items for select using (
  exists (
    select 1 from call_sheets cs join shoot_days sd on sd.id = cs.shoot_day_id
    where cs.id = call_sheet_schedule_items.call_sheet_id and my_call_sheet_role(sd.campaign_id) is not null
  )
);

-- No table-level write policies (grant select only) — every write funnels
-- through the two RPCs below, matching campaign_crew_slots' own pattern
-- (0025/0026).
grant select on call_sheets, call_sheet_schedule_items to authenticated;

-- Upserts the one call sheet a shoot day has. p_shoot_day_id is the only
-- required argument; the rest default to null/unchanged-on-conflict so
-- a producer can fill in fields incrementally rather than all at once.
create or replace function upsert_call_sheet(
  p_shoot_day_id uuid,
  p_location_name text default null,
  p_address text default null,
  p_parking_notes text default null,
  p_nearest_hospital text default null,
  p_weather text default null,
  p_crew_call_time text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_campaign_id uuid;
  v_call_sheet_id uuid;
begin
  select campaign_id into v_campaign_id from shoot_days where id = p_shoot_day_id;
  if v_campaign_id is null then
    raise exception 'upsert_call_sheet: shoot day % not found', p_shoot_day_id;
  end if;
  if coalesce(my_call_sheet_role(v_campaign_id), '') not in ('admin', 'producer') then
    raise exception 'upsert_call_sheet: not authorized to edit this call sheet';
  end if;

  insert into call_sheets (shoot_day_id, location_name, address, parking_notes, nearest_hospital, weather, crew_call_time)
  values (p_shoot_day_id, p_location_name, p_address, p_parking_notes, p_nearest_hospital, p_weather, p_crew_call_time)
  on conflict (shoot_day_id) do update set
    location_name = excluded.location_name,
    address = excluded.address,
    parking_notes = excluded.parking_notes,
    nearest_hospital = excluded.nearest_hospital,
    weather = excluded.weather,
    crew_call_time = excluded.crew_call_time,
    updated_at = now()
  returning id into v_call_sheet_id;

  perform record_audit_event('call_sheet.updated', 'call_sheet', v_call_sheet_id, v_campaign_id, null,
    jsonb_build_object('location_name', p_location_name));

  return v_call_sheet_id;
end;
$$;

-- Replaces the whole schedule in one call — simpler than incremental
-- add/remove/reorder RPCs for what's fundamentally a short ordered list
-- a producer edits as a block, not row by row.
create or replace function set_call_sheet_schedule(p_call_sheet_id uuid, p_items jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_campaign_id uuid;
begin
  select sd.campaign_id into v_campaign_id
  from call_sheets cs join shoot_days sd on sd.id = cs.shoot_day_id
  where cs.id = p_call_sheet_id;
  if v_campaign_id is null then
    raise exception 'set_call_sheet_schedule: call sheet % not found', p_call_sheet_id;
  end if;
  if coalesce(my_call_sheet_role(v_campaign_id), '') not in ('admin', 'producer') then
    raise exception 'set_call_sheet_schedule: not authorized to edit this call sheet';
  end if;

  delete from call_sheet_schedule_items where call_sheet_id = p_call_sheet_id;

  insert into call_sheet_schedule_items (call_sheet_id, item_time, label, sort_order)
  select p_call_sheet_id, item->>'time', item->>'label', ordinality::int
  from jsonb_array_elements(p_items) with ordinality as t(item, ordinality);

  perform record_audit_event('call_sheet.schedule_updated', 'call_sheet', p_call_sheet_id, v_campaign_id, null,
    jsonb_build_object('item_count', jsonb_array_length(p_items)));
end;
$$;

revoke all on function upsert_call_sheet(uuid, text, text, text, text, text, text) from public;
grant execute on function upsert_call_sheet(uuid, text, text, text, text, text, text) to authenticated;
revoke all on function set_call_sheet_schedule(uuid, jsonb) from public;
grant execute on function set_call_sheet_schedule(uuid, jsonb) to authenticated;
