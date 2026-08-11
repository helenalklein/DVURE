-- Tracks the Stripe Invoice (if any) DVURE sent to bill its platform
-- fee on a manual (check/wire/cash) payment that never touched Stripe's
-- own card/ACH rails. Nullable — most rows never get one (card/ACH
-- payments collect the fee directly in the charge itself). The unique
-- index is the idempotency guard: create-noncircumvention-invoice
-- checks this before calling Stripe, so a retried or double-fired
-- confirmation can never generate two invoices for the same payment.
alter table invoice_payments
  add column stripe_noncircumvention_invoice_id text;

create unique index invoice_payments_noncirc_invoice_idx
  on invoice_payments (stripe_noncircumvention_invoice_id)
  where stripe_noncircumvention_invoice_id is not null;

grant update (stripe_noncircumvention_invoice_id) on invoice_payments to service_role;
grant select on invoice_payments to service_role;

-- create-noncircumvention-invoice looks up an administrator's email for
-- a brand org that's never touched Stripe before (no saved card, no
-- prior charge, no subscription) — same missing-grant class as
-- 0055/0056/0057, caught before deploying this time instead of after.
grant select on org_memberships, profiles to service_role;

-- ACH is now a real, separately-priced charge method (create-invoice-
-- payment) alongside card — invoice_payments.payment_method's check
-- constraint (0053) never allowed it. Constraint name is Postgres's
-- own auto-generated one for an unnamed column check.
alter table invoice_payments drop constraint invoice_payments_payment_method_check;
alter table invoice_payments add constraint invoice_payments_payment_method_check
  check (payment_method in ('card', 'ach', 'check', 'wire', 'cash'));
