-- Confirms and extends the tiered crew access already built in 0026:
-- my_call_sheet_role() returns 'admin' | 'producer' | 'lead' | 'viewer' |
-- null. 'producer' is auto-granted to whoever fills the
-- executive_producer/producer/production_manager role slot — broad,
-- cross-department access, not scoped to one category the way 'lead'
-- is. Creative Director needs that same breadth ("very specific, broad
-- access to everything they need" — direct instruction) rather than
-- being capped at 'lead' (department-scoped, same as a photography
-- lead) just because creative_leadership is its own category.
--
-- Deliberately does NOT touch is_department_lead or the category table
-- — a Creative Director can still also be flagged department lead for
-- Creative Leadership specifically (relevant to Crew tab's rate-editing
-- gate, which checks admin/producer, not this function), this only
-- changes what my_call_sheet_role() returns for them.
create or replace function my_call_sheet_role(p_campaign_id uuid, p_role_key text default null)
returns text
security definer set search_path = public
language plpgsql stable as $$
declare
  v_crew_payee_id uuid;
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
