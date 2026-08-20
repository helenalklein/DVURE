-- Same exact gap 0064 fixed for bookings, never extended to contracts.
-- fetchContractsForModel (contracts.ts) nests campaigns(name,
-- organizations(name)) off a contract row -- RLS evaluates each nested
-- table independently, and campaigns_select_model/
-- organizations_select_model_booking (0064) only ever checked for a
-- matching BOOKINGS row. contracts.booking_id is nullable (0032) --
-- confirmed live, a real sent/signed contract can exist with no
-- booking row at all -- so a model with a contract but no booking yet
-- saw the campaign/org rows silently resolve to null, rendering as
-- "Unknown project"/"Unknown brand" instead of an error. Same additive
-- pattern as 0064/0093: a new permissive policy only WIDENS visibility,
-- can't narrow what 0064 already grants.
create policy campaigns_select_model_contract on campaigns for select using (
  exists (select 1 from contracts ct where ct.campaign_id = campaigns.id and ct.model_id = my_model_id())
);

create policy organizations_select_model_contract on organizations for select using (
  exists (
    select 1 from contracts ct
    join campaigns c on c.id = ct.campaign_id
    where ct.model_id = my_model_id() and c.brand_org_id = organizations.id
  )
);
