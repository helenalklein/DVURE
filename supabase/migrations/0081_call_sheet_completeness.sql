-- Widen fetch_call_sheet_shoot_days (0068) to also report whether each
-- day's call sheet is actually usable yet -- "complete" means it has a
-- location, address, and crew call time; weather/parking/hospital stay
-- optional. One round trip instead of a second RPC per day, and reuses
-- the same my_call_sheet_role gate this function already has.
--
-- Postgres won't let CREATE OR REPLACE change a function's return row
-- shape (new is_complete column) -- has to be dropped first.
drop function if exists fetch_call_sheet_shoot_days(uuid);

create or replace function fetch_call_sheet_shoot_days(p_campaign_id uuid)
returns table (id uuid, campaign_id uuid, date_label text, event_date date, is_complete boolean)
language plpgsql security definer set search_path = public as $$
begin
  if my_call_sheet_role(p_campaign_id) is null then
    return;
  end if;
  return query
    select sd.id, sd.campaign_id, sd.date_label, sd.event_date,
      coalesce(cs.location_name, '') <> '' and coalesce(cs.address, '') <> '' and coalesce(cs.crew_call_time, '') <> ''
    from shoot_days sd
    left join call_sheets cs on cs.shoot_day_id = sd.id
    where sd.campaign_id = p_campaign_id
    order by sd.sort_order, sd.event_date nulls last, sd.id;
end;
$$;

revoke all on function fetch_call_sheet_shoot_days(uuid) from public;
grant execute on function fetch_call_sheet_shoot_days(uuid) to authenticated;
