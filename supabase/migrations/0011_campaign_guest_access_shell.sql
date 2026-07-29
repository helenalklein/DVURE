-- Shell schema only — no redemption flow, no RLS policies, no UI yet.
-- Just the shape, so the design decision below doesn't get lost before
-- the feature itself gets built.
--
-- Photographers, stylists, and other campaign-specific 1099 crew
-- (everyone except models) don't get a real DVURE account the way
-- brand/agency/model users do. Those three go through an identification
-- process because they're persistent, repped or verified parties with
-- an ongoing relationship to the platform. A freelance photographer
-- booked for one shoot has no such relationship, and isn't repped the
-- way a model is — there's nothing to verify identity against, and a
-- standing login would grant more access than the relationship
-- justifies. Instead: a campaign issues a short-lived access code/link
-- scoped to exactly that one campaign. It stops working at expires_at
-- or when the campaign itself is deleted (on delete cascade below),
-- whichever comes first — a brand can't hand a crew member standing
-- access that outlives the job.
create type crew_discipline as enum (
  'photographer', 'director', 'stylist', 'hair', 'makeup_artist',
  'set_designer', 'retoucher', 'casting_director', 'location_scout',
  'gaffer', 'digital_tech', 'assistant', 'other'
);

create table campaign_guest_access (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  discipline crew_discipline not null,
  full_name text not null,
  email text,
  access_code uuid not null default gen_random_uuid(),
  issued_by_profile_id uuid references profiles(id),
  issued_at timestamptz not null default now(),
  -- Intended invariant: must never outlive the campaign. Not a hard DB
  -- constraint (campaigns.due_date can be null or change after
  -- issuance) — enforce by clamping to the campaign's due_date at
  -- issuance time once the real feature is built.
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz
);
create index campaign_guest_access_campaign_idx on campaign_guest_access (campaign_id);
create index campaign_guest_access_code_idx on campaign_guest_access (access_code);

-- Deliberately no anon/authenticated grants and no policies — same
-- no-direct-access posture as invites/model_profiles (0007) until the
-- actual issuance + redemption RPCs are designed.
alter table campaign_guest_access enable row level security;
