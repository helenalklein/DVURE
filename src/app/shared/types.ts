export type Role = "brand" | "agency" | "model" | "crew";

// "approved"/"rejected" still exist as dormant values in the DB enum
// (0077/0078 — kept rather than dropped, in case an unseen RPC still
// writes them) but no app code should ever produce them going forward,
// so they're deliberately left out of this type.
export type SubmissionStage = "candidate" | "submitted" | "shortlisted" | "selected" | "booked" | "declined" | "released";

export type Availability = "available" | "pending" | "unavailable";

export type PaymentStatus = "pending" | "processing" | "paid";

export type RepresentationExclusivity = "exclusive" | "non_exclusive" | "limited" | "not_specified";

export interface Talent {
  id: number;
  name: string;
  // Demo-only headshot for the mock roster (SAMPLE_TALENT) — real
  // submissions have no photo source wired yet, so this is undefined
  // for anything coming from fetchCampaignSubmissions().
  // For real submissions this is a stock portrait assigned by
  // assignStockPhotos (mockData.ts), not the model's actual uploaded
  // photo — see that function's own comment for why.
  photo?: string;
  // Real column on model_profiles (0086), agency-set at intake. Also
  // what assignStockPhotos prefers over the dress-size heuristic when
  // present.
  sex?: string;
  // agency = who actually submitted this candidate (mother or boutique —
  // whichever agency clicked submit). motherAgency/boutiqueAgency show on
  // the card regardless of who submitted, so the brand always knows the
  // full representation picture, not just the submitter.
  agency: string;
  motherAgency: string;
  // Every OTHER active agency relationship on this model (i.e. every
  // relationship that isn't the mother one) — a model can have more
  // than one non-exclusive representation at once, so this is a list,
  // not a single name.
  boutiqueAgencies: string[];
  // Who actually clicked submit — real profile data, not a placeholder.
  submittedByName?: string;
  submittedByEmail?: string;
  // The model's own contact email (model_profiles.email) — distinct
  // from submittedByEmail (whoever at the agency clicked submit).
  // Surfaced on the flip side of CompCard.
  modelEmail?: string;
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
  // True when this same model was submitted to this campaign by more
  // than one agency — surfaced as a flag, never auto-resolved (a
  // brand should see the model once, not once per agency, but should
  // still know more than one agency is involved before booking).
  duplicateFlag?: boolean;
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
//
// The relationship* fields describe THIS agency's own representation
// relationship with the model, not the model globally — a model can
// have other agencies' relationships DVURE never surfaces here. Terms
// (type, territory, exclusivity, dates) live on the relationship, not
// the agency account, since the same agency can represent different
// models under very different terms (see agency_model_relationships).
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
  relationshipId?: string;
  relationshipType?: string;
  isMotherAgency?: boolean;
  territories?: string[];
  exclusivity?: RepresentationExclusivity;
  effectiveStartDate?: string;
  effectiveEndDate?: string | null;
  sex?: string;
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
  // Which market this campaign is running in — read by submit_talent
  // server-side to decide whether another agency's active representation
  // relationship "applies" here (territory-matched) when flagging a
  // duplicate submission. Optional: a campaign with no territory set
  // just means every relationship's territory is treated as applicable.
  territory?: string;
  // Card cover art shown to the brand itself (mood/editorial stock,
  // black & white) — mock-only placeholder for the real photo-picker
  // this stands in for. Agencies/models see the brand's own logo
  // instead of this photo; see BrandLogoBadge in BrandApp.tsx.
  coverPhoto?: string;
  // Set at creation, defaults off (most casting is digital now). Gates
  // whether the campaign workspace shows a Casting tab at all — most
  // campaigns never need one.
  hasInPersonCasting?: boolean;
  // Raw ISO twin of submissionClose (see dueDateISO above) — the
  // finalization countdown needs a real timestamp to do math against,
  // not the Date-parseable-but-year-optional display string.
  submissionCloseISO?: string;
  // Null means "use this brand's org-wide default" (OrgInfo.
  // defaultFinalizationHours) rather than a hardcoded fallback here, so
  // changing the org default retroactively applies to every campaign
  // that hasn't set its own override.
  finalizationHours?: number | null;
  // Set once, permanently, by finalize_campaign_board — either the
  // manual "Finalize" button or the auto-finalize cron sweep
  // (submission_close + finalizationHours hours later). Non-null means
  // the Model Board has switched to its clean, Booked-only permanent view.
  boardFinalizedAt?: string | null;
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
// Casting Board (day-of checklist) was pulled — it's part of Relay,
// deferred to Phase 2 along with the rest of that module. Looks (which
// model wears which garment) is real data now — see CampaignLook in
// lib/queries/looks.ts, not Relay scope.
