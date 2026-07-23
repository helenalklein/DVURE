-- Real signup provisioning — turns a bare Supabase Auth account into a
-- usable DVURE identity. Two paths land here:
--   1. Brand/agency self-signup ("Try Demo"): the client passes
--      role/full_name via signUp()'s options.data (-> raw_user_meta_data),
--      then calls complete_org_signup() right after to create their org.
--   2. Agency-invited model/staff signup: no role metadata is passed —
--      the trigger instead matches a pending row in `invites` by email.
-- Neither path applies to the four seeded test users already inserted by
-- 0003_seed.sql — a trigger only fires on inserts that happen after it's
-- created, so it never retroactively fires for rows already in the
-- table. It does NOT skip future direct-SQL inserts, though — an
-- AFTER INSERT trigger fires on any insert into auth.users regardless of
-- how the row got there (signUp() or raw SQL). Any future seed script
-- that inserts into auth.users directly (see 0005_model_test_login.sql)
-- must either pass role metadata / a matching invites row, or wrap the
-- insert in `set session_replication_role = replica` to bypass this
-- trigger entirely.

create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_invite invites%rowtype;
begin
  if new.raw_user_meta_data ? 'role' then
    insert into profiles (id, role, full_name, email)
    values (new.id, (new.raw_user_meta_data->>'role')::profile_role, new.raw_user_meta_data->>'full_name', new.email);
    return new;
  end if;

  select * into v_invite
  from invites
  where email = new.email and status = 'pending' and expires_at > now()
  order by created_at desc
  limit 1;

  if found then
    insert into profiles (id, role, full_name, email)
    values (new.id, v_invite.role, new.raw_user_meta_data->>'full_name', new.email);

    -- Models are linked to their agency via agency_model_relationships,
    -- not org_memberships (see 0001_init.sql) — that link isn't created
    -- here since invites has no model_profiles reference to match on yet
    -- (a real invite-acceptance flow is a separate follow-up feature).
    if v_invite.role <> 'model' then
      insert into org_memberships (profile_id, org_id, access_level)
      values (new.id, v_invite.org_id, 'basic');
    end if;

    update invites set status = 'accepted' where id = v_invite.id;
    return new;
  end if;

  -- No sensible default role exists — fail loudly rather than create a
  -- role-less profile. Should only ever be hit by a client bug, since
  -- every real signup path is expected to supply one of the two above.
  raise exception 'handle_new_user: no role metadata or pending invite found for %', new.email;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Called by the client immediately after signUp() succeeds, for the
-- brand/agency self-signup path only. organizations/org_memberships
-- deliberately have no table-level INSERT policy (see 0002_rls.sql) —
-- all org creation funnels through this one narrow, auditable function
-- instead. Safe to call again if a prior attempt failed partway (e.g. a
-- network blip) — it no-ops into a clean exception once org_memberships
-- already exists, rather than creating a second org for the same user.
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

  return v_org_id;
end;
$$;

revoke all on function complete_org_signup(text, org_type) from public;
grant execute on function complete_org_signup(text, org_type) to authenticated;
