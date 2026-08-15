-- call_sheets_select / call_sheet_schedule_items_select (0067) both
-- look up campaign_id via a raw subquery against shoot_days to feed
-- my_call_sheet_role() — but shoot_days has its own restrictive RLS
-- (is_campaigns_brand, brand-only, 0032). A subquery inside an RLS
-- policy runs as the calling role, not in a security-definer context,
-- so that inner "select from shoot_days" is itself subject to
-- shoot_days' own RLS: for a crew viewer (not brand staff), the
-- shoot_days row is invisible to the subquery even though it exists, so
-- exists(...) evaluates false and the whole policy silently denies
-- access — the same class of bug 0068 already fixed for the shoot-day-
-- listing RPC, reaching the RLS policy itself here.
--
-- Fix: a tiny security-definer helper that looks up shoot_days.campaign_id
-- bypassing shoot_days' own RLS (safe — it returns only a campaign_id,
-- never any of the row's actual content), used inside both policies
-- instead of a raw subquery.
create or replace function call_sheet_campaign_id(p_shoot_day_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select campaign_id from shoot_days where id = p_shoot_day_id;
$$;

revoke all on function call_sheet_campaign_id(uuid) from public;
grant execute on function call_sheet_campaign_id(uuid) to authenticated;

drop policy call_sheets_select on call_sheets;
create policy call_sheets_select on call_sheets for select using (
  my_call_sheet_role(call_sheet_campaign_id(shoot_day_id)) is not null
);

drop policy call_sheet_schedule_items_select on call_sheet_schedule_items;
create policy call_sheet_schedule_items_select on call_sheet_schedule_items for select using (
  exists (
    select 1 from call_sheets cs
    where cs.id = call_sheet_schedule_items.call_sheet_id
      and my_call_sheet_role(call_sheet_campaign_id(cs.shoot_day_id)) is not null
  )
);
