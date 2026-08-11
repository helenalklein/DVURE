-- Signature attestation captured at manual-payment confirmation time --
-- a typed full legal name + timestamp, the same "record intent,
-- consent, and identity" pattern any e-signature must satisfy under
-- ESIGN/UETA, not a drawn image. Nullable only because it can't be
-- backfilled onto payments confirmed before this column existed.
alter table invoice_payments
  add column signature_name text,
  add column signature_captured_at timestamptz;

-- confirm_invoice_payment now requires the signature inline rather than
-- as a separate follow-up write, so a confirmation can never exist
-- without one from this point on. The 1-arg version is dropped, not
-- kept as a fallback -- every caller (Agency/Model/Crew confirm
-- queues) is updated in the same change as this migration.
drop function confirm_invoice_payment(uuid);

create or replace function confirm_invoice_payment(p_payment_id uuid, p_signature_name text)
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
  if p_signature_name is null or trim(p_signature_name) = '' then
    raise exception 'confirm_invoice_payment: a signature (typed full name) is required';
  end if;

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
  set status = 'accepted', accepted_at = now(), paid_at = now(),
      payee_confirmed_by_profile_id = auth.uid(),
      signature_name = trim(p_signature_name), signature_captured_at = now()
  where id = p_payment_id;
end;
$$;

revoke all on function confirm_invoice_payment(uuid, text) from public;
grant execute on function confirm_invoice_payment(uuid, text) to authenticated;
