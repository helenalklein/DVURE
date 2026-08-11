-- 90-day account lock: once DVURE's non-circumvention platform-fee
-- invoice for an org goes unpaid 90 days after it was sent, no more
-- payments can be made until it's paid. Anchored on when DVURE
-- invoiced them, not Stripe's own 14-day "please pay soon" due date on
-- that invoice, which stays a separate, softer reminder cadence — one
-- clear 90-day runway, not two overlapping timers.
alter table invoice_payments
  add column noncircumvention_invoice_created_at timestamptz,
  add column noncircumvention_invoice_paid_at timestamptz;

alter table organizations
  add column payment_locked boolean not null default false;

grant update (noncircumvention_invoice_created_at, noncircumvention_invoice_paid_at) on invoice_payments to service_role;
grant update (payment_locked) on organizations to service_role;

-- Re-derived from scratch each run rather than incrementally toggled,
-- so a manually-corrected invoice_payments row (e.g. a void) self-heals
-- the lock on the next run without needing its own separate unlock
-- code path. Called both by the daily cron below and by
-- stripe-webhook's invoice.paid handler for an immediate unlock.
create or replace function lock_overdue_accounts()
returns void
language plpgsql security definer set search_path = public as $$
begin
  update organizations o set payment_locked = true
  where payment_locked = false and exists (
    select 1 from invoice_payments ip join invoices i on i.id = ip.invoice_id
    where i.brand_org_id = o.id
      and ip.noncircumvention_invoice_created_at is not null
      and ip.noncircumvention_invoice_paid_at is null
      and ip.noncircumvention_invoice_created_at < now() - interval '90 days'
  );
  update organizations o set payment_locked = false
  where payment_locked = true and not exists (
    select 1 from invoice_payments ip join invoices i on i.id = ip.invoice_id
    where i.brand_org_id = o.id
      and ip.noncircumvention_invoice_created_at is not null
      and ip.noncircumvention_invoice_paid_at is null
      and ip.noncircumvention_invoice_created_at < now() - interval '90 days'
  );
end;
$$;

revoke all on function lock_overdue_accounts() from public;
grant execute on function lock_overdue_accounts() to service_role;

create extension if not exists pg_cron;
select cron.schedule('lock-overdue-accounts-daily', '0 6 * * *', $$select lock_overdue_accounts();$$);

-- Enforcement lives at the actual write path, not just the UI —
-- both payment-creation RPCs now reject a locked org's brand outright,
-- so a locked account can't make a payment even by going around the
-- disabled button client-side. Full bodies re-stated (create or
-- replace requires it), unchanged except for the one new check.
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
  if exists (select 1 from organizations where id = v_brand_org_id and payment_locked) then
    raise exception 'record_invoice_payment: this account is locked — pay the outstanding platform fee invoice to resume making payments';
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
  if exists (select 1 from organizations where id = v_brand_org_id and payment_locked) then
    raise exception 'reserve_invoice_for_card_payment: this account is locked — pay the outstanding platform fee invoice to resume making payments';
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
