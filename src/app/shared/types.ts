export type Role = "brand" | "agency" | "model" | "crew";

export type SubmissionStage = "submitted" | "approved" | "rejected" | "booked";

export type Availability = "available" | "pending" | "unavailable";

export type PaymentStatus = "pending" | "processing" | "paid";

// Matches the `representation_exclusivity` Postgres enum (0027).
export type RepresentationExclusivity = "exclusive" | "non_exclusive" | "limited" | "not_specified";

export interface Talent {
  id: number;
  // Real model_profiles uuid backing this card — needed to group
  // multiple agencies' submissions of the same person into one card
  // (see duplicateFlag below). Mock talent doesn't have a real row, so
  // this is empty string there.
  modelId: string;
  name: string;
  photoUrl: string;
  modelEmail: string;
  modelPhone: string;
  // agency = who actually submitted this candidate (mother or boutique —
  // whichever agency clicked submit). motherAgency/boutiqueAgencies show
  // on the card regardless of who submitted, so the brand always knows
  // the full representation picture, not just the submitter.
  agency: string;
  submittedByName: string;
  submittedByEmail: string;
  motherAgency: string;
  boutiqueAgencies: string[];
  location: string;
  rate: string;
  stage: SubmissionStage;
  avail: Availability;
  note: string;
  height: string;
  bust: string;
  waist: string;
  dress: string;
  exp: string;
  score: number;
  // True when more than one agency has submitted this same model to
  // this campaign — the brand sees one card, not one per agency, with
  // per-agency stage/actions living in the drawer instead of the card.
  duplicateFlag: boolean;
  submittedByAgencies: string[];
}

export type IconFn = (props: { size?: number; className?: string }) => JSX.Element | null;

// A sticky-note-style comment left on a talent card — distinct from the
// single freeform "Notes" field: a threaded, multi-author discussion
// tied to one candidate, visible to whoever can see the campaign.
export interface CardComment {
  id: number;
  talentId: number;
  author: string;
  org: string;
  text: string;
  ts: string;
}

// A model on an agency's roster. Agencies add models (invite-style,
// like a brand adding a teammate) — models don't self-register.
// This becomes the `talent_profiles` table in Milestone B, with
// campaign submissions as a separate table referencing it.
export interface RosterModel {
  id: string;
  name: string;
  email: string;
  agency: string;
  location: string;
  rate: string;
  height: string;
  exp: string;
  // Whether this model has claimed a real DVURE login yet (model_profiles
  // .profile_id is set) — drives whether the agency sees "Invite to
  // DVURE" or a "Has login" badge on their roster card.
  hasLogin: boolean;
  // The specific agency_model_relationships row backing THIS agency's
  // view of this model — a model can appear on several agencies'
  // rosters, each with its own relationship row/terms.
  relationshipId: string;
  relationshipType: string;
  isMotherAgency: boolean;
  territories: string[];
  exclusivity: RepresentationExclusivity;
  effectiveStartDate: string;
  effectiveEndDate: string | null;
}

// ─── CAMPAIGN MESSAGING ─────────────────────────────────────────────────
// Brand<->agency messaging is scoped per campaign AND per agency — two
// agencies on the same campaign never share a thread or see each other's
// messages. Models get read-only access to their own agency's thread
// (no compose, no reply). `broadcast` marks a message sent once by the
// brand to every agency's thread on a campaign at once (e.g. "call time
// moved to 8am") — the one exception to threads being fully separate.
export interface CampaignThreadMessage {
  id: number;
  from: string;
  fromOrg: string;
  text: string;
  ts: string;
  broadcast?: boolean;
}

// ─── CAMPAIGNS (shared record, individually addressable) ──────────────────

export type CampaignType = "Campaign" | "Runway" | "Event" | "Other";
export type CampaignStatus = "active" | "drafts" | "archived";

export interface Campaign {
  id: number;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  due: string;
  // The raw ISO date `due` was formatted from — `due` itself often omits
  // the year ("Jul 22"), which new Date() silently misparses (defaults
  // to 2001), so anything that needs a real date for comparison/plotting
  // (the calendar tab) must use this instead of parsing `due`.
  dueDateISO?: string;
  dueLabel: string;
  dueUrgency: "high" | "medium" | "low";
  // Window during which agencies can submit talent — separate from `due`
  // (the shoot/deliverable date). Parsed with `new Date(...)` for the
  // open/closed comparison against MOCK_NOW, so keep these in a
  // Date-parseable format like "Jun 1, 2026".
  submissionOpen: string;
  submissionClose: string;
  submitted: number;
  approved: number;
  booked: number;
  talentNeeded: number;
  budget: number;
  committed: number;
  remaining: number;
  // Set only on Runway campaigns — the mechanism for "different brands
  // walking the same physical show". Multiple campaigns (different
  // brands) can point at the same RunwayShow id.
  runwayShowId?: number;
  // The campaign's primary casting/shoot territory — compared against
  // agency_model_relationships.territories when resolving which
  // relationship applies to a submission (see submit_talent RPC, 0029).
  territory?: string;
  // Card cover art shown to the brand itself (mood/editorial stock,
  // black & white) — mock-only placeholder for the real photo-picker
  // this stands in for. Agencies/models see the brand's own logo
  // instead of this photo; see BrandLogoBadge in BrandApp.tsx.
  coverPhoto?: string;
}

// A physical runway show — the shared event. Not owned by any one
// brand; each brand's Campaign references it via runwayShowId so two
// brands walking the same show on the same day stay properly linked
// instead of each re-describing the same venue/time independently.
export interface RunwayShow {
  id: number;
  name: string;
  venue: string;
  date: string;
  time: string;
  timeZone: string;
  season: string;
}

// ─── RUNWAY CASTING ─────────────────────────────────────────────────────────

// Day-of checklist, not a linear pipeline — a model can be
// fitting-complete before another is even optioned, so every stage is
// independently toggleable rather than columns you drag between.
export type CastingStageId = "confirmed" | "optioned" | "fittingComplete" | "rehearsalComplete" | "checkedIn" | "walked" | "wrapComplete";

export interface CastingEntry {
  modelId: number;
  campaignId: number;
  stages: Record<CastingStageId, boolean>;
}

// One numbered look for a runway campaign — garments/accessories plus
// who's assigned to execute it (model, hair, makeup, dresser).
export interface Look {
  id: number;
  campaignId: number;
  number: number;
  garments: string;
  shoes: string;
  jewelry: string;
  accessories: string;
  stylistNotes: string;
  dressingNotes: string;
  assignedModelId?: number;
  assignedHairId?: number;
  assignedMakeupId?: number;
  assignedDresserId?: number;
}

export type CrewRole = "hair" | "makeup" | "dresser" | "photographer" | "production" | "security" | "transportation";

export interface CrewMember {
  id: number;
  name: string;
  role: CrewRole;
}
