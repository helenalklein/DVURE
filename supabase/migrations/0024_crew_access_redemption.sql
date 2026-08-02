-- The actual redemption flow 0011's own comment flagged as missing
-- ("Shell schema only — no redemption flow"). Crew never get a
-- Supabase Auth account — the access_code itself IS their session:
-- every page load re-verifies it fresh via this RPC (anon-callable,
-- same posture as get_invite_by_token), rather than anything being
-- cached client-side as a signed-in identity.
--
-- access_code never had a uniqueness constraint, just an index — two
-- grants colliding on the same code would have been a real, silent bug
-- (redeeming one code could resolve to the wrong campaign). Closing
-- that now, before any real rows depend on the old behavior.
alter table campaign_guest_access
  add constraint campaign_guest_access_code_unique unique (access_code);

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
  expires_at timestamptz
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
  if v_grant.expires_at < now() then
    raise exception 'redeem_crew_access: this access code has expired';
  end if;

  update campaign_guest_access set last_used_at = now() where id = v_grant.id;

  return query
    select
      g.id,
      cp.full_name,
      cp.discipline,
      c.id,
      c.name,
      c.status,
      o.name,
      c.due_date,
      g.expires_at
    from campaign_guest_access g
    join crew_payees cp on cp.id = g.crew_payee_id
    join campaigns c on c.id = g.campaign_id
    join organizations o on o.id = c.brand_org_id
    where g.id = v_grant.id;
end;
$$;

revoke all on function redeem_crew_access(uuid) from public;
grant execute on function redeem_crew_access(uuid) to anon, authenticated;

-- Demo access code so there's something real to actually click through —
-- ties to Seed Test Co's own earliest campaign if one exists, otherwise
-- the earliest campaign in the whole database. Fixed, known UUID (not
-- gen_random_uuid()) specifically so it can be handed out as a real,
-- reproducible demo link rather than something only discoverable by
-- querying the database directly.
do $$
declare
  v_campaign_id uuid;
  v_payee_id uuid;
  v_demo_code uuid := '11111111-2222-4333-8444-555555555555';
begin
  select c.id into v_campaign_id
  from campaigns c
  join organizations o on o.id = c.brand_org_id
  where o.name = 'Seed Test Co'
  order by c.created_at asc
  limit 1;

  if v_campaign_id is null then
    select id into v_campaign_id from campaigns order by created_at asc limit 1;
  end if;

  if v_campaign_id is not null then
    insert into crew_payees (email, full_name, discipline)
    values ('demo.crew@dvure-test.example', 'Jordan Ives', 'photographer')
    on conflict (email) do update set full_name = excluded.full_name
    returning id into v_payee_id;

    insert into campaign_guest_access (campaign_id, crew_payee_id, access_code, expires_at)
    values (v_campaign_id, v_payee_id, v_demo_code, now() + interval '90 days')
    on conflict (access_code) do update set expires_at = excluded.expires_at, revoked_at = null;

    raise notice 'Demo crew access code: 11111111-2222-4333-8444-555555555555 (visit /crew/11111111-2222-4333-8444-555555555555)';
  else
    raise notice 'No campaigns exist yet — crew demo access not seeded. Run again after at least one campaign exists.';
  end if;
end $$;
