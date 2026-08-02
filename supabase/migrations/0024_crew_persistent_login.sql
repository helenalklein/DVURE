-- Supersedes the version of 0024 written before this was ever run
-- (confirmed not yet applied) — revised per explicit direction: crew
-- get a REAL, persistent login, not an anonymous access-code-only
-- session. What the access code gates is no longer "can you log in at
-- all" — it's "is this specific campaign live for you right now."
--
-- Once signed in, a crew member sees every grant ever issued to them —
-- active (unexpired, unrevoked — full live access) and past (expired —
-- still visible for their own record and for our compliance/audit
-- needs, but read-only, no live features). No general "browse upcoming
-- campaigns" the way a model gets through their agency's own pipeline —
-- a grant is still the only way a crew member ever sees a campaign,
-- live or historical; there's just no longer a separate anonymous
-- session type to reach it through.

alter table crew_payees
  add column profile_id uuid unique references profiles(id) on delete set null;

alter table invites
  add column crew_payee_id uuid references crew_payees(id) on delete cascade;

alter table campaign_guest_access
  add constraint campaign_guest_access_code_unique unique (access_code);

-- Extends the same trigger 0009 built for models — same pattern, crew
-- side: an invite carrying crew_payee_id links this new profile back to
-- an existing crew_payees row instead of creating org_memberships.
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

    if v_invite.role = 'model' and v_invite.model_id is not null then
      update model_profiles set profile_id = new.id where id = v_invite.model_id;
    elsif v_invite.role = 'crew' and v_invite.crew_payee_id is not null then
      update crew_payees set profile_id = new.id where id = v_invite.crew_payee_id;
    elsif v_invite.role not in ('model', 'crew') then
      insert into org_memberships (profile_id, org_id, access_level)
      values (new.id, v_invite.org_id, 'basic');
    end if;

    update invites set status = 'accepted' where id = v_invite.id;
    return new;
  end if;

  raise exception 'handle_new_user: no role metadata or pending invite found for %', new.email;
end;
$$;

create policy crew_payees_select_self on crew_payees for select using (
  profile_id = auth.uid()
);

create policy campaign_guest_access_select_self on campaign_guest_access for select using (
  exists (select 1 from crew_payees cp where cp.id = campaign_guest_access.crew_payee_id and cp.profile_id = auth.uid())
);

grant select on crew_payees, campaign_guest_access to authenticated;

-- The day-of / emergency path — a direct link that still works even for
-- a crew member who isn't signed in (e.g. if auth itself is having
-- trouble). No longer the only way in; the dashboard (via the RLS
-- policies above) is the primary path once someone actually has a
-- login. is_active tells the client whether to render live features or
-- a read-only historical view — expiry alone no longer hard-blocks the
-- lookup, only an explicit revoke does.
create or replace function redeem_crew_access(p_access_code uuid)
returns table (
  grant_id uuid,
  payee_name text,
  payee_discipline crew_discipline,
  campaign_id uuid,
  campaign_name text,
  campaign_status campaign_status,
  brand_name text,
  due_date date,
  expires_at timestamptz,
  is_active boolean
)
security definer set search_path = public
language plpgsql as $$
declare
  v_grant campaign_guest_access%rowtype;
begin
  select * into v_grant from campaign_guest_access where access_code = p_access_code;

  if not found then
    raise exception 'redeem_crew_access: invalid access code';
  end if;
  if v_grant.revoked_at is not null then
    raise exception 'redeem_crew_access: this access code has been revoked';
  end if;

  update campaign_guest_access set last_used_at = now() where id = v_grant.id;

  return query
    select
      g.id, cp.full_name, cp.discipline, c.id, c.name, c.status, o.name, c.due_date, g.expires_at,
      (g.expires_at > now())
    from campaign_guest_access g
    join crew_payees cp on cp.id = g.crew_payee_id
    join campaigns c on c.id = g.campaign_id
    join organizations o on o.id = c.brand_org_id
    where g.id = v_grant.id;
end;
$$;

revoke all on function redeem_crew_access(uuid) from public;
grant execute on function redeem_crew_access(uuid) to anon, authenticated;

-- Demo data: one payee, one ACTIVE grant, one PAST (expired) grant —
-- so the dashboard's "current vs. history" split has something real in
-- both buckets to show, and a real pending invite so signup can be
-- tested end to end via /accept-invite/:token, same flow as models.
do $$
declare
  v_campaign_active uuid;
  v_campaign_past uuid;
  v_payee_id uuid;
begin
  select c.id into v_campaign_active
  from campaigns c join organizations o on o.id = c.brand_org_id
  where o.name = 'Seed Test Co'
  order by c.created_at asc limit 1;

  if v_campaign_active is null then
    select id into v_campaign_active from campaigns order by created_at asc limit 1;
  end if;

  select c.id into v_campaign_past
  from campaigns c join organizations o on o.id = c.brand_org_id
  where o.name = 'Seed Test Co' and c.id <> v_campaign_active
  order by c.created_at asc limit 1;

  if v_campaign_past is null then
    select id into v_campaign_past from campaigns where id <> v_campaign_active order by created_at asc limit 1;
  end if;

  if v_campaign_active is not null then
    insert into crew_payees (email, full_name, discipline)
    values ('demo.crew@dvure-test.example', 'Jordan Ives', 'photographer')
    on conflict (email) do update set full_name = excluded.full_name
    returning id into v_payee_id;

    insert into campaign_guest_access (campaign_id, crew_payee_id, access_code, expires_at)
    values (v_campaign_active, v_payee_id, '11111111-2222-4333-8444-555555555555', now() + interval '90 days')
    on conflict (access_code) do update set expires_at = excluded.expires_at, revoked_at = null;

    if v_campaign_past is not null then
      insert into campaign_guest_access (campaign_id, crew_payee_id, access_code, expires_at)
      values (v_campaign_past, v_payee_id, '22222222-3333-4444-8555-666666666666', now() - interval '10 days')
      on conflict (access_code) do update set expires_at = excluded.expires_at, revoked_at = null;
    end if;

    insert into invites (email, role, crew_payee_id, expires_at)
    values ('demo.crew@dvure-test.example', 'crew', v_payee_id, now() + interval '14 days')
    on conflict do nothing;

    raise notice 'Demo crew payee seeded. Set a password via /accept-invite — find the invite token with: select token from invites where email = ''demo.crew@dvure-test.example'' order by created_at desc limit 1;';
  else
    raise notice 'No campaigns exist yet — crew demo data not seeded.';
  end if;
end $$;
