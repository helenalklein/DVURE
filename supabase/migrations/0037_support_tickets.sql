-- Minimal "contact support" surface — not a help center (explicitly out
-- of scope per direct instruction), just a real place a request lands
-- instead of nowhere. Org deletion specifically routes through this
-- (category 'delete_organization') rather than a self-service RPC, per
-- direct instruction: a human reviews it before anything is torn down.
-- No admin-facing viewer yet — she queries this table directly for now,
-- same posture as org verification.
create type support_ticket_category as enum ('delete_organization', 'billing', 'bug', 'other');
create type support_ticket_status as enum ('open', 'resolved');

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete set null,
  submitted_by_profile_id uuid references profiles(id),
  submitted_by_email text not null,
  category support_ticket_category not null default 'other',
  subject text not null,
  message text not null,
  status support_ticket_status not null default 'open',
  created_at timestamptz not null default now()
);
create index support_tickets_org_idx on support_tickets (org_id);

alter table support_tickets enable row level security;
create policy support_tickets_select on support_tickets for select using (
  org_id = my_org_id()
);
grant select on support_tickets to authenticated;

create or replace function submit_support_ticket(p_category support_ticket_category, p_subject text, p_message text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid := my_org_id();
  v_email text;
  v_id uuid;
begin
  select email into v_email from profiles where id = auth.uid();
  if v_email is null then
    raise exception 'submit_support_ticket: no profile found for current user';
  end if;

  insert into support_tickets (org_id, submitted_by_profile_id, submitted_by_email, category, subject, message)
  values (v_org_id, auth.uid(), v_email, p_category, btrim(p_subject), btrim(p_message))
  returning id into v_id;

  perform record_audit_event('support_ticket.submitted', 'support_ticket', v_id, null, null,
    jsonb_build_object('category', p_category, 'subject', p_subject));

  return v_id;
end;
$$;
revoke all on function submit_support_ticket(support_ticket_category, text, text) from public;
grant execute on function submit_support_ticket(support_ticket_category, text, text) to authenticated;
