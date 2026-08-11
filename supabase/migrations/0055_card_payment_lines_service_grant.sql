-- 0054 enabled RLS on invoice_card_payment_lines but never granted the
-- service role actual table privileges -- service_role bypasses RLS by
-- default, but that's separate from base table GRANTs, which Postgres
-- still enforces. The Edge Functions (create-invoice-payment,
-- stripe-webhook) write to this table directly via the service-role
-- client, not through a security-definer RPC (which would've inherited
-- the function owner's privileges instead) -- confirmed live via
-- "permission denied for table invoice_card_payment_lines" on the first
-- real end-to-end test.
grant select, insert, delete on invoice_card_payment_lines to service_role;
