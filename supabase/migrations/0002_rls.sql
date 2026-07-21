-- DVURE Row Level Security — the actual enforcement layer. Every table
-- from 0001_init.sql is locked down here; nothing is readable/writable
-- unless a policy below explicitly allows it. No table should ever be
-- left without RLS enabled — Supabase's dashboard flags any table it
-- considers unprotected, use that as a checklist when reviewing.
--
-- No platform_admin role is baked into these policies. Internal/support
-- tooling should use the service_role key server-side (which bypasses
-- RLS entirely) rather than a superuser role inside user-facing JWTs.

-- ─── HELPER FUNCTIONS ───────────────────────────────────────────────────
-- security definer + a fixed search_path so these can't be tricked by a
-- caller-controlled schema, and so every policy below stays a short
-- EXISTS check instead of repeating these joins in 20 places.

create or replace function my_role()
returns profile_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function my_org_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from org_memberships where profile_id = auth.uid() and status = 'active';
$$;

create or replace function my_org_type()
returns org_type
language sql stable security definer set search_path = public as $$
  select org_type from organizations where id = my_org_id();
$$;

create or replace function my_access_level()
returns membership_access_level
language sql stable security definer set search_path = public as $$
  select access_level from org_memberships where profile_id = auth.uid() and status = 'active';
$$;

create or replace function my_model_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from model_profiles where profile_id = auth.uid();
$$;

-- Does my org have an ACTIVE relationship (any type) with this model?
create or replace function agency_has_model(p_model_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from agency_model_relationships
    where model_id = p_model_id and agency_org_id = my_org_id() and status = 'active'
  );
$$;

-- Is my org specifically the MOTHER agency for this model?
create or replace function agency_is_mother(p_model_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from agency_model_relationships
    where model_id = p_model_id and agency_org_id = my_org_id()
      and relationship_type = 'mother' and status = 'active'
  );
$$;

-- Is my org distributed on (invited to) this campaign?
create or replace function agency_distributed_on(p_campaign_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from campaign_agency_distributions
    where campaign_id = p_campaign_id and agency_org_id = my_org_id()
  );
$$;

-- Am I brand staff of the org that owns this campaign?
create or replace function is_campaigns_brand(p_campaign_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from campaigns
    where id = p_campaign_id and brand_org_id = my_org_id()
  );
$$;

-- ─── ENABLE RLS ─────────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table organizations enable row level security;
alter table org_memberships enable row level security;
alter table model_profiles enable row level security;
alter table agency_model_relationships enable row level security;
alter table brand_agency_partnerships enable row level security;
alter table runway_shows enable row level security;
alter table campaigns enable row level security;
alter table campaign_agency_distributions enable row level security;
alter table campaign_submission_extensions enable row level security;
alter table campaign_submission_extension_agencies enable row level security;
alter table submissions enable row level security;
alter table submission_comments enable row level security;
alter table casting_entries enable row level security;
alter table crew_members enable row level security;
alter table looks enable row level security;
alter table bookings enable row level security;
alter table invites enable row level security;

-- ─── PROFILES ───────────────────────────────────────────────────────────

create policy profiles_select on profiles for select using (
  id = auth.uid()
  or exists ( -- org-mates (brand/agency staff sharing an org)
    select 1 from org_memberships mine, org_memberships theirs
    where mine.profile_id = auth.uid() and theirs.profile_id = profiles.id
      and mine.org_id = theirs.org_id
  )
  or exists ( -- agency staff whose org has a relationship with this model
    select 1 from model_profiles mp
    where mp.profile_id = profiles.id and agency_has_model(mp.id)
  )
);

create policy profiles_update_self on profiles for update using (id = auth.uid())
  with check (id = auth.uid());

-- role/id immutability isn't enforced via the WITH CHECK above — a
-- self-referential "role = my_role()" check is subtly unreliable mid-
-- update (my_role() may or may not see this statement's own pending
-- change, depending on evaluation order). Column-level GRANT/REVOKE is
-- the robust way to make a column immutable regardless of RLS: the
-- authenticated role can update contact fields, but never role/id/email,
-- no matter what a policy's USING/CHECK clauses say.
revoke update on profiles from authenticated;
grant update (full_name, phone) on profiles to authenticated;

-- ─── ORGANIZATIONS ──────────────────────────────────────────────────────

create policy organizations_select on organizations for select using (
  id = my_org_id()
  or exists ( -- brand<->agency partnership either direction
    select 1 from brand_agency_partnerships p
    where (p.brand_org_id = my_org_id() and p.agency_org_id = organizations.id)
       or (p.agency_org_id = my_org_id() and p.brand_org_id = organizations.id)
  )
  or exists ( -- model can see agencies they're linked to
    select 1 from agency_model_relationships amr
    where amr.model_id = my_model_id() and amr.agency_org_id = organizations.id and amr.status = 'active'
  )
);

create policy organizations_update on organizations for update using (
  id = my_org_id() and my_access_level() = 'administrator'
);

-- ─── ORG MEMBERSHIPS ────────────────────────────────────────────────────

create policy org_memberships_select on org_memberships for select using (
  org_id = my_org_id()
);

create policy org_memberships_write on org_memberships for all using (
  org_id = my_org_id() and my_access_level() = 'administrator'
) with check (
  org_id = my_org_id() and my_access_level() = 'administrator'
);

-- ─── MODEL PROFILES ─────────────────────────────────────────────────────

create policy model_profiles_select on model_profiles for select using (
  profile_id = auth.uid() -- the model themself
  or agency_has_model(id) -- any linked agency (mother or boutique)
  or exists ( -- brand staff who've received a submission from this model
    select 1 from submissions s where s.model_id = model_profiles.id and is_campaigns_brand(s.campaign_id)
  )
);

create policy model_profiles_insert on model_profiles for insert with check (
  my_role() = 'agency_staff' -- agency adds a model to their own roster
);

create policy model_profiles_update on model_profiles for update using (
  profile_id = auth.uid() -- model editing their own contact info
  or agency_is_mother(id) -- only the mother agency edits core profile fields
);

-- ─── AGENCY <-> MODEL RELATIONSHIPS ─────────────────────────────────────

create policy agency_model_relationships_select on agency_model_relationships for select using (
  model_id = my_model_id()
  or agency_org_id = my_org_id()
);

create policy agency_model_relationships_write on agency_model_relationships for all using (
  agency_org_id = my_org_id() and my_access_level() in ('administrator', 'enhanced')
) with check (
  agency_org_id = my_org_id() and my_access_level() in ('administrator', 'enhanced')
);

-- ─── BRAND <-> AGENCY PARTNERSHIPS ──────────────────────────────────────

create policy brand_agency_partnerships_select on brand_agency_partnerships for select using (
  brand_org_id = my_org_id() or agency_org_id = my_org_id()
);

create policy brand_agency_partnerships_write on brand_agency_partnerships for all using (
  brand_org_id = my_org_id() and my_access_level() = 'administrator'
) with check (
  brand_org_id = my_org_id() and my_access_level() = 'administrator'
);

-- ─── RUNWAY SHOWS ───────────────────────────────────────────────────────
-- Deliberately narrow: this only grants access to the runway_shows row
-- itself, not to other brands' campaigns against the same show. The
-- "which other brands are walking this show" list must go through its
-- own narrow function/view (see NOTE at the bottom of this file) rather
-- than ever widening general `campaigns` read access.

create policy runway_shows_select on runway_shows for select using (
  exists (select 1 from campaigns c where c.runway_show_id = runway_shows.id and is_campaigns_brand(c.id))
);

create policy runway_shows_insert on runway_shows for insert with check (
  my_role() = 'brand_staff'
);

-- ─── CAMPAIGNS ──────────────────────────────────────────────────────────

create policy campaigns_select on campaigns for select using (
  brand_org_id = my_org_id()
  or agency_distributed_on(id)
);

create policy campaigns_write on campaigns for all using (
  brand_org_id = my_org_id() and my_access_level() in ('administrator', 'enhanced')
) with check (
  brand_org_id = my_org_id() and my_access_level() in ('administrator', 'enhanced')
);

-- ─── CAMPAIGN AGENCY DISTRIBUTIONS ──────────────────────────────────────

create policy campaign_agency_distributions_select on campaign_agency_distributions for select using (
  is_campaigns_brand(campaign_id) or agency_org_id = my_org_id()
);

create policy campaign_agency_distributions_write on campaign_agency_distributions for all using (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
) with check (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
);

-- ─── SUBMISSION EXTENSIONS ──────────────────────────────────────────────

create policy campaign_submission_extensions_select on campaign_submission_extensions for select using (
  is_campaigns_brand(campaign_id)
  or (agency_distributed_on(campaign_id) and (
    applies_to_all_agencies
    or exists (
      select 1 from campaign_submission_extension_agencies a
      where a.extension_id = campaign_submission_extensions.id and a.agency_org_id = my_org_id()
    )
  ))
);

create policy campaign_submission_extensions_write on campaign_submission_extensions for all using (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
) with check (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
);

create policy campaign_submission_extension_agencies_select on campaign_submission_extension_agencies for select using (
  exists (
    select 1 from campaign_submission_extensions e
    where e.id = extension_id and (is_campaigns_brand(e.campaign_id) or agency_org_id = my_org_id())
  )
);

create policy campaign_submission_extension_agencies_write on campaign_submission_extension_agencies for all using (
  exists (
    select 1 from campaign_submission_extensions e
    where e.id = extension_id and is_campaigns_brand(e.campaign_id)
      and my_access_level() in ('administrator', 'enhanced')
  )
) with check (
  exists (
    select 1 from campaign_submission_extensions e
    where e.id = extension_id and is_campaigns_brand(e.campaign_id)
      and my_access_level() in ('administrator', 'enhanced')
  )
);

-- ─── SUBMISSIONS ────────────────────────────────────────────────────────

create policy submissions_select on submissions for select using (
  is_campaigns_brand(campaign_id)
  or submitting_agency_id = my_org_id()
  or model_id = my_model_id()
);

create policy submissions_insert on submissions for insert with check (
  submitting_agency_id = my_org_id()
  and agency_has_model(model_id)
  and agency_distributed_on(campaign_id)
);

-- Split update policy: brand can change stage (approve/reject) and score;
-- the submitting agency can only edit before a brand has reviewed it.
create policy submissions_update_brand on submissions for update using (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
);

create policy submissions_update_agency on submissions for update using (
  submitting_agency_id = my_org_id() and reviewed_at is null
) with check (
  submitting_agency_id = my_org_id()
);

-- ─── SUBMISSION COMMENTS (brand-internal only) ──────────────────────────
-- Agencies get no access to this table at all, regardless of whether
-- they can see the parent submission — this is the confirmed rule.

create policy submission_comments_select on submission_comments for select using (
  my_role() = 'brand_staff'
  and exists (
    select 1 from submissions s where s.id = submission_id and is_campaigns_brand(s.campaign_id)
  )
);

create policy submission_comments_insert on submission_comments for insert with check (
  my_role() = 'brand_staff'
  and exists (
    select 1 from submissions s where s.id = submission_id and is_campaigns_brand(s.campaign_id)
  )
);

create policy submission_comments_delete on submission_comments for delete using (
  author_profile_id = auth.uid()
);

-- ─── RUNWAY-SPECIFIC (casting_entries, looks, crew_members) ─────────────

create policy casting_entries_select on casting_entries for select using (
  is_campaigns_brand(campaign_id) or agency_has_model(model_id)
);

create policy casting_entries_write on casting_entries for all using (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
) with check (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
);

create policy crew_members_select on crew_members for select using (
  is_campaigns_brand(campaign_id)
);

create policy crew_members_write on crew_members for all using (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
) with check (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
);

create policy looks_select on looks for select using (
  is_campaigns_brand(campaign_id)
  or (assigned_model_id is not null and agency_has_model(assigned_model_id))
);

create policy looks_write on looks for all using (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
) with check (
  is_campaigns_brand(campaign_id) and my_access_level() in ('administrator', 'enhanced')
);

-- ─── BOOKINGS ───────────────────────────────────────────────────────────
-- Insert/status changes are brand-administrator-only given money is
-- involved — not open to raw client writes from any role.

create policy bookings_select on bookings for select using (
  brand_org_id = my_org_id()
  or agency_org_id = my_org_id()
  or model_id = my_model_id()
);

create policy bookings_write on bookings for all using (
  brand_org_id = my_org_id() and my_access_level() = 'administrator'
) with check (
  brand_org_id = my_org_id() and my_access_level() = 'administrator'
);

-- ─── INVITES ────────────────────────────────────────────────────────────

create policy invites_select on invites for select using (
  org_id = my_org_id() and my_access_level() in ('administrator', 'enhanced')
);

create policy invites_write on invites for all using (
  org_id = my_org_id() and my_access_level() in ('administrator', 'enhanced')
) with check (
  org_id = my_org_id() and my_access_level() in ('administrator', 'enhanced')
);

-- ─── READ-SIDE CONVENIENCE VIEWS ────────────────────────────────────────

-- Computed booking fee split — never stored, so it can't drift from
-- day_rate/days/agency_pct/platform_pct if those are edited later.
-- Inherits the caller's RLS via bookings_select (views run with the
-- querying user's permissions here, not the view owner's, because we
-- do NOT mark this security definer).
create view booking_breakdown_v as
select
  id as booking_id,
  day_rate * days as gross_booking_value,
  day_rate * days * (1 - agency_pct - platform_pct) as model_fee,
  day_rate * days * agency_pct as agency_fee,
  day_rate * days * platform_pct as platform_fee
from bookings;

-- NOTE: "which other brands are walking this show" (RUNWAY_SHOW_OTHER_
-- BRANDS in the mock) intentionally has NO view/function here yet. Per
-- the plan, this needs a narrow, deliberately-built security definer
-- function returning only brand names for a given show — do not widen
-- campaigns_select or reuse a general join to build this; build it as
-- its own scoped piece when the Runway UI is actually wired to real data.
