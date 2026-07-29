-- A brand demo that opens to an empty workspace doesn't show off
-- anything. Every self-signed-up BRAND org (agencies don't own
-- campaigns, so this only fires for org_type = 'brand') gets 3
-- randomly-selected campaigns seeded automatically as part of the same
-- complete_org_signup() call that creates the org. Templates live in
-- campaign_templates — pure seed/reference data, no per-user rows — so
-- the pool can grow without touching this function again.
create table campaign_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type campaign_type not null,
  status campaign_status not null,
  due_offset_days int,              -- relative to signup day
  submission_open_offset_days int,  -- relative to signup day
  submission_close_offset_days int, -- relative to signup day
  talent_needed int,
  budget numeric
);

-- No anon/authenticated grants — read only by complete_org_signup()
-- below (security definer, bypasses RLS as the function owner), same
-- deliberate no-direct-access pattern as invites/model_profiles (0007).
alter table campaign_templates enable row level security;

insert into campaign_templates
  (name, type, status, due_offset_days, submission_open_offset_days, submission_close_offset_days, talent_needed, budget)
values
  ('Fall Editorial Lookbook',    'Editorial',     'active',   18,  -3,   7,   6,  45000),
  ('Resort ''27 Runway Show',    'Runway',        'active',   32, -10,  12,  14, 180000),
  ('Holiday Campaign',           'Advertising',   'drafts',   45,   5,  20,   4,  65000),
  ('Spring E-comm Refresh',      'E-commerce',    'active',   10, -14,  -2,   8,  28000),
  ('Clean Beauty Launch',        'Beauty',        'active',   21,  -5,   9,   5,  52000),
  ('TV Spot — National Rollout', 'TV Commercial', 'drafts',   60,  14,  35,   3,  220000),
  ('Denim Capsule Editorial',    'Editorial',     'active',   14,  -7,   3,   4,  32000),
  ('Pre-Fall Trunk Show',        'Runway',        'drafts',   40,   8,  25,  10,  95000),
  ('Summer Swim Advertising',    'Advertising',   'active',   25,  -2,  11,   6,  58000),
  ('Archive Reissue Campaign',   'Editorial',     'archived',-20, -60, -35,   5,  40000);

-- CREATE OR REPLACE keeps the existing grants from 0004 intact (same
-- signature) — no need to re-issue them.
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

  insert into organizations (org_type, name) values (p_org_type, p_org_name)
  returning id into v_org_id;

  insert into org_memberships (profile_id, org_id, access_level)
  values (auth.uid(), v_org_id, 'administrator');

  -- order by random() re-rolls the pick on every new signup, so no two
  -- brand demos start out identical.
  if p_org_type = 'brand' then
    insert into campaigns (brand_org_id, name, type, status, due_date, submission_open, submission_close, talent_needed, budget, created_by_profile_id)
    select
      v_org_id,
      t.name,
      t.type,
      t.status,
      current_date + t.due_offset_days,
      now() + (t.submission_open_offset_days || ' days')::interval,
      now() + (t.submission_close_offset_days || ' days')::interval,
      t.talent_needed,
      t.budget,
      auth.uid()
    from campaign_templates t
    order by random()
    limit 3;
  end if;

  return v_org_id;
end;
$$;
