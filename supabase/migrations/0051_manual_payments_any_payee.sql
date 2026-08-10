-- Cash (and check/wire) needs to work for a payment to anyone the brand
-- owes money to directly, not just an agency: a crew member, or an
-- independent model. Generalizes invoice_line_items' payee from "always
-- an agency org" to exactly one of three kinds -- an org (agency, for a
-- repped model), a model (independent, no agency in the middle), or a
-- crew payee. This mirrors exactly how bookings already distinguishes
-- these cases (agency_org_id nullable since 0049).
alter table invoice_line_items
  alter column payee_org_id drop not null,
  add column payee_model_id uuid references model_profiles(id),
  add column payee_crew_payee_id uuid references crew_payees(id),
  add constraint invoice_line_items_one_payee check (
    (payee_org_id is not null)::int
    + (payee_model_id is not null)::int
    + (payee_crew_payee_id is not null)::int = 1
  );

create or replace function my_crew_payee_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from crew_payees where profile_id = auth.uid();
$$;

-- Per-slot rate — belongs to campaign_crew_slots (this specific role on
-- this specific campaign), not crew_payees itself (the same photographer
-- charges differently job to job). Editable by production up to and
-- after the shoot for as long as the campaign stays open -- direct
-- decision, deliberately looser than the model rate workflow, which
-- locks at booking.
alter table campaign_crew_slots add column rate numeric;

create or replace function update_crew_slot_rate(p_campaign_id uuid, p_role_key text, p_rate numeric)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_campaigns_brand(p_campaign_id) then
    raise exception 'update_crew_slot_rate: caller does not belong to this campaign''s brand org';
  end if;
  if p_rate is not null and p_rate < 0 then
    raise exception 'update_crew_slot_rate: rate cannot be negative';
  end if;

  update campaign_crew_slots set rate = p_rate
  where campaign_id = p_campaign_id and role_key = p_role_key;

  if not found then
    raise exception 'update_crew_slot_rate: no slot % on campaign %', p_role_key, p_campaign_id;
  end if;
end;
$$;

revoke all on function update_crew_slot_rate(uuid, text, numeric) from public;
grant execute on function update_crew_slot_rate(uuid, text, numeric) to authenticated;

-- record_manual_payment generalizes to any one of the three payee kinds
-- — exactly one of p_agency_org_id / p_model_id / p_crew_payee_id must
-- be passed. Independent models get the same "is this actually who you
-- say" check bookings/submissions already apply; crew and agency payees
-- are trusted the same way this RPC always has (caller must belong to
-- the campaign's brand org).
create or replace function record_manual_payment(
  p_campaign_id uuid,
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
  v_payee_count int;
  v_is_independent boolean;
begin
  if p_method not in ('check','wire','cash') then
    raise exception 'record_manual_payment: % is not a manual payment method', p_method;
  end if;
  if p_amount <= 0 then
    raise exception 'record_manual_payment: amount must be positive';
  end if;

  v_payee_count := (p_agency_org_id is not null)::int + (p_model_id is not null)::int + (p_crew_payee_id is not null)::int;
  if v_payee_count <> 1 then
    raise exception 'record_manual_payment: exactly one payee must be specified';
  end if;

  if p_model_id is not null then
    select is_independent into v_is_independent from model_profiles where id = p_model_id;
    if v_is_independent is not true then
      raise exception 'record_manual_payment: model % is not independent — pay through their agency', p_model_id;
    end if;
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

  insert into invoice_line_items (invoice_id, payee_org_id, payee_model_id, payee_crew_payee_id, gross_amount, payout_amount, transfer_status)
  values (v_invoice_id, p_agency_org_id, p_model_id, p_crew_payee_id, p_amount, p_amount, 'pending');

  return v_invoice_id;
end;
$$;

revoke all on function record_manual_payment(uuid, numeric, text, text, uuid, uuid, uuid) from public;
grant execute on function record_manual_payment(uuid, numeric, text, text, uuid, uuid, uuid) to authenticated;

-- Old 5-arg signature (0046/0047) is superseded by the 7-arg one above —
-- drop it so PostgREST doesn't have two overloads with an ambiguous call
-- shape for existing callers passing p_agency_org_id positionally.
drop function if exists record_manual_payment(uuid, uuid, numeric, text, text);

-- confirm_manual_payment: "am I the payee" now checks all three kinds.
create or replace function confirm_manual_payment(p_invoice_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status payment_lifecycle_status;
  v_method text;
  v_all_confirmed boolean;
  v_my_org uuid := my_org_id();
  v_my_model uuid := my_model_id();
  v_my_crew uuid := my_crew_payee_id();
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
  if not exists (
    select 1 from invoice_line_items
    where invoice_id = p_invoice_id
      and (payee_org_id = v_my_org or payee_model_id = v_my_model or payee_crew_payee_id = v_my_crew)
  ) then
    raise exception 'confirm_manual_payment: caller is not a payee on this invoice';
  end if;

  update invoice_line_items
  set payee_confirmed_at = now(), payee_confirmed_by_profile_id = auth.uid(), transfer_status = 'transferred'
  where invoice_id = p_invoice_id
    and (payee_org_id = v_my_org or payee_model_id = v_my_model or payee_crew_payee_id = v_my_crew);

  select bool_and(payee_confirmed_at is not null) into v_all_confirmed
  from invoice_line_items where invoice_id = p_invoice_id;

  if v_all_confirmed then
    update invoices set status = 'accepted', paid_at = now(), accepted_at = now() where id = p_invoice_id;
  end if;
end;
$$;

-- invoices_select/invoice_line_items_select (0023, recursion fixed 0050)
-- only ever checked payee_org_id — a crew payee or independent model
-- could never see their own manual payments at all. Same security
-- definer pattern as invoice_has_payee_org (0050), extended to all three
-- payee kinds, so this doesn't reopen the recursion that fix closed.
create or replace function invoice_has_payee(p_invoice_id uuid, p_org_id uuid, p_model_id uuid, p_crew_payee_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from invoice_line_items li
    where li.invoice_id = p_invoice_id
      and ((p_org_id is not null and li.payee_org_id = p_org_id)
        or (p_model_id is not null and li.payee_model_id = p_model_id)
        or (p_crew_payee_id is not null and li.payee_crew_payee_id = p_crew_payee_id))
  );
$$;

drop policy invoices_select on invoices;
create policy invoices_select on invoices for select using (
  brand_org_id = my_org_id()
  or invoice_has_payee(id, my_org_id(), my_model_id(), my_crew_payee_id())
);

drop policy invoice_line_items_select on invoice_line_items;
create policy invoice_line_items_select on invoice_line_items for select using (
  payee_org_id = my_org_id()
  or payee_model_id = my_model_id()
  or payee_crew_payee_id = my_crew_payee_id()
  or invoice_brand_org(invoice_id) = my_org_id()
);
