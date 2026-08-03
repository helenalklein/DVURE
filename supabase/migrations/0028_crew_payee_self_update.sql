-- Crew get a real Profile tab now (name, discipline) — crew_payees had
-- select-self (0024) but no way to ever write to their own row. profiles
-- already has profiles_update_self (0002); this is the same shape for
-- the crew-specific identity table.
create policy crew_payees_update_self on crew_payees for update using (
  profile_id = auth.uid()
) with check (
  profile_id = auth.uid()
);
