-- Real multi-payee invoicing. One brand charge can now cover several
-- bookings at once ("one big ticket of everything they're paying for"),
-- with the platform fee collected automatically on every one of them —
-- the brand's card is charged the FULL day_rate*days for every booking
-- selected; DVURE then transfers each booking's agency_fee out to that
-- booking's agency, and simply never transfers out platform_fee (or, for
-- now, model_fee — see create-invoice-payment's own comment on why
-- model-level payouts aren't wired yet). That's how the fee gets
-- collected on every transaction without a separate billing step: it's
-- the amount that's never sent anywhere else.
create type invoice_status as enum ('pending', 'paid', 'failed', 'canceled');

create table invoices (
  id uuid primary key default gen_random_uuid(),
  brand_org_id uuid not null references organizations(id) on delete cascade,
  campaign_id uuid references campaigns(id),
  status invoice_status not null default 'pending',
  total_amount numeric not null,
  stripe_payment_intent_id text,
  created_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index invoices_brand_idx on invoices (brand_org_id);
create index invoices_campaign_idx on invoices (campaign_id);
create index invoices_stripe_pi_idx on invoices (stripe_payment_intent_id);

-- One row per booking included in the invoice — this is the "pay only
-- certain people" unit: a brand builds an invoice by choosing which
-- outstanding bookings to include, not an all-or-nothing campaign total.
create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  booking_id uuid not null references bookings(id),
  payee_org_id uuid not null references organizations(id), -- the agency being paid out
  gross_amount numeric not null,   -- what the brand is charged for this line (day_rate * days)
  payout_amount numeric not null,  -- what actually transfers to payee_org_id (today: agency_fee only)
  stripe_transfer_id text,
  transfer_status text not null default 'pending', -- pending | transferred | awaiting_payee_onboarding | failed
  unique (invoice_id, booking_id)
);
create index invoice_line_items_invoice_idx on invoice_line_items (invoice_id);
create index invoice_line_items_booking_idx on invoice_line_items (booking_id);
create index invoice_line_items_payee_idx on invoice_line_items (payee_org_id);

alter table invoices enable row level security;
alter table invoice_line_items enable row level security;

-- Read-only from the client, same posture as payments (0014) — every
-- write goes through create-invoice-payment / the stripe-webhook Edge
-- Functions (service role), never a direct client insert/update. A
-- brand sees its own invoices; an agency sees any invoice that includes
-- at least one of their own bookings, so they know what's been paid and
-- what's still pending without seeing the brand's other agencies' cuts.
create policy invoices_select on invoices for select using (
  brand_org_id = my_org_id()
  or exists (select 1 from invoice_line_items li where li.invoice_id = invoices.id and li.payee_org_id = my_org_id())
);

create policy invoice_line_items_select on invoice_line_items for select using (
  payee_org_id = my_org_id()
  or exists (select 1 from invoices i where i.id = invoice_line_items.invoice_id and i.brand_org_id = my_org_id())
);

grant select on invoices, invoice_line_items to authenticated;
