-- The first real read surface onto audit_log (0018) — its own comment
-- deliberately left it with no select policy at all until there was an
-- actual viewing screen to scope reads to. This is that screen's
-- backing query: administrators only, and only their own org's rows
-- (org_id = my_org_id()), never a cross-org or platform-wide view —
-- an org's compliance/legal audit trail is its own, not something a
-- staff member at a different org (or a non-admin at the same one)
-- should be able to browse.
create or replace function fetch_org_audit_log(p_limit int default 200, p_before timestamptz default null)
returns table (
  id uuid,
  occurred_at timestamptz,
  actor_name text,
  actor_email text,
  action text,
  object_type text,
  object_id uuid,
  campaign_id uuid,
  campaign_name text,
  previous_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text
)
security definer set search_path = public
language plpgsql stable as $$
begin
  if my_access_level() is distinct from 'administrator' then
    raise exception 'fetch_org_audit_log: administrator access required';
  end if;

  return query
    select al.id, al.occurred_at, p.full_name, p.email, al.action, al.object_type, al.object_id,
           al.campaign_id, c.name, al.previous_value, al.new_value, al.ip_address::text, al.user_agent
    from audit_log al
    left join profiles p on p.id = al.actor_profile_id
    left join campaigns c on c.id = al.campaign_id
    where al.org_id = my_org_id()
      and (p_before is null or al.occurred_at < p_before)
    order by al.occurred_at desc
    limit least(p_limit, 500);
end;
$$;

revoke all on function fetch_org_audit_log(int, timestamptz) from public;
grant execute on function fetch_org_audit_log(int, timestamptz) to authenticated;
