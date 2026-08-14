-- Per direct instruction: don't require brand verification for partner
-- access right now — every org on the platform during this pilot is
-- personally vetted by pitching, so the DB-level verification gate is
-- redundant friction, not a real safeguard yet. Agencies still need an
-- active ($99/mo) subscription to partner — that check is unrelated and
-- stays exactly as-is. This is a deliberate, temporary relaxation, not a
-- redesign: re-adding the real check later (once self-serve signups from
-- people she hasn't vetted become a real risk) is a one-line revert of
-- the brand branch below back to what it was.
create or replace function has_partner_access(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case (select o.org_type from organizations o where o.id = p_org_id)
    when 'agency' then coalesce((select subscription_status = 'active' from organizations where id = p_org_id), false)
    when 'brand' then true
    else false
  end;
$$;
