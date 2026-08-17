-- Contracts today are brand-only, both at the UI layer (ModelApp has no
-- Contracts screen) and the RLS layer (contracts_select is
-- is_campaigns_brand() only -- a model has zero read access to their
-- own contract, confirmed by reading 0032 directly). Fixing both.
--
-- markContractExecuted (contracts.ts) is a deliberate external-
-- attestation design -- "signature happened outside the system" -- not
-- an in-app sign flow. That stays as-is for brand-recorded executions
-- (paper/DocuSign/email). This adds a second, real path: a model typing
-- their legal name in-app against their own awaiting_signature
-- contract. Two distinct signature columns (model_signature_name vs.
-- the pre-existing executed_at/status pair) so a brand-recorded
-- execution is never confused with a model's own in-app signature.

alter table contracts add column model_signature_name text;
alter table contracts add column signed_by_model_at timestamptz;

-- A model can see their own contracts, in addition to the brand that
-- owns the campaign. Kept as a separate USING branch (not folded into
-- is_campaigns_brand) since that function is brand-relationship-only by
-- design elsewhere in the schema.
create policy contracts_select_own_model on contracts for select using (
  model_id = my_model_id()
);

-- The model's own in-app signature. security definer since contracts
-- has no model-facing UPDATE policy (and shouldn't get one -- a model
-- should only ever be able to move their own awaiting_signature
-- contract to fully_executed by signing, never edit rate/territory/
-- duration/etc.). Re-validates ownership and status server-side rather
-- than trusting the client.
create or replace function sign_contract_as_model(p_contract_id uuid, p_typed_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_model_id uuid;
  v_campaign_id uuid;
  v_status contract_status;
begin
  if trim(coalesce(p_typed_name, '')) = '' then
    raise exception 'Type your full legal name to sign.';
  end if;

  select model_id, campaign_id, status into v_model_id, v_campaign_id, v_status
  from contracts where id = p_contract_id;

  if v_model_id is null then
    raise exception 'Contract not found.';
  end if;
  if v_model_id <> my_model_id() then
    raise exception 'Not your contract.';
  end if;
  if v_status <> 'awaiting_signature' then
    raise exception 'This contract isn''t awaiting your signature.';
  end if;

  update contracts set
    model_signature_name = trim(p_typed_name),
    signed_by_model_at = now(),
    status = 'fully_executed',
    executed_at = now()
  where id = p_contract_id;

  perform record_audit_event(
    p_action := 'contract.signed_by_model',
    p_object_type := 'contract',
    p_object_id := p_contract_id,
    p_campaign_id := v_campaign_id,
    p_new_value := jsonb_build_object('model_signature_name', trim(p_typed_name))
  );
end;
$$;

revoke all on function sign_contract_as_model(uuid, text) from public;
grant execute on function sign_contract_as_model(uuid, text) to authenticated;
