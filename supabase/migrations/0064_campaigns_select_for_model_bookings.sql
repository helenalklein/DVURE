-- Same gap 0030 fixed for crew, now hitting models: campaigns_select
-- (0002) only ever covered brand staff and distributed agencies, with
-- no path for a model who's actually booked on the campaign to see
-- its own row. bookings_select already lets a model read their own
-- booking (model_id = my_model_id()), but ModelApp's fetchBookingsForModel
-- nests campaigns(name, organizations(name)) off that booking — RLS
-- evaluates each nested table independently, so the booking row came
-- back fine while campaigns/organizations silently resolved to null,
-- rendering as "Unknown campaign"/"Unknown brand" rather than an error.
create policy campaigns_select_model on campaigns for select using (
  exists (select 1 from bookings b where b.campaign_id = campaigns.id and b.model_id = my_model_id())
);

create policy organizations_select_model_booking on organizations for select using (
  exists (
    select 1 from bookings b
    join campaigns c on c.id = b.campaign_id
    where b.model_id = my_model_id() and c.brand_org_id = organizations.id
  )
);
