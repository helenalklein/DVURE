-- shoot_days_select (0032) is brand-only (is_campaigns_brand), which is
-- fine for its other consumer (Deliverables) but wrong for the call
-- sheet: crew with my_call_sheet_role() access (the same people who can
-- read call_sheets/call_sheet_schedule_items, 0067) couldn't see which
-- shoot days even exist, so the call sheet would always show "No shoot
-- days" for them. Rather than widen shoot_days' own RLS (which could
-- open it to people who shouldn't see whatever else lives on that row,
-- like talent_note), this is a narrow, security-definer RPC scoped to
-- exactly the call sheet's own visibility rule.
create or replace function fetch_call_sheet_shoot_days(p_campaign_id uuid)
returns table (id uuid, campaign_id uuid, date_label text, event_date date)
language plpgsql security definer set search_path = public as $$
begin
  if my_call_sheet_role(p_campaign_id) is null then
    return;
  end if;
  -- sort_order alone isn't a safe ordering key — pre-existing shoot_days
  -- rows created before this feature may all share sort_order 0, a tie
  -- Postgres can break inconsistently between calls. event_date is the
  -- actual meaningful order; id is a last-resort deterministic
  -- tiebreaker if that's ever tied too.
  return query
    select sd.id, sd.campaign_id, sd.date_label, sd.event_date
    from shoot_days sd
    where sd.campaign_id = p_campaign_id
    order by sd.sort_order, sd.event_date nulls last, sd.id;
end;
$$;

revoke all on function fetch_call_sheet_shoot_days(uuid) from public;
grant execute on function fetch_call_sheet_shoot_days(uuid) to authenticated;
