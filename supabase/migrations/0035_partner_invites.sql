-- Real "Invite Partner" flow — the Network tab's own "Add" button has
-- been 100% decorative (BrandApp.tsx's Network component: a hardcoded
-- 4-agency list, "Add" only toggled local React state, nothing written
-- anywhere) and Agency had no equivalent screen at all. This is the
-- closed-loop MVP version, per direct instruction: only brands/agencies
-- that already know each other pair up this way — anyone can generate an
-- invite link for a specific partner and send it themselves (email/text,
-- outside this app; there's no transactional email sending anywhere in
-- this codebase, so this mirrors the crew emergency-access-link pattern:
-- a shareable token link, not an automated email). Phase 2's open
-- "anyone can add anyone" directory is deliberately NOT this — that's
-- future work, kept out on purpose to bound abuse risk during the pilot.
create type partner_invite_status as enum ('pending', 'accepted', 'revoked');

create table partner_invites (
  id uuid primary key default gen_random_uuid(),
  inviting_org_id uuid not null references organizations(id) on delete cascade,
  invitee_org_type org_type not null,
  invitee_email text not null,
  invitee_org_name text,
  token uuid not null default gen_random_uuid() unique,
  status partner_invite_status not null default 'pending',
  created_by_profile_id uuid references profiles(id),
  accepted_by_org_id uuid references organizations(id),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);
create index partner_invites_token_idx on partner_invites (token);
create index partner_invites_inviting_org_idx on partner_invites (inviting_org_id);

alter table partner_invites enable row level security;
-- Both sides can see it once accepted (so a partner can find their own
-- acceptance history); before that, only the sender. The public token
-- lookup below is a separate security-definer path for someone who
-- doesn't have a session yet at all, not covered by this policy.
create policy partner_invites_select on partner_invites for select using (
  inviting_org_id = my_org_id() or accepted_by_org_id = my_org_id()
);
grant select on partner_invites to authenticated;

-- "Demos don't have partner access" — the actual abuse-prevention gate.
-- Different mechanism per side because the two sides are priced
-- differently now: agencies pay $99/mo, so an active subscription IS the
-- gate; brands are free, so the gate is identity verification instead
-- (a stopgap against, e.g., a fake brand account harvesting agency
-- rosters) — verification itself stays a manual operator action for now,
-- there's no self-serve verification flow to abuse.
create or replace function has_partner_access(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case (select o.org_type from organizations o where o.id = p_org_id)
    when 'agency' then coalesce((select subscription_status = 'active' from organizations where id = p_org_id), false)
    when 'brand' then coalesce((select verification_status = 'verified' from organizations where id = p_org_id), false)
    else false
  end;
$$;
revoke all on function has_partner_access(uuid) from public;
grant execute on function has_partner_access(uuid) to authenticated;

create or replace function create_partner_invite(p_invitee_email text, p_invitee_org_name text default null)
-- OUT param deliberately named invite_token, not token — a bare `token`
-- OUT param here collided with partner_invites.token inside the INSERT's
-- own RETURNING clause below and threw "column reference is ambiguous".
returns table(invite_id uuid, invite_token uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid := my_org_id();
  v_org_type org_type;
  v_invitee_type org_type;
  v_id uuid;
  v_token uuid;
begin
  if v_org_id is null then
    raise exception 'create_partner_invite: no organization for current user';
  end if;
  select org_type into v_org_type from organizations where id = v_org_id;

  if not has_partner_access(v_org_id) then
    raise exception 'create_partner_invite: this account needs % before inviting partners',
      case v_org_type when 'agency' then 'an active subscription' else 'to be verified' end;
  end if;

  v_invitee_type := case v_org_type when 'brand' then 'agency' else 'brand' end::org_type;

  insert into partner_invites (inviting_org_id, invitee_org_type, invitee_email, invitee_org_name, created_by_profile_id)
  values (v_org_id, v_invitee_type, lower(btrim(p_invitee_email)), nullif(btrim(p_invitee_org_name), ''), auth.uid())
  returning id, token into v_id, v_token;

  perform record_audit_event('partner_invite.created', 'partner_invite', v_id, null, null,
    jsonb_build_object('invitee_email', p_invitee_email, 'invitee_org_type', v_invitee_type));

  return query select v_id, v_token;
end;
$$;
revoke all on function create_partner_invite(text, text) from public;
grant execute on function create_partner_invite(text, text) to authenticated;

-- Public lookup — the invite landing page has to work for someone with
-- no session at all yet, so this can't be a table select gated by RLS.
-- Only ever returns what's needed to render "X invited you to partner on
-- DVURE" — never anything about the inviting org beyond its own name.
create or replace function fetch_partner_invite_by_token(p_token uuid)
returns table(
  invite_id uuid, inviting_org_name text, inviting_org_type org_type,
  invitee_org_type org_type, status partner_invite_status, expires_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select pi.id, o.name, o.org_type, pi.invitee_org_type, pi.status, pi.expires_at
  from partner_invites pi
  join organizations o on o.id = pi.inviting_org_id
  where pi.token = p_token;
$$;
revoke all on function fetch_partner_invite_by_token(uuid) from public;
grant execute on function fetch_partner_invite_by_token(uuid) to anon, authenticated;

create or replace function accept_partner_invite(p_token uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_invite partner_invites%rowtype;
  v_org_id uuid := my_org_id();
  v_org_type org_type;
  v_brand_org_id uuid;
  v_agency_org_id uuid;
begin
  if v_org_id is null then
    raise exception 'accept_partner_invite: no organization for current user';
  end if;

  select * into v_invite from partner_invites where token = p_token;
  if v_invite.id is null then
    raise exception 'accept_partner_invite: invite not found';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'accept_partner_invite: this invite is no longer pending';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'accept_partner_invite: this invite has expired';
  end if;

  select org_type into v_org_type from organizations where id = v_org_id;
  if v_org_type <> v_invite.invitee_org_type then
    raise exception 'accept_partner_invite: this invite is for a % account, not a %', v_invite.invitee_org_type, v_org_type;
  end if;

  if not has_partner_access(v_org_id) then
    raise exception 'accept_partner_invite: this account needs % before accepting a partnership',
      case v_org_type when 'agency' then 'an active subscription' else 'to be verified' end;
  end if;

  if v_org_type = 'brand' then
    v_brand_org_id := v_org_id; v_agency_org_id := v_invite.inviting_org_id;
  else
    v_agency_org_id := v_org_id; v_brand_org_id := v_invite.inviting_org_id;
  end if;

  insert into brand_agency_partnerships (brand_org_id, agency_org_id, status)
  values (v_brand_org_id, v_agency_org_id, 'active')
  on conflict (brand_org_id, agency_org_id) do update set status = 'active';

  update partner_invites set status = 'accepted', accepted_by_org_id = v_org_id where id = v_invite.id;

  perform record_audit_event('partner_invite.accepted', 'partner_invite', v_invite.id, null, null,
    jsonb_build_object('brand_org_id', v_brand_org_id, 'agency_org_id', v_agency_org_id));
end;
$$;
revoke all on function accept_partner_invite(uuid) from public;
grant execute on function accept_partner_invite(uuid) to authenticated;
