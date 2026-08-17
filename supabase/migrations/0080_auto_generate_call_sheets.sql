-- A call sheet should exist for every shoot day automatically, not
-- only once someone opens the tab and saves something -- otherwise
-- there's nothing to flag as "incomplete" until someone's already
-- started filling it in, which defeats the point of a completeness
-- warning. Backfills existing shoot days first, then a trigger keeps
-- every future one covered.
insert into call_sheets (shoot_day_id)
select sd.id from shoot_days sd
where not exists (select 1 from call_sheets cs where cs.shoot_day_id = sd.id);

create or replace function create_call_sheet_for_shoot_day()
returns trigger
language plpgsql
security definer set search_path = public as $$
begin
  insert into call_sheets (shoot_day_id) values (new.id)
  on conflict (shoot_day_id) do nothing;
  return new;
end;
$$;

create trigger shoot_day_auto_call_sheet
  after insert on shoot_days
  for each row execute function create_call_sheet_for_shoot_day();
