-- Wiring the Looks tab (Runway) to real data. The table and its RLS have
-- existed since 0001/0002 but nothing ever wrote to it — LooksScreen was
-- mock-only (LOOKS/SAMPLE_TALENT/CREW). Per direct instruction: this
-- isn't Relay scope (garment/model assignment is pre-show wardrobe data,
-- not the day-of checklist / per-model stage tracking that's deferred —
-- casting_entries stays untouched).
--
-- assigned_hair_id/makeup_id/dresser_id currently reference crew_members,
-- a table that's been dead since crew_payees became the real crew system
-- (nothing has ever been inserted into crew_members through the app).
-- Repoint to crew_payees so Looks can actually pull from a campaign's
-- real assigned crew.
alter table looks drop constraint looks_assigned_hair_id_fkey;
alter table looks drop constraint looks_assigned_makeup_id_fkey;
alter table looks drop constraint looks_assigned_dresser_id_fkey;

alter table looks add constraint looks_assigned_hair_id_fkey
  foreign key (assigned_hair_id) references crew_payees(id) on delete set null;
alter table looks add constraint looks_assigned_makeup_id_fkey
  foreign key (assigned_makeup_id) references crew_payees(id) on delete set null;
alter table looks add constraint looks_assigned_dresser_id_fkey
  foreign key (assigned_dresser_id) references crew_payees(id) on delete set null;

-- looks_write was brand-staff-only (administrator/enhanced), which
-- doesn't fit the lead-autonomy model the Crew tab now has (0073/0074)
-- -- a styling department lead should be able to manage looks for their
-- own show without needing a brand admin to do it for them. Widened to
-- match: brand admin/enhanced (unchanged), OR call-sheet admin/producer,
-- OR the caller is a department lead of the 'styling' category on this
-- campaign.
drop policy looks_write on looks;
create policy looks_write on looks for all using (
  (is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced'))
  or my_call_sheet_role(campaign_id) in ('admin', 'producer')
  or exists (
    select 1 from campaign_crew_slots ccs
    join call_sheet_role_categories cat on cat.role_key = ccs.role_key
    where ccs.campaign_id = looks.campaign_id
      and ccs.crew_payee_id = (select id from crew_payees where profile_id = auth.uid())
      and ccs.is_department_lead
      and cat.category_key = 'styling'
  )
) with check (
  (is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced'))
  or my_call_sheet_role(campaign_id) in ('admin', 'producer')
  or exists (
    select 1 from campaign_crew_slots ccs
    join call_sheet_role_categories cat on cat.role_key = ccs.role_key
    where ccs.campaign_id = looks.campaign_id
      and ccs.crew_payee_id = (select id from crew_payees where profile_id = auth.uid())
      and ccs.is_department_lead
      and cat.category_key = 'styling'
  )
);
