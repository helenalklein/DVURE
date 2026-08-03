-- Real bug found while testing the crew Current/History tabs with a
-- real login: campaigns_select (0002) only ever covered brand staff
-- (brand_org_id = my_org_id()) and distributed agencies
-- (agency_distributed_on) — a crew member was never added, so the
-- nested campaigns(...) join in fetchMyCrewGrants() silently came back
-- null under RLS even though the crew member could see their own
-- campaign_guest_access / campaign_crew_slots row just fine. Showed up
-- as "Unknown campaign" with a blank status, not an error, since a
-- failed nested select just returns null rather than denying the
-- whole query.
create policy campaigns_select_crew on campaigns for select using (
  exists (
    select 1 from campaign_guest_access g
    join crew_payees cp on cp.id = g.crew_payee_id
    where g.campaign_id = campaigns.id and cp.profile_id = auth.uid()
  )
  or exists (
    select 1 from campaign_crew_slots ccs
    join crew_payees cp on cp.id = ccs.crew_payee_id
    where ccs.campaign_id = campaigns.id and cp.profile_id = auth.uid()
  )
);

-- Same gap, same reason — organizations_select (0002) never covered
-- crew either, so the nested organizations(name) join for the brand
-- name (via campaigns) also came back null.
create policy organizations_select_crew on organizations for select using (
  exists (
    select 1 from campaign_guest_access g
    join crew_payees cp on cp.id = g.crew_payee_id
    join campaigns c on c.id = g.campaign_id
    where c.brand_org_id = organizations.id and cp.profile_id = auth.uid()
  )
  or exists (
    select 1 from campaign_crew_slots ccs
    join crew_payees cp on cp.id = ccs.crew_payee_id
    join campaigns c on c.id = ccs.campaign_id
    where c.brand_org_id = organizations.id and cp.profile_id = auth.uid()
  )
);
