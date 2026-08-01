-- Found in a full-system hardening pass (post-0019). bookings_write
-- (0002_rls.sql) was "for all" — select/insert/update/delete — scoped
-- only to "is this my own brand org," with no narrower check on what
-- changes after creation. Two real problems, both confirmed unreachable
-- through any real app code (grepped src/ — createBooking() in
-- src/lib/queries/bookings.ts only ever INSERTs; nothing updates or
-- deletes a booking client-side, status changes go through
-- record_payment_attempt()'s security-definer path instead), so this is
-- pure hardening, not a behavior change:
--
-- 1. payments.booking_id has `on delete cascade` (0014) — a brand admin
--    deleting their own booking via a direct REST call would silently
--    wipe every payment record (amount, status, stripe ids) ever made
--    against it. A financial ledger should never be erasable this way.
-- 2. Nothing stopped a direct REST PATCH from changing day_rate, days,
--    agency_pct, or platform_pct on a booking after creation — exactly
--    the numbers a future real Stripe charge would be built from.
--
-- Bookings are now insert-only for the client, matching the same
-- insert-only posture already used for audit_log and payments: once
-- created, a booking can only change via a vetted RPC (today:
-- record_payment_attempt, which updates payment_status; nothing else
-- needs to mutate a booking post-creation).
drop policy bookings_write on bookings;

create policy bookings_insert on bookings for insert with check (
  brand_org_id = my_org_id() and my_access_level() = 'administrator'
);
