-- Wires the pre-existing Stripe scaffolding (0022 Connect onboarding,
-- create-invoice-payment/stripe-webhook Edge Functions, 0014's payments
-- ledger) up to the invoice/invoice_payments trail built in 0053. The
-- webhook currently writes invoices.status/paid_at directly -- both
-- gone as of 0053 -- so the very first real card payment would hard-
-- error. Fixing that by just writing the same columns back isn't
-- enough on its own: a card payment recorded 'pending' the moment a
-- PaymentIntent is created (mirroring how record_invoice_payment works
-- for check/wire/cash) has no way to ever leave that state if the
-- brand abandons the payment form or the card is declined --
-- void_invoice_payment/confirm_invoice_payment both explicitly refuse
-- card, and no webhook fires for "the brand just closed the tab." That
-- leaves a permanently-pending row silently eating into that payee's
-- remaining balance forever.
--
-- So this defers writing invoice_payments until Stripe actually
-- confirms success. Creating a PaymentIntent only reserves (validates
-- + finds-or-creates the payee's invoice) and stages the per-booking
-- split; the webhook turns staged rows into an already-'accepted'
-- invoice_payments row per payee on success, or just discards them on
-- failure. Nothing is ever left in a state that needs a void.

-- Per-payment PI tracking, for the webhook to find what it just
-- confirmed and for audit/debugging -- mirrors reference_note's role
-- for manual payments.
alter table invoice_payments add column if not exists stripe_payment_intent_id text;
create index if not exists invoice_payments_stripe_pi_idx on invoice_payments (stripe_payment_intent_id);

-- invoices.stripe_payment_intent_id (0023) assumed one PI per invoice,
-- which stopped being true the moment an invoice could take more than
-- one payment event (0053) -- a card payment might be only one of
-- several methods applied to the same bill over time. Nothing reads
-- this column (confirmed via grep across src/); the PI now lives on
-- the payment event itself, where it actually belongs.
drop index if exists invoices_stripe_pi_idx;
alter table invoices drop column if exists stripe_payment_intent_id;

-- Staging: the real per-booking gross/payout split for one Stripe
-- charge, from PaymentIntent creation until the webhook resolves it
-- (deleted either way -- turned into invoice_payments on success,
-- simply discarded on failure). Same posture as `payments` (0014): no
-- client policies, service-role only, since this is pure Edge Function
-- bookkeeping the client never reads directly.
create table if not exists invoice_card_payment_lines (
  id uuid primary key default gen_random_uuid(),
  stripe_payment_intent_id text not null,
  invoice_id uuid not null references invoices(id) on delete cascade,
  booking_id uuid not null references bookings(id),
  gross_amount numeric not null,
  payout_amount numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists invoice_card_payment_lines_pi_idx on invoice_card_payment_lines (stripe_payment_intent_id);
alter table invoice_card_payment_lines enable row level security;

-- Same validation and find-or-create logic as record_invoice_payment
-- (0053) -- positive amounts, exactly one payee, independent-model
-- check, brand-org check, remaining-balance check against pending+
-- accepted invoice_payments -- but never inserts into invoice_payments
-- itself; card's actual payment event only gets written once Stripe
-- confirms it (see the webhook). p_crew_payee_id is kept only for
-- signature symmetry with record_invoice_payment/record_manual_payment
-- -- create-invoice-payment never populates it, since card payments
-- are booking-scoped only in this pass (crew has no bookings row to
-- pay against, and already has a working manual-payment path).
create or replace function reserve_invoice_for_card_payment(
  p_campaign_id uuid,
  p_invoice_total numeric,
  p_amount numeric,
  p_agency_org_id uuid default null,
  p_model_id uuid default null,
  p_crew_payee_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_brand_org_id uuid;
  v_invoice_id uuid;
  v_total numeric;
  v_remaining numeric;
  v_payee_count int;
  v_is_independent boolean;
begin
  if p_amount <= 0 then
    raise exception 'reserve_invoice_for_card_payment: amount must be positive';
  end if;
  if p_invoice_total <= 0 then
    raise exception 'reserve_invoice_for_card_payment: invoice total must be positive';
  end if;

  v_payee_count := (p_agency_org_id is not null)::int + (p_model_id is not null)::int + (p_crew_payee_id is not null)::int;
  if v_payee_count <> 1 then
    raise exception 'reserve_invoice_for_card_payment: exactly one payee must be specified';
  end if;

  if p_model_id is not null then
    select is_independent into v_is_independent from model_profiles where id = p_model_id;
    if v_is_independent is not true then
      raise exception 'reserve_invoice_for_card_payment: model % is not independent — pay through their agency', p_model_id;
    end if;
  end if;

  select brand_org_id into v_brand_org_id from campaigns where id = p_campaign_id;
  if v_brand_org_id is null then
    raise exception 'reserve_invoice_for_card_payment: campaign % not found', p_campaign_id;
  end if;
  if v_brand_org_id is distinct from my_org_id() then
    raise exception 'reserve_invoice_for_card_payment: caller does not belong to this campaign''s brand org';
  end if;

  select i.id, i.total_amount into v_invoice_id, v_total
  from invoices i
  join invoice_line_items li on li.invoice_id = i.id
  where i.campaign_id = p_campaign_id
    and i.brand_org_id = v_brand_org_id
    and i.status <> 'paid'
    and (
      (p_agency_org_id is not null and li.payee_org_id = p_agency_org_id)
      or (p_model_id is not null and li.payee_model_id = p_model_id)
      or (p_crew_payee_id is not null and li.payee_crew_payee_id = p_crew_payee_id)
    )
  order by i.created_at asc
  limit 1;

  if v_invoice_id is null then
    insert into invoices (brand_org_id, campaign_id, total_amount, created_by_profile_id)
    values (v_brand_org_id, p_campaign_id, p_invoice_total, auth.uid())
    returning id, total_amount into v_invoice_id, v_total;

    insert into invoice_line_items (invoice_id, payee_org_id, payee_model_id, payee_crew_payee_id, gross_amount, payout_amount, transfer_status)
    values (v_invoice_id, p_agency_org_id, p_model_id, p_crew_payee_id, p_invoice_total, p_invoice_total, 'pending');
  end if;

  select v_total - coalesce(sum(amount), 0) into v_remaining
  from invoice_payments where invoice_id = v_invoice_id and status in ('pending', 'accepted');

  if p_amount > v_remaining then
    raise exception 'reserve_invoice_for_card_payment: amount % exceeds remaining balance %', p_amount, v_remaining;
  end if;

  return v_invoice_id;
end;
$$;

revoke all on function reserve_invoice_for_card_payment(uuid, numeric, numeric, uuid, uuid, uuid) from public;
grant execute on function reserve_invoice_for_card_payment(uuid, numeric, numeric, uuid, uuid, uuid) to authenticated;
