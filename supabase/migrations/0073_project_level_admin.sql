-- Real project-level admin — the "Creative Director who gets admin
-- access for a specific campaign" case, per direct instruction. Until
-- now 'admin' tier only ever came from being an administrator at the
-- brand org itself (is_campaigns_brand + my_access_level()) — there was
-- no way to give a hired, non-brand-staff crew member (or anyone else
-- assigned a crew slot) full admin-tier access to just the one project
-- they're on. This is that grant.
--
-- Deliberately admin-only to SET this (not producer) — promoting
-- someone to admin is a bigger trust escalation than the
-- producer/lead-scoped things producers can already do unilaterally,
-- and "determined by the brand/creative teams they have or hire" reads
-- as a brand-admin decision, not something a producer should be able
-- to hand out on their own.
alter table campaign_crew_slots add column is_project_admin boolean not null default false;

create or replace function set_project_admin(p_campaign_id uuid, p_role_key text, p_is_admin boolean)
returns void
security definer set search_path = public
language plpgsql as $$
declare
  v_perm text;
begin
  v_perm := my_call_sheet_role(p_campaign_id, p_role_key);
  if v_perm <> 'admin' then
    raise exception 'set_project_admin: only a brand administrator can grant project-level admin access';
  end if;
  update campaign_crew_slots set is_project_admin = p_is_admin
  where campaign_id = p_campaign_id and role_key = p_role_key;
end;
$$;

revoke all on function set_project_admin(uuid, text, boolean) from public;
grant execute on function set_project_admin(uuid, text, boolean) to authenticated;

-- my_call_sheet_role() itself: a crew_payee with is_project_admin=true
-- on ANY of their slots for this campaign gets 'admin' here too — same
-- tier a brand org administrator gets, scoped to just this project.
-- Checked right after the org-admin branch, before the producer-role
-- check, so a project-admin crew member gets the strongest tier they
-- qualify for.
create or replace function my_call_sheet_role(p_campaign_id uuid, p_role_key text default null)
returns text
security definer set search_path = public
language plpgsql stable as $$
declare
  v_crew_payee_id uuid;
  v_is_project_admin boolean;
  v_is_producer boolean;
  v_is_lead boolean;
  v_has_any_slot boolean;
  v_has_grant boolean;
begin
  if is_campaigns_brand(p_campaign_id) and my_access_level() = 'administrator' then
    return 'admin';
  end if;

  select id into v_crew_payee_id from crew_payees where profile_id = auth.uid();

  if v_crew_payee_id is not null then
    select exists (
      select 1 from campaign_crew_slots ccs
      where ccs.campaign_id = p_campaign_id and ccs.crew_payee_id = v_crew_payee_id and ccs.is_project_admin
    ) into v_is_project_admin;
    if v_is_project_admin then return 'admin'; end if;

    select exists (
      select 1 from campaign_crew_slots ccs
      where ccs.campaign_id = p_campaign_id and ccs.crew_payee_id = v_crew_payee_id
        and ccs.role_key in ('executive_producer', 'producer', 'production_manager', 'creative_director')
    ) into v_is_producer;
    if v_is_producer then return 'producer'; end if;

    if p_role_key is not null then
      select exists (
        select 1 from campaign_crew_slots lead_slot
        join call_sheet_role_categories lead_cat on lead_cat.role_key = lead_slot.role_key
        join call_sheet_role_categories target_cat on target_cat.role_key = p_role_key
        where lead_slot.campaign_id = p_campaign_id and lead_slot.crew_payee_id = v_crew_payee_id
          and lead_slot.is_department_lead and lead_cat.category_key = target_cat.category_key
      ) into v_is_lead;
      if v_is_lead then return 'lead'; end if;
    else
      select exists (
        select 1 from campaign_crew_slots ccs
        where ccs.campaign_id = p_campaign_id and ccs.crew_payee_id = v_crew_payee_id and ccs.is_department_lead
      ) into v_is_lead;
      if v_is_lead then return 'lead'; end if;
    end if;

    select exists (
      select 1 from campaign_crew_slots ccs where ccs.campaign_id = p_campaign_id and ccs.crew_payee_id = v_crew_payee_id
    ) into v_has_any_slot;
    select exists (
      select 1 from campaign_guest_access g where g.campaign_id = p_campaign_id and g.crew_payee_id = v_crew_payee_id
    ) into v_has_grant;
    if v_has_any_slot or v_has_grant then return 'viewer'; end if;

    return null;
  end if;

  if is_campaigns_brand(p_campaign_id) then return 'viewer'; end if;
  return null;
end;
$$;
