-- Real bug, not hypothetical: create-invoice-payment always recomputed
-- each payee group's amount fresh from the raw booking rows (correct
-- for a brand-new invoice, wrong the moment ANY prior payment —
-- manual or electronic — already exists against that same invoice).
-- A booking worth $980 with $100 already paid by check would still
-- try to charge $980 by card, tripping the remaining-balance guard at
-- $880. The RPC becomes the sole source of truth for "how much is
-- actually owed right now" instead of trusting a client-recomputed
-- gross — the same "never trust the client for money" posture this
-- whole payment system already uses everywhere else.
drop function reserve_invoice_for_card_payment(uuid, numeric, numeric, uuid, uuid, uuid);

create or replace function reserve_invoice_for_card_payment(
  p_campaign_id uuid,
  p_invoice_total numeric,
  p_agency_org_id uuid default null,
  p_model_id uuid default null,
  p_crew_payee_id uuid default null
)
returns table(invoice_id uuid, remaining_amount numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_brand_org_id uuid;
  v_invoice_id uuid;
  v_total numeric;
  v_remaining numeric;
  v_payee_count int;
  v_is_independent boolean;
begin
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

  if v_remaining <= 0 then
    raise exception 'reserve_invoice_for_card_payment: this invoice has no remaining balance — it may already be fully paid or reserved by another payment in progress';
  end if;

  return query select v_invoice_id, v_remaining;
end;
$$;

revoke all on function reserve_invoice_for_card_payment(uuid, numeric, uuid, uuid, uuid) from public;
grant execute on function reserve_invoice_for_card_payment(uuid, numeric, uuid, uuid, uuid) to authenticated;
