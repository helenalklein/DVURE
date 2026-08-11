-- stripe-webhook's admin client reads `invoices` and reads/writes
-- `invoice_line_items` directly to resolve each payee and record
-- Connect transfer status, but neither table ever got a service_role
-- grant — same missing-grant class as 0055/0056/0057/0058, this time
-- caught by building the real agency payouts screen rather than by a
-- live failure, since no real charge has completed yet in this pilot
-- to have actually hit this path.
grant select on invoices to service_role;
grant select, update on invoice_line_items to service_role;

-- Lets the agency payouts screen show a real "paid this month" figure
-- — transfer_status alone carries no timestamp to filter by.
alter table invoice_line_items add column transferred_at timestamptz;
