-- Splits "invoice" (what's owed) from "payment" (an event applied
-- against it). Until now record_manual_payment created one new
-- `invoices` row per payment (0046/0047/0051) -- fine when a payee was
-- always paid in one shot, but there was no way to record 20 separate
-- payments against one booking and see them as a trail, only 20
-- unrelated invoices. New `invoice_payments` holds the events; `invoices`
-- becomes the fixed-total bill they're applied against, and its own
-- status is now DERIVED from those events rather than set directly.
--
-- Decided with the user: an invoice's total_amount is fixed at creation
-- (the full amount owed), not a running tally with no target -- so
-- "partially paid" is a real, meaningful state. Invoices are still
-- created automatically (no new "generate invoice" step): the first
-- payment recorded against a payee who doesn't have an open invoice yet
-- creates one, with the total supplied by the caller (the same
-- booking/crew-rate amount fetchOutstandingPayees already computes).
--
-- Written idempotent throughout (IF EXISTS / IF NOT EXISTS, guarded
-- backfill, DO-block type creation) so a failed partial run can just be
-- re-run from the top rather than requiring manual cleanup first.

create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_method text not null check (payment_method in ('card','check','wire','cash')),
  reference_note text,
  status payment_lifecycle_status not null default 'pending',
  created_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  pending_at timestamptz,
  accepted_at timestamptz,
  paid_at timestamptz,
  payee_confirmed_by_profile_id uuid references profiles(id),
  voided_at timestamptz,
  voided_by_profile_id uuid references profiles(id),
  void_reason text
);
create index if not exists invoice_payments_invoice_idx on invoice_payments (invoice_id);

-- Backfill: every invoice ever created (manual payments only -- card has
-- never been wired to a real charge) becomes its own single payment
-- event, carrying over its full history so nothing already recorded is
-- lost. Guarded two ways: skipped entirely once invoices.payment_method
-- no longer exists (the rest of this migration already ran and dropped
-- it), and per-row NOT EXISTS so a partial rerun never double-inserts.
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'payment_method') then
    insert into invoice_payments (
      invoice_id, amount, payment_method, reference_note, status,
      created_by_profile_id, created_at, pending_at, accepted_at, paid_at,
      payee_confirmed_by_profile_id, voided_at, voided_by_profile_id, void_reason
    )
    select
      i.id, i.total_amount, i.payment_method, i.reference_note, i.status,
      i.created_by_profile_id, i.created_at, i.pending_at, i.accepted_at, i.paid_at,
      (select li.payee_confirmed_by_profile_id from invoice_line_items li where li.invoice_id = i.id limit 1),
      i.voided_at, i.voided_by_profile_id, i.void_reason
    from invoices i
    where i.payment_method <> 'card'
      and not exists (select 1 from invoice_payments p where p.invoice_id = i.id);
  end if;
end $$;

-- invoices.status changes meaning: was "this one payment's lifecycle,"
-- becomes "this bill's balance, derived from its accepted payments."
-- 'voided' drops out at this level entirely -- a voided *payment* just
-- never counted toward the balance; if every payment on an invoice ends
-- up voided, that invoice is simply outstanding again, not in some
-- separate voided state of its own.
do $$
begin
  create type invoice_balance_status as enum ('outstanding', 'partially_paid', 'paid');
exception when duplicate_object then null;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'payment_method') then
    -- Old schema still present -- do the one-time column swap.
    alter table invoices add column if not exists balance_status invoice_balance_status;
    update invoices set balance_status = (case when status = 'accepted' then 'paid' else 'outstanding' end)::invoice_balance_status
      where balance_status is null;
    alter table invoices alter column balance_status set not null;
    alter table invoices alter column balance_status set default 'outstanding';

    alter table invoices
      drop column if exists status,
      drop column if exists payment_method,
      drop column if exists reference_note,
      drop column if exists voided_at,
      drop column if exists voided_by_profile_id,
      drop column if exists void_reason,
      drop column if exists pending_at,
      drop column if exists accepted_at,
      drop column if exists paid_at,
      drop column if exists failed_at,
      drop column if exists refunded_at,
      drop column if exists disputed_at;
    alter table invoices rename column balance_status to status;
  end if;
end $$;

-- Superseded by invoice_payments.payee_confirmed_by_profile_id -- a
-- payee confirms each payment as it lands, not the line item once.
alter table invoice_line_items
  drop column if exists payee_confirmed_at,
  drop column if exists payee_confirmed_by_profile_id;

-- Keeps invoices.status in sync with its payments on every insert/
-- update/delete -- callers never set it directly, it's a pure function
-- of (total_amount, sum of accepted payments).
create or replace function recompute_invoice_status()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_invoice_id uuid := coalesce(new.invoice_id, old.invoice_id);
  v_total numeric;
  v_accepted numeric;
begin
  select total_amount into v_total from invoices where id = v_invoice_id;
  select coalesce(sum(amount), 0) into v_accepted
  from invoice_payments where invoice_id = v_invoice_id and status = 'accepted';

  update invoices set status = (case
    when v_accepted <= 0 then 'outstanding'
    when v_accepted >= v_total then 'paid'
    else 'partially_paid'
  end)::invoice_balance_status
  where id = v_invoice_id;

  return null;
end;
$$;

drop trigger if exists invoice_payments_status_sync on invoice_payments;
create trigger invoice_payments_status_sync
after insert or update or delete on invoice_payments
for each row execute function recompute_invoice_status();

-- One-time sync so every backfilled invoice's status reflects the
-- trigger's own logic exactly, not just the simpler case statement used
-- to seed it above.
update invoices i set status = (case
  when (select coalesce(sum(amount), 0) from invoice_payments p where p.invoice_id = i.id and p.status = 'accepted') <= 0 then 'outstanding'
  when (select coalesce(sum(amount), 0) from invoice_payments p where p.invoice_id = i.id and p.status = 'accepted') >= i.total_amount then 'paid'
  else 'partially_paid'
end)::invoice_balance_status;

alter table invoice_payments enable row level security;
drop policy if exists invoice_payments_select on invoice_payments;
create policy invoice_payments_select on invoice_payments for select using (
  invoice_brand_org(invoice_id) = my_org_id()
  or exists (
    select 1 from invoice_line_items li
    where li.invoice_id = invoice_payments.invoice_id
      and (li.payee_org_id = my_org_id() or li.payee_model_id = my_model_id() or li.payee_crew_payee_id = my_crew_payee_id())
  )
);
grant select on invoice_payments to authenticated;

-- record_manual_payment -> record_invoice_payment: finds the payee's
-- existing open invoice for this campaign (status <> 'paid') and adds a
-- payment to it, or creates one if none exists yet. p_invoice_total is
-- only used when a new invoice is actually created (the full amount
-- owed -- fetchOutstandingPayees' own computed figure); it's ignored on
-- a repeat call against an already-open invoice, so total_amount can't
-- drift out from under a partially-paid bill.
create or replace function record_invoice_payment(
  p_campaign_id uuid,
  p_invoice_total numeric,
  p_amount numeric,
  p_method text,
  p_reference_note text default null,
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
  v_payment_id uuid;
begin
  if p_method not in ('check','wire','cash') then
    raise exception 'record_invoice_payment: % is not a manual payment method', p_method;
  end if;
  if p_amount <= 0 then
    raise exception 'record_invoice_payment: amount must be positive';
  end if;
  if p_invoice_total <= 0 then
    raise exception 'record_invoice_payment: invoice total must be positive';
  end if;

  v_payee_count := (p_agency_org_id is not null)::int + (p_model_id is not null)::int + (p_crew_payee_id is not null)::int;
  if v_payee_count <> 1 then
    raise exception 'record_invoice_payment: exactly one payee must be specified';
  end if;

  if p_model_id is not null then
    select is_independent into v_is_independent from model_profiles where id = p_model_id;
    if v_is_independent is not true then
      raise exception 'record_invoice_payment: model % is not independent — pay through their agency', p_model_id;
    end if;
  end if;

  select brand_org_id into v_brand_org_id from campaigns where id = p_campaign_id;
  if v_brand_org_id is null then
    raise exception 'record_invoice_payment: campaign % not found', p_campaign_id;
  end if;
  if v_brand_org_id is distinct from my_org_id() then
    raise exception 'record_invoice_payment: caller does not belong to this campaign''s brand org';
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
    raise exception 'record_invoice_payment: amount % exceeds remaining balance %', p_amount, v_remaining;
  end if;

  insert into invoice_payments (invoice_id, amount, payment_method, reference_note, status, created_by_profile_id, pending_at)
  values (v_invoice_id, p_amount, p_method, nullif(trim(p_reference_note), ''), 'pending', auth.uid(), now())
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all on function record_invoice_payment(uuid, numeric, numeric, text, text, uuid, uuid, uuid) from public;
grant execute on function record_invoice_payment(uuid, numeric, numeric, text, text, uuid, uuid, uuid) to authenticated;

-- confirm_manual_payment -> confirm_invoice_payment: confirms one
-- payment event, not a whole invoice -- the trigger above rolls that up
-- into the invoice's balance automatically.
create or replace function confirm_invoice_payment(p_payment_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_invoice_id uuid;
  v_status payment_lifecycle_status;
  v_method text;
  v_my_org uuid := my_org_id();
  v_my_model uuid := my_model_id();
  v_my_crew uuid := my_crew_payee_id();
begin
  select invoice_id, status, payment_method into v_invoice_id, v_status, v_method
  from invoice_payments where id = p_payment_id;
  if v_invoice_id is null then
    raise exception 'confirm_invoice_payment: payment % not found', p_payment_id;
  end if;
  if v_method = 'card' then
    raise exception 'confirm_invoice_payment: card payments are not manually confirmed';
  end if;
  if v_status <> 'pending' then
    raise exception 'confirm_invoice_payment: payment is % — only a pending payment can be confirmed', v_status;
  end if;
  if not exists (
    select 1 from invoice_line_items
    where invoice_id = v_invoice_id
      and (payee_org_id = v_my_org or payee_model_id = v_my_model or payee_crew_payee_id = v_my_crew)
  ) then
    raise exception 'confirm_invoice_payment: caller is not a payee on this invoice';
  end if;

  update invoice_payments
  set status = 'accepted', accepted_at = now(), paid_at = now(), payee_confirmed_by_profile_id = auth.uid()
  where id = p_payment_id;
end;
$$;

revoke all on function confirm_invoice_payment(uuid) from public;
grant execute on function confirm_invoice_payment(uuid) to authenticated;

-- void_manual_payment -> void_invoice_payment: same "pending only, reason
-- required" rule, now scoped to one payment event.
create or replace function void_invoice_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_invoice_id uuid;
  v_brand_org_id uuid;
  v_status payment_lifecycle_status;
  v_method text;
begin
  select invoice_id, status, payment_method into v_invoice_id, v_status, v_method
  from invoice_payments where id = p_payment_id;
  if v_invoice_id is null then
    raise exception 'void_invoice_payment: payment % not found', p_payment_id;
  end if;

  select brand_org_id into v_brand_org_id from invoices where id = v_invoice_id;
  if v_brand_org_id is distinct from my_org_id() then
    raise exception 'void_invoice_payment: caller does not belong to this invoice''s brand org';
  end if;
  if v_method = 'card' then
    raise exception 'void_invoice_payment: card payments are not voided this way';
  end if;
  if v_status <> 'pending' then
    raise exception 'void_invoice_payment: payment is % — only a pending (unconfirmed) payment can be voided', v_status;
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'void_invoice_payment: a reason is required';
  end if;

  update invoice_payments
  set status = 'voided', voided_at = now(), voided_by_profile_id = auth.uid(), void_reason = trim(p_reason)
  where id = p_payment_id;
end;
$$;

revoke all on function void_invoice_payment(uuid, text) from public;
grant execute on function void_invoice_payment(uuid, text) to authenticated;

-- Old per-invoice RPCs are fully superseded -- every call site moves to
-- the per-payment versions above.
drop function if exists record_manual_payment(uuid, numeric, text, text, uuid, uuid, uuid);
drop function if exists confirm_manual_payment(uuid);
drop function if exists void_manual_payment(uuid, text);
