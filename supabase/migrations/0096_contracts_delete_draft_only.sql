-- contracts (0032) was never granted DELETE at all -- not a deliberate
-- "protect signed documents" design, just an absent grant, full stop.
-- Adding it now scoped specifically to draft, never-sent contracts:
-- once a contract has been sent (awaiting_signature) or executed
-- (fully_executed), it's a real record — sent_at/executed_at/
-- model_signature_name are exactly the kind of thing that shouldn't be
-- destroyable from the app, and in the executed case is a legal
-- document that has to be retained regardless. A draft nobody has ever
-- seen carries none of that weight.
create policy contracts_delete_draft_only on contracts for delete using (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced') and status = 'draft'
);

grant delete on contracts to authenticated;
