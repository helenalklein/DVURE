-- Replaces invoice_status ('pending'/'paid'/'failed'/'canceled', from 0023,
-- extended informally by 0046 for manual payments) with a single explicit
-- 4-step lifecycle plus exception states, so every payment -- card/ACH
-- once Stripe is live, or check/wire/cash today -- can be drawn on one
-- timeline bar:
--
--   Initiated -> Pending -> Paid -> Accepted        (happy path, 4 steps)
--   Failed / Refunded / Voided / Disputed            (exceptions)
--
-- The two payment mechanisms reach that timeline differently, not by
-- accident but because "Paid" and "Accepted" mean genuinely different
-- things depending on who confirms them:
--
--   Card/ACH (Stripe): a successful charge IS acceptance -- there's no
--   human on the other end to separately confirm receipt, so paid_at and
--   accepted_at land in the same instant the charge succeeds.
--
--   Check/wire/cash: the brand recording a payment is not proof it
--   arrived -- status stays 'pending' (not 'paid') until the receiving
--   agency confirms it themselves via confirm_manual_payment(). At that
--   point paid_at and accepted_at both land together too, since a manual
--   payment has no separate processor-confirmed "paid" moment of its
--   own -- the recipient's confirmation is the only real signal DVURE
--   has, and it stands in for both.
--
-- created_at already serves as "Initiated" (always set on insert,
-- 0023) and paid_at already exists (0023) -- only the states without an
-- existing timestamp column are added here.
create type payment_lifecycle_status as enum (
  'initiated', 'pending', 'paid', 'accepted',
  'failed', 'refunded', 'voided', 'disputed'
);

alter table invoices
  add column pending_at timestamptz,
  add column accepted_at timestamptz,
  add column failed_at timestamptz,
  add column refunded_at timestamptz,
  add column disputed_at timestamptz;

-- Remap the old 4 values onto the new 8-value vocabulary 1:1 -- nothing
-- other than record_manual_payment/confirm_manual_payment/
-- void_manual_payment (0046, redefined below) has ever written or read
-- this column, so this is a clean move, not a lossy one.
alter table invoices alter column status drop default;
alter table invoices alter column status type payment_lifecycle_status using (
  case status::text
    when 'pending'  then 'pending'
    when 'paid'     then 'accepted'
    when 'failed'   then 'failed'
    when 'canceled' then 'voided'
  end
)::payment_lifecycle_status;
alter table invoices alter column status set default 'initiated';

drop type invoice_status;

-- record_manual_payment: a manual payment has no separate "initiated
-- then pending" gap (recording it IS submitting it), so this sets
-- status/pending_at directly rather than leaving a moment at
-- 'initiated' first.
create or replace function record_manual_payment(
  p_campaign_id uuid,
  p_agency_org_id uuid,
  p_amount numeric,
  p_method text,
  p_reference_note text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_brand_org_id uuid;
  v_invoice_id uuid;
begin
  if p_method not in ('check','wire','cash') then
    raise exception 'record_manual_payment: % is not a manual payment method', p_method;
  end if;
  if p_amount <= 0 then
    raise exception 'record_manual_payment: amount must be positive';
  end if;

  select brand_org_id into v_brand_org_id from campaigns where id = p_campaign_id;
  if v_brand_org_id is null then
    raise exception 'record_manual_payment: campaign % not found', p_campaign_id;
  end if;
  if v_brand_org_id is distinct from my_org_id() then
    raise exception 'record_manual_payment: caller does not belong to this campaign''s brand org';
  end if;

  insert into invoices (brand_org_id, campaign_id, status, pending_at, total_amount, payment_method, reference_note, created_by_profile_id)
  values (v_brand_org_id, p_campaign_id, 'pending', now(), p_amount, p_method, nullif(trim(p_reference_note), ''), auth.uid())
  returning id into v_invoice_id;

  insert into invoice_line_items (invoice_id, payee_org_id, gross_amount, payout_amount, transfer_status)
  values (v_invoice_id, p_agency_org_id, p_amount, p_amount, 'pending');

  return v_invoice_id;
end;
$$;

-- confirm_manual_payment: paid_at and accepted_at land together here --
-- see the migration header for why a manual payment has no earlier,
-- separate "paid" moment of its own.
create or replace function confirm_manual_payment(p_invoice_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status payment_lifecycle_status;
  v_method text;
  v_all_confirmed boolean;
begin
  select status, payment_method into v_status, v_method from invoices where id = p_invoice_id;
  if v_status is null then
    raise exception 'confirm_manual_payment: invoice % not found', p_invoice_id;
  end if;
  if v_method = 'card' then
    raise exception 'confirm_manual_payment: card invoices are not manually confirmed';
  end if;
  if v_status <> 'pending' then
    raise exception 'confirm_manual_payment: invoice is % — only a pending payment can be confirmed', v_status;
  end if;
  if not exists (select 1 from invoice_line_items where invoice_id = p_invoice_id and payee_org_id = my_org_id()) then
    raise exception 'confirm_manual_payment: caller''s org is not a payee on this invoice';
  end if;

  update invoice_line_items
  set payee_confirmed_at = now(), payee_confirmed_by_profile_id = auth.uid(), transfer_status = 'transferred'
  where invoice_id = p_invoice_id and payee_org_id = my_org_id();

  select bool_and(payee_confirmed_at is not null) into v_all_confirmed
  from invoice_line_items where invoice_id = p_invoice_id;

  if v_all_confirmed then
    update invoices set status = 'accepted', paid_at = now(), accepted_at = now() where id = p_invoice_id;
  end if;
end;
$$;

-- void_manual_payment: status value renamed ('canceled' -> 'voided'),
-- behavior unchanged -- still locked to 'pending' only, still requires a
-- reason, still recorded on the invoice itself (voided_at/
-- voided_by_profile_id/void_reason, 0046) as the audit trail.
create or replace function void_manual_payment(p_invoice_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_brand_org_id uuid;
  v_status payment_lifecycle_status;
  v_method text;
begin
  select brand_org_id, status, payment_method into v_brand_org_id, v_status, v_method
  from invoices where id = p_invoice_id;
  if v_brand_org_id is null then
    raise exception 'void_manual_payment: invoice % not found', p_invoice_id;
  end if;
  if v_brand_org_id is distinct from my_org_id() then
    raise exception 'void_manual_payment: caller does not belong to this invoice''s brand org';
  end if;
  if v_method = 'card' then
    raise exception 'void_manual_payment: card invoices are not voided this way';
  end if;
  if v_status <> 'pending' then
    raise exception 'void_manual_payment: invoice is % — only a pending (unconfirmed) payment can be voided', v_status;
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'void_manual_payment: a reason is required';
  end if;

  update invoices
  set status = 'voided', voided_at = now(), voided_by_profile_id = auth.uid(), void_reason = trim(p_reason)
  where id = p_invoice_id;
end;
$$;
