-- Closes the gap 0004_auth_provisioning.sql's own comments already
-- flagged: invites had no way to reference a specific model_profiles
-- row, so a model invite could create a profiles row but never link it
-- back to the roster entry an agency already added. Also fixes a real
-- bug found while building this: model_profiles has no email column,
-- so the real email collected in AgencyApp's "Add Model" form was
-- silently lost on every reload (fetchAgencyRoster was fabricating a
-- placeholder instead).

alter table model_profiles add column email text;
alter table invites add column model_id uuid references model_profiles(id) on delete cascade;

-- Returns invite details for an exact token match only — never a
-- listable policy. invites/model_profiles deliberately have no `anon`
-- grants (0007's own design), so a visitor who isn't signed in yet still
-- needs a way to see who invited them before they can accept — this
-- mirrors complete_org_signup's existing security-definer pattern,
-- just also granted to `anon` since this one runs pre-signup.
create or replace function get_invite_by_token(p_token uuid)
returns table (
  invite_id uuid,
  email text,
  role profile_role,
  org_name text,
  model_full_name text,
  status invite_status,
  expires_at timestamptz
)
security definer set search_path = public
language sql stable as $$
  select i.id, i.email, i.role, o.name, mp.full_name, i.status, i.expires_at
  from invites i
  left join organizations o on o.id = i.org_id
  left join model_profiles mp on mp.id = i.model_id
  where i.token = p_token;
$$;

revoke all on function get_invite_by_token(uuid) from public;
grant execute on function get_invite_by_token(uuid) to anon, authenticated;

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

  -- Prefer an exact invite_id match (passed by AcceptInvitePage) over
  -- the email-based fallback below — a second pending invite to the
  -- same email could otherwise claim the wrong model's roster row.
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
      -- Staff invites join an existing org via org_memberships.
      insert into org_memberships (profile_id, org_id, access_level)
      values (new.id, v_invite.org_id, 'basic');
    elsif v_invite.model_id is not null then
      -- Models claim the SAME model_profiles row an agency already
      -- created via "Add Model to Roster" (profile_id was null until
      -- now) — not a fresh row, so existing agency_model_relationships/
      -- submissions/bookings tied to that model_id stay correctly linked.
      update model_profiles set profile_id = new.id where id = v_invite.model_id;
    end if;

    update invites set status = 'accepted' where id = v_invite.id;
    return new;
  end if;

  raise exception 'handle_new_user: no role metadata or pending invite found for %', new.email;
end;
$$;
