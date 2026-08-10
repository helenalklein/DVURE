-- The three real Vellani campaigns had due_date either null ("Due —") or
-- far enough in the future that the overdue styling (dueLabelAndUrgency,
-- campaigns.ts) never had a real case to show — the function itself was
-- always correct, there was just nothing in the data to trigger it. This
-- gives each one a distinct, current-relative date so the red/overdue,
-- amber/due-soon, and plain/on-track states are all actually reachable.
update campaigns set due_date = '2026-07-22'
where name = 'AW25 Womenswear Campaign'
  and brand_org_id = (select id from organizations where name = 'Vellani');

update campaigns set due_date = '2026-08-13'
where name = 'Holiday 2026 Lookbook'
  and brand_org_id = (select id from organizations where name = 'Vellani');

update campaigns set due_date = '2026-11-08'
where name = 'Winter Editorial 2026'
  and brand_org_id = (select id from organizations where name = 'Vellani');
