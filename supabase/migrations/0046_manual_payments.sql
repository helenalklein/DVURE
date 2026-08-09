-- Check/wire/cash payments. These never touch a processor, so they
-- don't belong on the card-authorization path (still 100% mock — no
-- Stripe key exists yet). But "the recipient has to reconcile it, so we
-- know it took place" only means something if it's real and persisted,
-- so this rides on the real invoices/invoice_line_items tables from
-- 0023 rather than inventing a parallel ledger:
--
--   invoices           — one row per manual payment the brand records.
--   invoice_line_items — one row per agency being paid by it. A manual
--     payment always has exactly one payee today (you write one check
--     or send one wire to one agency), unlike a future card invoice
--     that can bundle several bookings/payees at once — the schema
--     already supports that multi-payee case, this just doesn't use it
--     yet.
--
-- booking_id on invoice_line_items was NOT NULL — fine for a card
-- invoice built from specific outstanding bookings, but a manual
-- payment records "we paid this agency this amount for this campaign,"
-- not a specific pre-existing booking row (most campaigns don't have
-- real bookings seeded yet). Making it nullable is the minimal schema
-- change that fits both cases without forcing manual payments through
-- booking selection UI that has nothing real to select from today.
alter table invoice_line_items alter column booking_id drop not null;

-- reconciliation: the payee org confirming the money actually arrived.
alter table invoice_line_items
  add column payee_confirmed_at timestamptz,
  add column payee_confirmed_by_profile_id uuid references profiles(id);

-- payment_method: kept as a plain checked text column rather than a new
-- enum, since 'card' also has to be a valid value here for forward
-- compatibility with the real Stripe invoice path once that's wired,
-- and a text+check constraint is one statement instead of a type
-- creation the card path doesn't populate yet anyway.
alter table invoices
  add column payment_method text not null default 'card'
    check (payment_method in ('card','check','wire','cash')),
  add column reference_note text,
  add column voided_at timestamptz,
  add column voided_by_profile_id uuid references profiles(id),
  add column void_reason text;

-- void reuses invoice_status's existing 'canceled' value rather than
-- adding a new enum member — nothing reads invoice_status yet (this
-- table has never been wired to a UI), so there's no existing meaning
-- to collide with, and 'canceled' already reads correctly as "this
-- payment didn't happen." voided_at/by/reason carry the actual detail.

-- Brand records a manual payment to one agency for a campaign. Same
-- posture as record_payment_attempt() (0014): invoices/invoice_line_items
-- have no direct-write policy, every write goes through a security
-- definer RPC that checks real org membership itself.
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

  insert into invoices (brand_org_id, campaign_id, status, total_amount, payment_method, reference_note, created_by_profile_id)
  values (v_brand_org_id, p_campaign_id, 'pending', p_amount, p_method, nullif(trim(p_reference_note), ''), auth.uid())
  returning id into v_invoice_id;

  insert into invoice_line_items (invoice_id, payee_org_id, gross_amount, payout_amount, transfer_status)
  values (v_invoice_id, p_agency_org_id, p_amount, p_amount, 'pending');

  return v_invoice_id;
end;
$$;

revoke all on function record_manual_payment(uuid, uuid, numeric, text, text) from public;
grant execute on function record_manual_payment(uuid, uuid, numeric, text, text) to authenticated;

-- Agency confirms receipt. Once every line item on the invoice is
-- confirmed, the invoice itself flips to 'paid' — for today's
-- one-payee-per-manual-payment case that's immediate, but the check
-- still walks all line items so this keeps working if a manual payment
-- ever does span more than one agency.
create or replace function confirm_manual_payment(p_invoice_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status invoice_status;
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
    update invoices set status = 'paid', paid_at = now() where id = p_invoice_id;
  end if;
end;
$$;

revoke all on function confirm_manual_payment(uuid) from public;
grant execute on function confirm_manual_payment(uuid) to authenticated;

-- Brand voids a mis-recorded manual payment. Locked to 'pending' only —
-- once the agency has confirmed receipt (status='paid'), the money may
-- have actually moved, so silently erasing that record isn't safe; a
-- correction after that point is a separate, not-yet-built process.
create or replace function void_manual_payment(p_invoice_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_brand_org_id uuid;
  v_status invoice_status;
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
  set status = 'canceled', voided_at = now(), voided_by_profile_id = auth.uid(), void_reason = trim(p_reason)
  where id = p_invoice_id;
end;
$$;

revoke all on function void_manual_payment(uuid, text) from public;
grant execute on function void_manual_payment(uuid, text) to authenticated;
