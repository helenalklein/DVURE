-- shoot_days.date_label was free text with no year ("Mon 07/14")
-- specifically because the old UI had no <input type=date> to populate
-- one (see 0032's own comment). Putting shoot days on a real calendar
-- needs a real date to key off of — add it as its own column rather
-- than trying to parse the freeform label at render time everywhere.
-- date_label stays (not dropped) since a real row already exists with
-- user-entered text worth keeping as a display label; new rows go
-- through event_date from here on.
alter table shoot_days add column event_date date;

-- One real row exists today ("Fri 09/12", created 2026-08-03) — backfill
-- it so it doesn't silently disappear from the new calendar. 2026 to
-- match this campaign's own submission/due-date window.
update shoot_days set event_date = '2026-09-12' where date_label = 'Fri 09/12' and event_date is null;

-- Castings: a real, lightweight "when is the casting" date marker — not
-- a revival of Casting Board (that's still deferred to Relay/Phase 2 per
-- direct instruction: no stages, no per-model tracking). Just a date on
-- a campaign's schedule, same shape/RLS pattern as shoot_days.
create table castings (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  event_date date not null,
  title text,
  note text,
  created_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index castings_campaign_idx on castings (campaign_id);

alter table castings enable row level security;

create policy castings_select on castings for select using (
  is_campaigns_brand(campaign_id)
);
create policy castings_write on castings for all using (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
) with check (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
);

grant select, insert, update, delete on castings to authenticated;
