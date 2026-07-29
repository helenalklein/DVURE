-- Replacing the old vertical-specific type list (Runway/Editorial/
-- Advertising/E-commerce/TV Commercial/Beauty/Other) with a small
-- structural taxonomy: Campaign (the generic default — absorbs every
-- old vertical that isn't Runway), Runway (unchanged), Event (new —
-- gets Relay like Runway, but is its own distinct workspace), Other
-- (new — generic fallback). Casting is deliberately NOT one of these
-- four — it's a universal Casting Board tab available inside every
-- type's workspace (client-side nav change), not a competing type of
-- its own. This is a type swap, not a value added to the old enum,
-- since the old verticals are being retired, not extended.
alter type campaign_type rename to campaign_type_old;
create type campaign_type as enum ('Campaign', 'Runway', 'Event', 'Other');

alter table campaigns
  alter column type type campaign_type
  using (case type::text when 'Runway' then 'Runway' else 'Campaign' end)::campaign_type;

alter table campaign_templates
  alter column type type campaign_type
  using (case type::text when 'Runway' then 'Runway' else 'Campaign' end)::campaign_type;

drop type campaign_type_old;

-- One Event template so the demo-seeding guarantee below has a real
-- Event example to draw from — none of the original ten templates fit
-- that type.
insert into campaign_templates
  (name, type, status, due_offset_days, submission_open_offset_days, submission_close_offset_days, talent_needed, budget)
values
  ('Flagship Store Launch Event', 'Event', 'active', 20, -5, 10, 4, 38000);

-- Demo seeding now guarantees one of each of the three most visually
-- distinct workspaces (standard pipeline, runway + Relay, event +
-- Relay) instead of a flat random-3-of-many — a flat pick could
-- previously land on 3 near-identical "Campaign" rows and never show
-- off Runway or Event at all.
create or replace function complete_org_signup(p_org_name text, p_org_type org_type)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_role profile_role;
  v_org_id uuid;
begin
  select role into v_role from profiles where id = auth.uid();

  if v_role is null then
    raise exception 'complete_org_signup: no profile found for current user';
  end if;

  if v_role not in ('brand_staff', 'agency_staff') then
    raise exception 'complete_org_signup: role % cannot create an organization', v_role;
  end if;

  if (v_role = 'brand_staff' and p_org_type <> 'brand') or (v_role = 'agency_staff' and p_org_type <> 'agency') then
    raise exception 'complete_org_signup: org_type % does not match role %', p_org_type, v_role;
  end if;

  if exists (select 1 from org_memberships where profile_id = auth.uid()) then
    raise exception 'complete_org_signup: caller already belongs to an organization';
  end if;

  insert into organizations (org_type, name, trial_ends_at, subscription_status)
  values (p_org_type, p_org_name, now() + interval '14 days', 'trialing')
  returning id into v_org_id;

  insert into org_memberships (profile_id, org_id, access_level)
  values (auth.uid(), v_org_id, 'administrator');

  if p_org_type = 'brand' then
    insert into campaigns (brand_org_id, name, type, status, due_date, submission_open, submission_close, talent_needed, budget, created_by_profile_id)
    select v_org_id, t.name, t.type, t.status, current_date + t.due_offset_days,
           now() + (t.submission_open_offset_days || ' days')::interval,
           now() + (t.submission_close_offset_days || ' days')::interval,
           t.talent_needed, t.budget, auth.uid()
    from (
      (select * from campaign_templates where type = 'Campaign' order by random() limit 1)
      union all
      (select * from campaign_templates where type = 'Runway' order by random() limit 1)
      union all
      (select * from campaign_templates where type = 'Event' order by random() limit 1)
    ) t;
  end if;

  return v_org_id;
end;
$$;
