-- invoices_select and invoice_line_items_select (0023) each query the
-- OTHER table directly in a raw EXISTS subquery, and both tables have
-- RLS enabled -- evaluating invoices_select requires evaluating
-- invoice_line_items_select (to run its EXISTS against invoice_line_items),
-- which in turn requires re-evaluating invoices_select, forever. Postgres
-- catches this as "infinite recursion detected in policy" (42P17) and
-- every query against either table fails outright — confirmed live via
-- direct REST call, not theoretical.
--
-- Fix matches this schema's own established pattern for exactly this
-- situation (agency_has_model(), is_campaigns_brand(), etc., 0002_rls.sql):
-- move the cross-table check into a security definer function. A
-- security definer function runs as its owner, which bypasses RLS on
-- its own internal query — so the recursive dependency never forms.
create or replace function invoice_has_payee_org(p_invoice_id uuid, p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from invoice_line_items li where li.invoice_id = p_invoice_id and li.payee_org_id = p_org_id
  );
$$;

create or replace function invoice_brand_org(p_invoice_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select brand_org_id from invoices where id = p_invoice_id;
$$;

drop policy invoices_select on invoices;
create policy invoices_select on invoices for select using (
  brand_org_id = my_org_id()
  or invoice_has_payee_org(id, my_org_id())
);

drop policy invoice_line_items_select on invoice_line_items;
create policy invoice_line_items_select on invoice_line_items for select using (
  payee_org_id = my_org_id()
  or invoice_brand_org(invoice_id) = my_org_id()
);
