-- Custom departments and custom/repeatable roles, per direct
-- instruction: "say a photographer wants two photography assistants,
-- they can add that" (a repeatable/custom role under an EXISTING
-- department) and a "+" at the bottom of the department list to add a
-- whole new custom department.
--
-- Deliberately does NOT touch campaign_crew_slots' unique(campaign_id,
-- role_key) or rewrite assign/clear/rate/invite (all tested and live
-- tonight) — every custom or duplicate slot gets its own generated,
-- globally-unique role_key, so those existing role-key-keyed RPCs keep
-- working completely unchanged for custom slots too. call_sheet_role_categories
-- already maps role_key -> category_key for the fixed 48; widened here
-- with display labels so a custom role_key/category_key pair carries
-- its own name instead of relying on the client's hardcoded
-- CALL_SHEET_CATEGORIES (which only knows the fixed set).
alter table call_sheet_role_categories add column role_label text;
alter table call_sheet_role_categories add column category_label text;
alter table call_sheet_role_categories add column is_custom boolean not null default false;

-- Creates one new, unassigned slot — either under an existing category
-- (fixed or custom, p_category_key given) or under a brand-new custom
-- category (p_category_key null, p_new_category_label given). Returns
-- the new role_key so the caller can immediately open the assign/invite
-- picker on it.
--
-- Permission: adding within an EXISTING category needs admin, producer,
-- or a lead of THAT category — matches "the photographer can add their
-- own second assistant" directly. Standing up a brand-new department is
-- admin/producer only — a bigger structural call than one lead adding
-- to their own team, left with whoever's already allowed to manage
-- leads (set_department_lead has the same admin/producer gate).
create or replace function add_custom_crew_role(
  p_campaign_id uuid,
  p_role_label text,
  p_category_key text default null,
  p_new_category_label text default null
)
returns text
security definer set search_path = public
language plpgsql as $$
declare
  v_top_perm text;
  v_crew_payee_id uuid;
  v_is_lead_of_category boolean;
  v_role_key text;
  v_category_key text;
begin
  if p_category_key is null and p_new_category_label is null then
    raise exception 'add_custom_crew_role: must provide either an existing category_key or a new_category_label';
  end if;

  v_top_perm := my_call_sheet_role(p_campaign_id);

  if p_category_key is not null then
    -- admin/producer can always add; otherwise the caller must be a
    -- department lead of exactly this category. Checked directly here
    -- (not via my_call_sheet_role's role-key inference) since that
    -- inference expects an actual role_key, not a bare category_key —
    -- the fixed 11 categories have no role_key of their own to pass it.
    if v_top_perm not in ('admin', 'producer') then
      select id into v_crew_payee_id from crew_payees where profile_id = auth.uid();
      select exists (
        select 1 from campaign_crew_slots ccs
        join call_sheet_role_categories cat on cat.role_key = ccs.role_key
        where ccs.campaign_id = p_campaign_id and ccs.crew_payee_id = v_crew_payee_id
          and ccs.is_department_lead and cat.category_key = p_category_key
      ) into v_is_lead_of_category;
      if not coalesce(v_is_lead_of_category, false) then
        raise exception 'add_custom_crew_role: not authorized to add a role in this department';
      end if;
    end if;
    v_category_key := p_category_key;
  else
    if v_top_perm not in ('admin', 'producer') then
      raise exception 'add_custom_crew_role: only an admin or producer can add a new department';
    end if;
    v_category_key := 'custom_' || replace(gen_random_uuid()::text, '-', '');
    insert into call_sheet_role_categories (role_key, category_key, category_label, is_custom)
    values (v_category_key, v_category_key, p_new_category_label, true);
  end if;

  v_role_key := 'custom_' || replace(gen_random_uuid()::text, '-', '');
  insert into call_sheet_role_categories (role_key, category_key, role_label, is_custom)
  values (v_role_key, v_category_key, p_role_label, true);

  insert into campaign_crew_slots (campaign_id, role_key)
  values (p_campaign_id, v_role_key);

  perform record_audit_event('crew.custom_role_added', 'campaign_crew_slot', null, p_campaign_id, null,
    jsonb_build_object('role_label', p_role_label, 'category_key', v_category_key));

  return v_role_key;
end;
$$;

revoke all on function add_custom_crew_role(uuid, text, text, text) from public;
grant execute on function add_custom_crew_role(uuid, text, text, text) to authenticated;

-- Removes an empty custom/duplicate slot entirely (not just clears the
-- assignment) — only ever touches rows flagged is_custom, so the fixed
-- 48 can never be deleted this way. If it's the last role left in a
-- custom category, the category row is cleaned up too rather than
-- leaving an empty department behind.
create or replace function remove_custom_crew_role(p_campaign_id uuid, p_role_key text)
returns void
security definer set search_path = public
language plpgsql as $$
declare
  v_perm text;
  v_category_key text;
  v_is_custom boolean;
  v_remaining int;
begin
  select category_key, is_custom into v_category_key, v_is_custom
  from call_sheet_role_categories where role_key = p_role_key;

  if not coalesce(v_is_custom, false) then
    raise exception 'remove_custom_crew_role: % is not a custom role', p_role_key;
  end if;

  v_perm := my_call_sheet_role(p_campaign_id, p_role_key);
  if v_perm not in ('admin', 'producer', 'lead') then
    raise exception 'remove_custom_crew_role: not authorized to remove this role';
  end if;

  delete from campaign_crew_slots where campaign_id = p_campaign_id and role_key = p_role_key;
  delete from call_sheet_role_categories where role_key = p_role_key;

  -- Excludes the category's own self-referencing row (role_key =
  -- category_key, inserted when the custom category was created) —
  -- otherwise this would never hit zero and an emptied custom
  -- department would linger forever.
  select count(*) into v_remaining
  from call_sheet_role_categories
  where category_key = v_category_key and role_key <> v_category_key;
  if v_remaining = 0 then
    delete from call_sheet_role_categories where role_key = v_category_key and is_custom;
  end if;
end;
$$;

revoke all on function remove_custom_crew_role(uuid, text) from public;
grant execute on function remove_custom_crew_role(uuid, text) to authenticated;
