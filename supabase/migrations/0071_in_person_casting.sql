-- "Will there be an in-person casting?" at campaign creation, default
-- off (most casting is digital now, per direct instruction). When set,
-- the campaign workspace shows a Casting tab — most campaigns never
-- need one, so this stays a gate rather than a tab everyone sees.
alter table campaigns add column has_in_person_casting boolean not null default false;

-- Widens the existing castings table (0039 — already the real "casting
-- event" concept the Schedule calendar reads via fetchScheduleEvents)
-- rather than inventing a parallel one: a real in-person casting has a
-- location and a time, not just a date and a title. All nullable/
-- additive — existing rows (digital-casting calendar markers) just
-- leave these blank, same as shoot_days' own optional fields.
alter table castings add column location_name text;
alter table castings add column address text;
alter table castings add column casting_time text;
