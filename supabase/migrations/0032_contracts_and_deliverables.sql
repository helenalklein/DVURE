-- Contracts and Deliverables were both fully mock UI shells with no
-- backing table at all — "Save Deliverables" and the contract-status
-- list never persisted anything. casting_entries, by contrast, already
-- existed in 0001_init.sql/0002_rls.sql (confirmed by grep before
-- writing this) and just needed real frontend wiring, no migration.

-- ─── CONTRACTS ──────────────────────────────────────────────────────────
-- Generated at approval time (mirrors the existing "Contract Generated"
-- modal, which already fires on submission approval, before a booking
-- necessarily exists yet) — booking_id is nullable and optional, filled
-- in later if useful, not required at creation.

create type contract_status as enum ('draft', 'awaiting_signature', 'fully_executed');

create sequence contract_number_seq start 1;

create table contracts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  model_id uuid not null references model_profiles(id),
  contract_number text not null unique,
  day_rate numeric not null,
  agency_pct numeric not null default 0.20,
  territory text not null default 'United States',
  duration text not null default '1 year',
  status contract_status not null default 'draft',
  sent_at timestamptz,
  executed_at timestamptz,
  created_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (campaign_id, model_id)
);

create or replace function set_contract_number()
returns trigger language plpgsql as $$
begin
  if new.contract_number is null then
    new.contract_number := 'CF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('contract_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger contracts_set_number before insert on contracts
for each row execute function set_contract_number();

alter table contracts enable row level security;

create policy contracts_select on contracts for select using (
  is_campaigns_brand(campaign_id)
);
create policy contracts_write on contracts for all using (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
) with check (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
);

grant select, insert, update on contracts to authenticated;

-- ─── DELIVERABLES (SHOOT DAYS) ──────────────────────────────────────────
-- The existing UI never collected real structured dates (a plain text
-- input defaulting to "Mon 07/14", no year, no <input type=date>) — kept
-- as free text here rather than inventing a date column the UI doesn't
-- actually populate.

create table shoot_days (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  date_label text,
  hours text,
  talent_note text,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index shoot_days_campaign_idx on shoot_days (campaign_id);

alter table shoot_days enable row level security;

create policy shoot_days_select on shoot_days for select using (
  is_campaigns_brand(campaign_id)
);
create policy shoot_days_write on shoot_days for all using (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
) with check (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
);

grant select, insert, update, delete on shoot_days to authenticated;
