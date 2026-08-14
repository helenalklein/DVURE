-- "Founding agency" status — every agency that subscribes during the
-- pilot keeps its $99/mo rate forever, even after Phase 2 raises the
-- agency price to $199/mo. Deliberately no cutoff logic here: every
-- agency signup gets tagged, indefinitely, until a real decision is made
-- to close founding enrollment — at that point this is a one-line change
-- (stop auto-setting the flag in complete_org_signup below), not a
-- feature that needs building now.
alter table organizations add column founding_member boolean not null default false;

update organizations set founding_member = true where org_type = 'agency';

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

  insert into organizations (org_type, name, trial_ends_at, subscription_status, founding_member)
  values (p_org_type, p_org_name, now() + interval '14 days', 'trialing', p_org_type = 'agency')
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

  perform record_audit_event('org.created', 'organization', v_org_id, null, null, jsonb_build_object('org_type', p_org_type, 'name', p_org_name, 'founding_member', p_org_type = 'agency'));

  return v_org_id;
end;
$$;
