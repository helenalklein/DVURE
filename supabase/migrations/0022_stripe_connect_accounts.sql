-- First real Stripe piece. Two things an agency needs before it can ever
-- receive a payout: a Connect account, and a record of whether Stripe
-- considers onboarding actually complete (charges_enabled/payouts_enabled
-- — an account can exist mid-onboarding with neither true yet). Modeled
-- on organizations rather than a new table since "an org gets paid" is
-- already the right shape here — mirrors how brands already hold
-- stripe_customer_id (0014_payments_and_subscriptions.sql).
--
-- Deliberately organization-scoped, not model-scoped, for this first
-- pass: whether models get their own Connect accounts (paid directly by
-- the platform) or are paid out by their agency after the agency
-- receives its transfer is a real business decision, not a technical
-- one — not assumed here. This migration only unblocks the
-- agency-receives-a-transfer half.
alter table organizations
  add column stripe_connect_account_id text,
  add column stripe_connect_charges_enabled boolean not null default false,
  add column stripe_connect_payouts_enabled boolean not null default false;

-- Same posture as verification_status/subscription_status (0019): never
-- self-writable by the client. Only Edge Functions (using the service
-- role key, which bypasses RLS/grants entirely) should ever set these,
-- driven by real Stripe account state via the account.updated webhook —
-- never by a client claiming "I'm onboarded now."
