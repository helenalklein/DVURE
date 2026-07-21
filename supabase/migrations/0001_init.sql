-- DVURE schema — initial tables, enums, and constraints.
-- Replaces the prototype's free-text identity strings (agency/org/brand
-- name duplicated across records) with real foreign-key relationships.
-- See /supabase/migrations/0002_rls.sql for Row Level Security policies —
-- every table here must have RLS enabled before it holds real data.

create extension if not exists pgcrypto;

-- ─── ENUMS ──────────────────────────────────────────────────────────────

create type profile_role as enum ('brand_staff', 'agency_staff', 'model');
create type org_type as enum ('brand', 'agency');
create type org_status as enum ('active', 'suspended');
create type membership_access_level as enum ('administrator', 'enhanced', 'basic');
create type membership_status as enum ('invited', 'active', 'suspended');
create type model_availability as enum ('available', 'pending', 'unavailable');
create type agency_relationship_type as enum ('mother', 'boutique');
create type agency_relationship_status as enum ('active', 'inactive');
create type partnership_status as enum ('active', 'inactive');
create type campaign_type as enum ('Runway', 'Editorial', 'Advertising', 'E-commerce', 'TV Commercial', 'Beauty', 'Other');
create type campaign_status as enum ('active', 'drafts', 'archived');
create type submission_stage as enum ('submitted', 'approved', 'rejected', 'booked');
create type crew_role as enum ('hair', 'makeup', 'dresser', 'photographer', 'production', 'security', 'transportation');
create type payment_status as enum ('pending', 'processing', 'paid');
create type invite_status as enum ('pending', 'accepted', 'expired', 'revoked');

-- ─── IDENTITY ───────────────────────────────────────────────────────────

-- 1:1 with auth.users. role is set once at account creation and treated
-- as immutable afterward (enforced in RLS, not here).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role profile_role not null,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

-- Brands and agencies are the same table, discriminated by org_type —
-- mirrors how PARTNERED_AGENCIES and brand identity were both just
-- "an organization" in the mock, never modeled separately.
create table organizations (
  id uuid primary key default gen_random_uuid(),
  org_type org_type not null,
  name text not null,
  status org_status not null default 'active',
  created_at timestamptz not null default now()
);
create index organizations_org_type_idx on organizations (org_type);

-- Brand and agency staff (not models). One row per person per org.
-- unique(profile_id) enforces "exactly one org per staff member" —
-- confirmed for brands, assumed for agencies (see plan's documented
-- defaults; loosen this constraint if agency staff need multi-org later).
create table org_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  title text,
  access_level membership_access_level not null default 'basic',
  group_name text,
  status membership_status not null default 'active',
  created_at timestamptz not null default now()
);
create index org_memberships_org_id_idx on org_memberships (org_id);

-- A model's own identity/portfolio — agency-wide, not per-campaign.
-- profile_id is nullable: an agency can add a model to their roster
-- before the model has accepted an invite and activated a real login.
create table model_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references profiles(id) on delete set null,
  full_name text not null,
  location text,
  default_day_rate numeric,
  height text,
  bust text,
  waist text,
  dress text,
  experience text,
  general_availability model_availability not null default 'available',
  created_at timestamptz not null default now()
);

-- Many-to-many: a model can have one mother agency plus any number of
-- boutique agencies at once. Exactly one active mother per model.
create table agency_model_relationships (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references model_profiles(id) on delete cascade,
  agency_org_id uuid not null references organizations(id) on delete cascade,
  relationship_type agency_relationship_type not null,
  status agency_relationship_status not null default 'active',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index agency_model_relationships_one_active_mother
  on agency_model_relationships (model_id)
  where relationship_type = 'mother' and status = 'active';
create index agency_model_relationships_agency_idx on agency_model_relationships (agency_org_id);
create index agency_model_relationships_model_idx on agency_model_relationships (model_id);

-- ─── BRAND <-> AGENCY NETWORK ───────────────────────────────────────────

-- The standing relationship, replacing the hardcoded PARTNERED_AGENCIES
-- array in BrandApp.tsx.
create table brand_agency_partnerships (
  id uuid primary key default gen_random_uuid(),
  brand_org_id uuid not null references organizations(id) on delete cascade,
  agency_org_id uuid not null references organizations(id) on delete cascade,
  status partnership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (brand_org_id, agency_org_id)
);

-- ─── CAMPAIGNS ──────────────────────────────────────────────────────────

create table runway_shows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue text,
  show_date date,
  show_time time,
  time_zone text,
  season text,
  created_at timestamptz not null default now()
);

-- dueLabel/dueUrgency/submitted/approved/booked/committed/remaining from
-- the mock Campaign type are intentionally NOT stored here — they're
-- derived at read time from due_date, from submissions grouped by stage,
-- and from bookings. See plan's "documented defaults" for why.
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  type campaign_type not null,
  status campaign_status not null default 'drafts',
  due_date date,
  submission_open timestamptz,
  submission_close timestamptz,
  talent_needed int,
  budget numeric,
  runway_show_id uuid references runway_shows(id),
  created_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index campaigns_brand_org_idx on campaigns (brand_org_id);
create index campaigns_runway_show_idx on campaigns (runway_show_id);

-- The per-campaign subset of partnered agencies actually invited — the
-- real visibility gate. A brand_agency_partnerships row alone does NOT
-- make a campaign visible to an agency; a distribution row here does.
create table campaign_agency_distributions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  agency_org_id uuid not null references organizations(id) on delete cascade,
  invited_at timestamptz not null default now(),
  invited_by_profile_id uuid references profiles(id),
  unique (campaign_id, agency_org_id)
);
create index campaign_agency_distributions_agency_idx on campaign_agency_distributions (agency_org_id);

-- "Grant Extension" feature (already built in the UI as local React
-- state) — header + detail so "all agencies" doesn't require enumerating
-- every partnered agency as a row.
create table campaign_submission_extensions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  new_close_date timestamptz not null,
  applies_to_all_agencies boolean not null default false,
  granted_by_profile_id uuid references profiles(id),
  granted_at timestamptz not null default now()
);
create index campaign_submission_extensions_campaign_idx on campaign_submission_extensions (campaign_id);

create table campaign_submission_extension_agencies (
  extension_id uuid not null references campaign_submission_extensions(id) on delete cascade,
  agency_org_id uuid not null references organizations(id) on delete cascade,
  primary key (extension_id, agency_org_id)
);

-- ─── SUBMISSIONS ────────────────────────────────────────────────────────

-- One row per (campaign, model). This is what SAMPLE_TALENT actually
-- represented in the mock, despite overlapping in name with the model's
-- own profile. unique(campaign_id, model_id) enforces "one submission
-- wins" — a second agency can't also submit the same model.
create table submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  model_id uuid not null references model_profiles(id) on delete cascade,
  submitting_agency_id uuid not null references organizations(id),
  submitted_by_profile_id uuid references profiles(id),
  stage submission_stage not null default 'submitted',
  availability model_availability not null default 'available',
  rate_quoted numeric,
  notes text,
  brand_score smallint check (brand_score between 1 and 5),
  decline_reason text,
  reviewed_by_profile_id uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, model_id)
);
create index submissions_campaign_idx on submissions (campaign_id);
create index submissions_model_idx on submissions (model_id);
create index submissions_agency_idx on submissions (submitting_agency_id);

-- Brand-internal deliberation notes on a submission. Agencies never see
-- these, regardless of whether they can see the parent submission —
-- enforced in RLS (0002), not by this table's shape.
create table submission_comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  author_profile_id uuid references profiles(id),
  -- Snapshotted at write time (not joined live through org_memberships)
  -- so historical attribution survives an author later changing orgs.
  author_org_id uuid references organizations(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index submission_comments_submission_idx on submission_comments (submission_id);

-- ─── RUNWAY-SPECIFIC ────────────────────────────────────────────────────

create table casting_entries (
  model_id uuid not null references model_profiles(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  confirmed boolean not null default false,
  optioned boolean not null default false,
  fitting_complete boolean not null default false,
  rehearsal_complete boolean not null default false,
  checked_in boolean not null default false,
  walked boolean not null default false,
  wrap_complete boolean not null default false,
  primary key (model_id, campaign_id)
);

-- Scoped per-campaign rather than a reusable cross-campaign roster —
-- keeps one brand's crew list from leaking into another's picker.
create table crew_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  role crew_role not null
);
create index crew_members_campaign_idx on crew_members (campaign_id);

create table looks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  look_number int,
  garments text,
  shoes text,
  jewelry text,
  accessories text,
  stylist_notes text,
  dressing_notes text,
  assigned_model_id uuid references model_profiles(id),
  assigned_hair_id uuid references crew_members(id),
  assigned_makeup_id uuid references crew_members(id),
  assigned_dresser_id uuid references crew_members(id)
);
create index looks_campaign_idx on looks (campaign_id);

-- ─── BOOKINGS ───────────────────────────────────────────────────────────

-- bookingBreakdown() (model/agency/platform fee split) stays a computed
-- view, not stored columns here — avoids drift if day_rate/days/pct are
-- edited after creation. See booking_breakdown_v in 0002_rls.sql...
-- (view lives alongside the helper functions since both are read-side
-- conveniences, not raw table structure).
create table bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text unique,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  submission_id uuid unique references submissions(id),
  brand_org_id uuid not null references organizations(id),
  agency_org_id uuid not null references organizations(id),
  model_id uuid not null references model_profiles(id),
  day_rate numeric not null,
  days int not null default 1,
  shoot_date date,
  agency_pct numeric not null,
  platform_pct numeric not null,
  payment_status payment_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index bookings_campaign_idx on bookings (campaign_id);
create index bookings_brand_idx on bookings (brand_org_id);
create index bookings_agency_idx on bookings (agency_org_id);
create index bookings_model_idx on bookings (model_id);

-- ─── INVITES ────────────────────────────────────────────────────────────

-- Backs "models get logins provided by their agency" (and, more broadly,
-- any admin inviting a teammate to an existing org) as a real, auditable
-- pipeline instead of a policy statement. Rows here are written by an
-- admin; supabase.auth.admin.inviteUserByEmail() (service-role, server
-- side only) does the actual auth.users creation once implemented.
create table invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role profile_role not null,
  org_id uuid references organizations(id),
  agency_relationship_type agency_relationship_type,
  invited_by_profile_id uuid references profiles(id),
  status invite_status not null default 'pending',
  token uuid not null default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);
create index invites_email_idx on invites (email);
