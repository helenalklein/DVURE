-- Real in-app notifications, starting with exactly one event: a partner
-- brand distributing (submitting) a new campaign to this agency. Not
-- email, not push — the user explicitly wants to avoid "hundreds of
-- emails a month," and the existing BellButton (src/app/shared/ui.tsx)
-- already has a real notification-center UI reading from a mock NOTIFS
-- array; this table is what makes it real. In-app also naturally covers
-- both the website and the Capacitor iOS/Android shells at once, since
-- they're the same React app — no separate push infrastructure needed
-- for this first pass.
--
-- One row per (recipient org, event) rather than per-profile — every
-- staff member at the agency sees the same notification list for their
-- org, matching how campaign_agency_distributions itself is already
-- org-scoped, not profile-scoped.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  campaign_id uuid references campaigns(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_org_id_created_at_idx on notifications (org_id, created_at desc);

alter table notifications enable row level security;

-- Any active member of the recipient org can read/dismiss — same
-- "whole org sees it" posture as the row itself.
create policy notifications_select on notifications for select using (
  org_id = my_org_id()
);

-- Only read_at is ever client-writable (marking read/unread) — every
-- other field is written exclusively by the trigger below via its
-- security-definer privileges, never directly by a client insert.
create policy notifications_update on notifications for update using (
  org_id = my_org_id()
) with check (
  org_id = my_org_id()
);

grant select on notifications to authenticated;
grant update (read_at) on notifications to authenticated;

-- Fires on the same insert distributeCampaignToAgencies() already does
-- (src/lib/queries/campaigns.ts) — a trigger rather than app-layer logic
-- so the notification can never be silently skipped by some future
-- second code path that writes to campaign_agency_distributions.
create or replace function notify_campaign_distributed()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_campaign_name text;
  v_brand_name text;
begin
  select c.name, o.name into v_campaign_name, v_brand_name
  from campaigns c
  join organizations o on o.id = c.brand_org_id
  where c.id = new.campaign_id;

  insert into notifications (org_id, type, title, body, campaign_id)
  values (
    new.agency_org_id,
    'campaign_distributed',
    coalesce(v_brand_name, 'A partner brand') || ' published a new campaign',
    v_campaign_name,
    new.campaign_id
  );
  return new;
end;
$$;

create trigger campaign_agency_distributions_notify
after insert on campaign_agency_distributions
for each row execute function notify_campaign_distributed();
