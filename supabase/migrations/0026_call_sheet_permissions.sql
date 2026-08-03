-- Four-tier call sheet permissions: admin (brand org administrator) and
-- producer (whoever fills Executive Producer/Producer/Production
-- Manager) can edit every role; a department lead can only edit roles
-- in their OWN category; everyone else with legitimate visibility is a
-- read-only viewer. This has to be enforced here, not just in the UI —
-- a department lead hitting the RPC directly for another department
-- must fail server-side, a disabled button in the client is not a
-- security boundary.
--
-- Categories need to be known to the database, not just the client's
-- callSheetRoles.ts config, specifically so this permission check can't
-- be fooled by a client claiming a role belongs to a category it
-- doesn't — this table is the authoritative source, the TS config on
-- the client is a copy of it for rendering, not the other way around.
create table call_sheet_role_categories (
  role_key text primary key,
  category_key text not null
);

insert into call_sheet_role_categories (role_key, category_key) values
  ('creative_director','creative_leadership'), ('art_director','creative_leadership'),
  ('brand_director','creative_leadership'), ('design_director','creative_leadership'),
  ('executive_producer','production'), ('producer','production'),
  ('production_manager','production'), ('line_producer','production'),
  ('production_coordinator','production'), ('production_assistant','production'),
  ('photographer','photography'), ('first_assistant_photographer','photography'),
  ('second_assistant_photographer','photography'), ('digital_technician','photography'),
  ('photo_assistant','photography'),
  ('stylist','styling'), ('assistant_stylist','styling'),
  ('wardrobe_assistant','styling'), ('costume_supervisor','styling'),
  ('hair_stylist','hair_makeup'), ('hair_assistant','hair_makeup'),
  ('makeup_artist','hair_makeup'), ('makeup_assistant','hair_makeup'),
  ('groomer','hair_makeup'), ('nail_artist','hair_makeup'),
  ('casting_director','casting_talent'), ('casting_associate','casting_talent'),
  ('set_designer','set_art'), ('prop_stylist','set_art'),
  ('floral_designer','set_art'), ('art_assistant','set_art'),
  ('brand_representative','client'), ('marketing_manager','client'),
  ('client_producer','client'), ('merchandising_lead','client'),
  ('retoucher','post_production'), ('editor','post_production'),
  ('colorist','post_production'), ('motion_designer','post_production'),
  ('cgi_artist','post_production'),
  ('studio_manager','logistics'), ('location_manager','logistics'),
  ('driver','logistics'), ('catering','logistics'), ('security','logistics'),
  ('pr_representative','pr_communications'), ('social_media_manager','pr_communications'),
  ('publicist','pr_communications');

alter table call_sheet_role_categories enable row level security;
create policy call_sheet_role_categories_select on call_sheet_role_categories for select using (true);
grant select on call_sheet_role_categories to authenticated, anon;

alter table campaign_crew_slots
  add column is_department_lead boolean not null default false;

-- Returns the caller's effective permission on this campaign's call
-- sheet: 'admin' | 'producer' | 'lead' | 'viewer' | null (no access at
-- all). When p_role_key is given, 'lead' is only returned if the caller
-- leads THAT role's specific category — a lead of Photography checking
-- against a Styling role_key falls through to 'viewer' (if they have
-- any legitimate visibility) or null.
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
        and ccs.role_key in ('executive_producer', 'producer', 'production_manager')
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

revoke all on function my_call_sheet_role(uuid, text) from public;
grant execute on function my_call_sheet_role(uuid, text) to authenticated;

-- Read access follows the same tiers — anyone who'd have SOME
-- permission level (down to viewer) can see the whole sheet; someone
-- with none of the above can't see it at all.
drop policy if exists campaign_crew_slots_select on campaign_crew_slots;
create policy campaign_crew_slots_select on campaign_crew_slots for select using (
  my_call_sheet_role(campaign_id) is not null
);

create or replace function assign_call_sheet_role(
  p_campaign_id uuid,
  p_role_key text,
  p_crew_payee_id uuid
)
returns uuid
security definer set search_path = public
language plpgsql as $$
declare
  v_slot_id uuid;
  v_perm text;
begin
  v_perm := my_call_sheet_role(p_campaign_id, p_role_key);
  if v_perm not in ('admin', 'producer', 'lead') then
    raise exception 'assign_call_sheet_role: not authorized for this role';
  end if;

  insert into campaign_crew_slots (campaign_id, role_key, crew_payee_id, assigned_by_profile_id, assigned_at)
  values (p_campaign_id, p_role_key, p_crew_payee_id, auth.uid(), now())
  on conflict (campaign_id, role_key)
    do update set crew_payee_id = excluded.crew_payee_id, assigned_by_profile_id = excluded.assigned_by_profile_id, assigned_at = excluded.assigned_at
  returning id into v_slot_id;

  perform record_audit_event(
    'call_sheet.role_assigned', 'campaign_crew_slot', v_slot_id, p_campaign_id,
    null, jsonb_build_object('role_key', p_role_key, 'crew_payee_id', p_crew_payee_id, 'assigned_by_role', v_perm)
  );

  return v_slot_id;
end;
$$;

create or replace function clear_call_sheet_role(p_campaign_id uuid, p_role_key text)
returns void
security definer set search_path = public
language plpgsql as $$
declare
  v_perm text;
begin
  v_perm := my_call_sheet_role(p_campaign_id, p_role_key);
  if v_perm not in ('admin', 'producer', 'lead') then
    raise exception 'clear_call_sheet_role: not authorized for this role';
  end if;
  update campaign_crew_slots set crew_payee_id = null, is_department_lead = false
  where campaign_id = p_campaign_id and role_key = p_role_key;
end;
$$;

create or replace function invite_crew_to_call_sheet(
  p_campaign_id uuid,
  p_role_key text,
  p_full_name text,
  p_email text,
  p_discipline crew_discipline default null
)
returns uuid
security definer set search_path = public
language plpgsql as $$
declare
  v_payee_id uuid;
  v_slot_id uuid;
  v_perm text;
begin
  v_perm := my_call_sheet_role(p_campaign_id, p_role_key);
  if v_perm not in ('admin', 'producer', 'lead') then
    raise exception 'invite_crew_to_call_sheet: not authorized for this role';
  end if;

  insert into crew_payees (email, full_name, discipline)
  values (lower(trim(p_email)), p_full_name, p_discipline)
  on conflict (email) do update set full_name = excluded.full_name
  returning id into v_payee_id;

  insert into invites (email, role, crew_payee_id, invited_by_profile_id, expires_at)
  select lower(trim(p_email)), 'crew', v_payee_id, auth.uid(), now() + interval '30 days'
  where not exists (
    select 1 from invites where crew_payee_id = v_payee_id and status = 'pending' and expires_at > now()
  );

  insert into campaign_crew_slots (campaign_id, role_key, crew_payee_id, assigned_by_profile_id, assigned_at)
  values (p_campaign_id, p_role_key, v_payee_id, auth.uid(), now())
  on conflict (campaign_id, role_key)
    do update set crew_payee_id = excluded.crew_payee_id, assigned_by_profile_id = excluded.assigned_by_profile_id, assigned_at = excluded.assigned_at
  returning id into v_slot_id;

  perform record_audit_event(
    'call_sheet.role_invited', 'campaign_crew_slot', v_slot_id, p_campaign_id,
    null, jsonb_build_object('role_key', p_role_key, 'crew_payee_id', v_payee_id, 'email', p_email, 'invited_by_role', v_perm)
  );

  return v_slot_id;
end;
$$;

-- Admin/producer-only — a department lead can't promote themselves or
-- anyone else, that has to come from above.
create or replace function set_department_lead(p_campaign_id uuid, p_role_key text, p_is_lead boolean)
returns void
security definer set search_path = public
language plpgsql as $$
declare
  v_perm text;
begin
  v_perm := my_call_sheet_role(p_campaign_id, p_role_key);
  if v_perm not in ('admin', 'producer') then
    raise exception 'set_department_lead: only an admin or producer can set department leads';
  end if;
  update campaign_crew_slots set is_department_lead = p_is_lead
  where campaign_id = p_campaign_id and role_key = p_role_key;
end;
$$;

revoke all on function set_department_lead(uuid, text, boolean) from public;
grant execute on function set_department_lead(uuid, text, boolean) to authenticated;
