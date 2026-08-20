-- Real shoot details for a campaign, distinct from due_date (which stays
-- exactly what it already is everywhere — the submissions/board
-- deadline shown as "Ends on X"/"days remaining"). The New Project
-- form's "Location" field has been a fully disconnected <TextInput>
-- with no value/onChange since it was added — confirmed directly, it
-- writes nowhere. "Shoot Date" writes into due_date today, conflating a
-- deadline with an actual shoot date. This adds the real columns so the
-- contract's Project section ({{shoot_dates}}/{{shoot_location}}) can
-- resolve to something real instead of a permanently-blank tag.
--
-- Overtime/Additional Services (contract sections 3.2/3.3) become
-- per-project opt-ins, default off — previously hardcoded into every
-- contract with no way to exclude them.
alter table campaigns
  add column location text,
  add column shoot_start_date date,
  add column shoot_end_date date,
  add column overtime_included boolean not null default false,
  add column overtime_rate numeric,
  add column overtime_increment_minutes integer,
  add column overtime_included_hours numeric,
  add column additional_services_included boolean not null default false;
