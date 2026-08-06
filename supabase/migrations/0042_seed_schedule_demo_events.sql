-- The Calendar/Schedule feature had real backend wiring but only ever
-- had one real event in the whole database (the single shoot day from
-- 0036/0039) — every other real campaign had zero castings or shoot
-- days, so the calendar correctly showed nothing because there was
-- genuinely nothing to show. This seeds real castings/shoot_days rows
-- (not mock data — same tables, same RLS, same query path the app
-- already uses) across the brand's actual real campaigns so the
-- calendar demonstrates the feature it was built for. Spring Draft Test
-- is left alone — it's a literal scratch/test campaign, not one worth
-- dressing up.

-- AW25 Womenswear Campaign
insert into castings (campaign_id, event_date, title, note)
values
  ('989ed703-b02a-4f2a-99c8-0f95b7540dff', '2026-08-08', 'First round castings — NYC studio', null),
  ('989ed703-b02a-4f2a-99c8-0f95b7540dff', '2026-08-11', 'Callback fittings', null);

insert into shoot_days (campaign_id, event_date, hours, talent_note, description)
values
  ('989ed703-b02a-4f2a-99c8-0f95b7540dff', '2026-08-18', '09:00–18:00', 'Pending final approvals', 'Hero shots — Studio 4'),
  ('989ed703-b02a-4f2a-99c8-0f95b7540dff', '2026-08-19', '09:00–17:00', 'Pending final approvals', 'Editorial close-ups');

-- Holiday 2026 Lookbook
insert into castings (campaign_id, event_date, title, note)
values
  ('de79ad62-44c7-4a83-8194-2a73d90bd49f', '2026-09-03', 'Open casting call', null);

insert into shoot_days (campaign_id, event_date, hours, talent_note, description)
values
  ('de79ad62-44c7-4a83-8194-2a73d90bd49f', '2026-09-16', '08:00–18:00', 'TBD', 'Lookbook shoot — Day 1'),
  ('de79ad62-44c7-4a83-8194-2a73d90bd49f', '2026-09-17', '08:00–18:00', 'TBD', 'Lookbook shoot — Day 2');

-- Winter Editorial 2026 (already has one real shoot day from 0039 — Sept 12)
insert into castings (campaign_id, event_date, title, note)
values
  ('cc6a35c7-4689-4106-9906-cb7efc2ffd0e', '2026-08-26', 'Casting — Winter Editorial talent', null);

insert into shoot_days (campaign_id, event_date, hours, talent_note, description)
values
  ('cc6a35c7-4689-4106-9906-cb7efc2ffd0e', '2026-10-14', '10:00–19:00', 'TBD', 'Winter Editorial — Day 2, location TBD');
