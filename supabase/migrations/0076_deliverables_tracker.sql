-- Real deliverables tracker — nothing like this existed before. The tab
-- previously labeled "Schedule" is internally still called
-- DeliverablesTab from an earlier naming era, but it's just the
-- shoot-day/hours editor; it's untouched here. This is a new,
-- separate concept: tracking creative outputs owed on a project
-- (selects, final assets, approvals, a printed lineup — whatever the
-- project type calls a "deliverable"), each with a status lifecycle
-- and an optional crew owner.
create type deliverable_status as enum ('not_started', 'in_progress', 'submitted', 'approved', 'delivered');

create table deliverables (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  title text not null,
  description text,
  category text,
  due_date date,
  status deliverable_status not null default 'not_started',
  assigned_crew_payee_id uuid references crew_payees(id) on delete set null,
  created_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index deliverables_campaign_idx on deliverables (campaign_id);

alter table deliverables enable row level security;

-- Same visibility bar as the rest of the crew-facing project surface:
-- brand sees everything, any crew member with call-sheet access at all
-- (viewer and up) can see what's owed on the project they're on.
create policy deliverables_select on deliverables for select using (
  is_campaigns_brand(campaign_id) or my_call_sheet_role(campaign_id) is not null
);

-- Full CRUD (create/edit/reassign/delete) is brand admin/enhanced or
-- call-sheet admin/producer — same bar as looks_write (0075). An
-- assigned crew member who isn't admin/producer updates ONLY their own
-- item's status, through update_deliverable_status below, not this
-- policy — mirrors update_crew_slot_rate's narrow-RPC pattern rather
-- than widening raw table access.
create policy deliverables_write on deliverables for all using (
  (is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced'))
  or my_call_sheet_role(campaign_id) in ('admin', 'producer')
) with check (
  (is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced'))
  or my_call_sheet_role(campaign_id) in ('admin', 'producer')
);

grant select, insert, update, delete on deliverables to authenticated;

create or replace function update_deliverable_status(p_deliverable_id uuid, p_status deliverable_status)
returns void
security definer set search_path = public
language plpgsql as $$
declare
  v_campaign_id uuid;
  v_assigned_crew_payee_id uuid;
  v_my_crew_payee_id uuid;
begin
  select campaign_id, assigned_crew_payee_id into v_campaign_id, v_assigned_crew_payee_id
  from deliverables where id = p_deliverable_id;

  if v_campaign_id is null then
    raise exception 'update_deliverable_status: deliverable not found';
  end if;

  select id into v_my_crew_payee_id from crew_payees where profile_id = auth.uid();

  if not (
    (is_campaigns_brand(v_campaign_id) and my_access_level() in ('administrator', 'enhanced'))
    or my_call_sheet_role(v_campaign_id) in ('admin', 'producer')
    or (v_assigned_crew_payee_id is not null and v_assigned_crew_payee_id = v_my_crew_payee_id)
  ) then
    raise exception 'update_deliverable_status: not authorized';
  end if;

  update deliverables set status = p_status where id = p_deliverable_id;
end;
$$;

revoke all on function update_deliverable_status(uuid, deliverable_status) from public;
grant execute on function update_deliverable_status(uuid, deliverable_status) to authenticated;
