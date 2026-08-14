-- Real, visible platform fee (card 6% / ACH 5.5%) — see the finding
-- written up for the user: today's charge is gross-only, and "the fee"
-- is just whatever DVURE never transfers out (0023's own header
-- explains this). That can't support a method-dependent discount —
-- there's nothing to discount if nothing's ever added. This makes the
-- fee a real, explicit line: brand is charged gross + fee, payees are
-- unaffected (they still get exactly their allocated cut of gross,
-- computed by create_booking/booking_agency_allocations, 0038).
-- create-invoice-payment (rewritten alongside this migration) is what
-- actually computes and charges the fee; these two columns just record
-- what happened for the brand's own invoice history.
alter table invoices
  add column charge_method text check (charge_method is null or charge_method in ('ach', 'card')),
  add column platform_fee_amount numeric;
