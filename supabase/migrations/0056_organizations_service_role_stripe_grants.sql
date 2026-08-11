-- 0041 granted service_role select on organizations (for the ics feed)
-- but never update -- every Edge Function that writes Stripe-related
-- columns on organizations via the admin client has been silently
-- failing with "permission denied for table organizations" the whole
-- time, confirmed live via create-setup-intent's real error surfacing.
-- This is worse than it looks: stripe-webhook's account.updated case
-- (supabase/functions/stripe-webhook/index.ts) writes
-- stripe_connect_charges_enabled/stripe_connect_payouts_enabled the
-- same way -- meaning no agency's Connect account has ever actually
-- been marked payouts-enabled after finishing onboarding, so every
-- card payment's payout has been silently falling back to
-- awaiting_payee_onboarding regardless of whether the agency finished
-- onboarding or not. create-connect-account's own
-- stripe_connect_account_id write shares the same gap.
grant update (stripe_customer_id, stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled)
  on organizations to service_role;
