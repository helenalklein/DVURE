-- 0011 gave every campaign_guest_access row its own full_name/email —
-- meaning the same photographer working 12 campaigns over 3 years would
-- look like 12 unrelated people, with no way to accumulate a payout
-- history or store tax/bank details once. Splitting identity out now
-- (while the table is still empty and cheap to change) avoids a much
-- more painful migration later, once real payment data exists to
-- migrate.
--
-- crew_payees is the stable thing Phase 3 payment processing will
-- actually attach to (bank details, W-9/1099 status, Stripe Connect
-- account id, etc. land here once that phase is designed — deliberately
-- not guessed at now). campaign_guest_access stays exactly what it was:
-- an ephemeral, per-campaign login that expires with the job. One
-- payee can hold many access grants across many campaigns over time.
create table crew_payees (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  discipline crew_discipline,
  created_at timestamptz not null default now()
);

alter table campaign_guest_access
  add column crew_payee_id uuid references crew_payees(id);

-- Superseded by crew_payees — a grant now points to a payee instead of
-- carrying its own copy of who they are. (Table has no rows yet, so
-- this is a free cleanup, not a real migration of live data.)
alter table campaign_guest_access
  drop column full_name,
  drop column email,
  drop column discipline;

alter table campaign_guest_access
  alter column crew_payee_id set not null;

-- Same no-direct-access posture as campaign_guest_access itself —
-- issuance will look up-or-insert a crew_payees row by email from
-- inside a future security-definer RPC, not via direct table access.
alter table crew_payees enable row level security;
