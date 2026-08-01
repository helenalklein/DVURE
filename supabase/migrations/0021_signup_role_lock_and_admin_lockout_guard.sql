-- Two fixes requested directly: restrict self-signup to brand/agency
-- reps only, and stop an org from ever being left with zero admins.

-- ─── 1. Self-signup can only claim brand_staff/agency_staff ────────────
-- signUpBrandOrAgency() (src/app/shared/auth.tsx) already types its role
-- param as "brand_staff" | "agency_staff" only — but that's a client-side
-- constraint, not enforced here. handle_new_user() (0009_model_invites.sql)
-- took new.raw_user_meta_data->>'role' at face value for ANY value,
-- meaning a direct supabase.auth.signUp() call (bypassing the app's own
-- UI) could self-declare role='model' or role='crew' and create a bare
-- profiles row with no model_profiles/org tie — harmless today (nothing
-- reads it), but not the intended contract: the demo signup button is
-- for brand/agency reps evaluating the product, not a way to mint a
-- model or crew identity outside the invite flow. Tightened so any other
-- self-declared role falls through to the invite-lookup branch instead —
-- which will find no pending invite and correctly reject the signup.
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_invite invites%rowtype;
begin
  if new.raw_user_meta_data ? 'role'
     and (new.raw_user_meta_data->>'role')::profile_role in ('brand_staff', 'agency_staff') then
    insert into profiles (id, role, full_name, email)
    values (new.id, (new.raw_user_meta_data->>'role')::profile_role, new.raw_user_meta_data->>'full_name', new.email);
    return new;
  end if;

  if new.raw_user_meta_data ? 'invite_id' then
    select * into v_invite
    from invites
    where id = (new.raw_user_meta_data->>'invite_id')::uuid
      and email = new.email and status = 'pending' and expires_at > now();
  end if;

  if not found then
    select * into v_invite
    from invites
    where email = new.email and status = 'pending' and expires_at > now()
    order by created_at desc
    limit 1;
  end if;

  if found then
    insert into profiles (id, role, full_name, email)
    values (new.id, v_invite.role, new.raw_user_meta_data->>'full_name', new.email);

    if v_invite.role <> 'model' then
      insert into org_memberships (profile_id, org_id, access_level)
      values (new.id, v_invite.org_id, 'basic');
    elsif v_invite.model_id is not null then
      update model_profiles set profile_id = new.id where id = v_invite.model_id;
    end if;

    update invites set status = 'accepted' where id = v_invite.id;
    return new;
  end if;

  raise exception 'handle_new_user: no role metadata or pending invite found for %', new.email;
end;
$$;

-- ─── 2. An org can never be left with zero active administrators ───────
-- org_memberships_write (0002_rls.sql) lets any administrator delete or
-- demote any membership row in their own org, including the last
-- remaining administrator (themselves, by mistake, or the only other
-- one). No client feature does this today (grepped src/ — nothing
-- writes to org_memberships beyond the initial read in
-- fetchOrgMembership), but once a "manage teammates" screen exists this
-- is exactly the kind of self-inflicted lockout that's easy to trigger
-- by accident: past that point, nothing in this schema can add a new
-- administrator to the org again (every admin-gated write, including
-- inviting a replacement, requires my_access_level() = 'administrator').
--
-- Note for later: this trigger fires on cascade-deletes too (e.g. if an
-- "delete this organization" admin feature is ever built, deleting the
-- organizations row cascades into org_memberships and would hit this
-- same check). No such feature exists yet — when one is built, route it
-- through its own security-definer RPC rather than a raw client delete.
create or replace function prevent_last_admin_lockout()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_remaining_admins int;
begin
  if old.access_level = 'administrator' and old.status = 'active' then
    v_org_id := old.org_id;

    select count(*) into v_remaining_admins
    from org_memberships
    where org_id = v_org_id and access_level = 'administrator' and status = 'active' and id <> old.id;

    if TG_OP = 'UPDATE' and new.access_level = 'administrator' and new.status = 'active' then
      v_remaining_admins := v_remaining_admins + 1;
    end if;

    if v_remaining_admins = 0 then
      raise exception 'prevent_last_admin_lockout: cannot remove or demote the last active administrator of an organization';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

drop trigger if exists org_memberships_prevent_last_admin_lockout on org_memberships;
create trigger org_memberships_prevent_last_admin_lockout
  before update or delete on org_memberships
  for each row execute function prevent_last_admin_lockout();
