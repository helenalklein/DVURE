-- The e-signature name-match check (added after this contract was
-- signed) would have caught this: Elena Marsh's contract CF-2026-0003
-- on AW25 Womenswear Campaign was signed with the typed name "Eleven
-- Marsh" -- a real typo that got through under the old, unvalidated
-- flow. Resetting it back to awaiting_signature so she can re-sign
-- correctly under the new check. Scoped to this exact contract number
-- so it can't touch any other contract.
update contracts set
  status = 'awaiting_signature',
  model_signature_name = null,
  signed_by_model_at = null,
  executed_at = null
where contract_number = 'CF-2026-0003';
