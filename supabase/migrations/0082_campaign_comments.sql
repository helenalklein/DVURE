-- Real internal comment board for the Model Board's collapsible side
-- panel -- brand-team-only, same scope as the "Brand Team" thread in
-- Messaging, but that one turned out to be mock-only (internalMsgs is
-- a hardcoded array in BrandApp.tsx, never wired to the database).
-- This one actually persists.
create table campaign_comments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  author_profile_id uuid references profiles(id),
  text text not null,
  created_at timestamptz not null default now()
);
create index campaign_comments_campaign_idx on campaign_comments (campaign_id);

alter table campaign_comments enable row level security;

-- Brand-internal only -- not the agency/crew-visible surfaces (Model
-- Board itself, Crew tab) this panel sits next to.
create policy campaign_comments_select on campaign_comments for select using (
  is_campaigns_brand(campaign_id)
);
create policy campaign_comments_insert on campaign_comments for insert with check (
  is_campaigns_brand(campaign_id) and author_profile_id = auth.uid()
);

grant select, insert on campaign_comments to authenticated;
