export type Role = "brand" | "agency" | "model";

export type SubmissionStage = "submitted" | "approved" | "rejected" | "booked";

export type Availability = "available" | "pending" | "unavailable";

export type PaymentStatus = "pending" | "processing" | "paid";

export interface Talent {
  id: number;
  name: string;
  // agency = who actually submitted this candidate (mother or boutique —
  // whichever agency clicked submit). motherAgency/boutiqueAgency show on
  // the card regardless of who submitted, so the brand always knows the
  // full representation picture, not just the submitter.
  agency: string;
  motherAgency: string;
  boutiqueAgency?: string;
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

export type CampaignType = "Runway" | "Editorial" | "Advertising" | "E-commerce" | "TV Commercial" | "Beauty" | "Other";
export type CampaignStatus = "active" | "drafts" | "archived";

export interface Campaign {
  id: number;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  due: string;
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
