import { useState, useMemo, useEffect } from "react";
import { LogOut, Plus, Send, MessageSquare, Inbox, Users2, CreditCard, X, UserPlus, Search, ChevronRight, AlertCircle, Share2 } from "lucide-react";
import { cx, XBox, Badge, Btn, Stat, TopBar, TextInput, FSelect, Textarea, FieldLabel, Modal, CurrentUserProvider, useCurrentUser, CountryFlag, DvureSignature, DvureMark, OrgLogoBox, MobileNavDrawer, Chip } from "../shared/ui";
import { BOOKINGS, bookingBreakdown, MOCK_NOW, CAMPAIGNS, CAMPAIGN_AGENCY_THREADS, ORG_COUNTRY } from "../shared/mockData";
import type { RosterModel, CampaignThreadMessage, RepresentationExclusivity } from "../shared/types";
import { useAuth } from "../shared/auth";
import { updateOrgLogo } from "../../lib/queries/auth";
import {
  fetchAgencyRoster, checkPossibleModelDuplicate, addNewModelToRoster, linkModelToExistingRoster,
  type RelationshipTerms,
} from "../../lib/queries/roster";
import { createModelDocument, uploadModelDocumentFile, type DocumentCategory } from "../../lib/queries/documents";
import { findCampaignIdByName } from "../../lib/queries/campaigns";
import { insertSubmission } from "../../lib/queries/submissions";
import { createModelInvite } from "../../lib/queries/invites";
import { fetchAgencyInvitations, type AgencyInvitation } from "../../lib/queries/agencyInvitations";
import { fetchPendingConfirmationsForAgency, fetchInvoicesForAgency, type Invoice, type InvoiceStatus } from "../../lib/queries/payments";
import { fetchAgencyPayouts, type AgencyPayout, type TransferStatus } from "../../lib/queries/payouts";
import SubscriptionPanel from "../shared/SubscriptionPanel";
import PaymentConfirmQueue from "../shared/PaymentConfirmQueue";
import NetworkView from "../shared/NetworkView";

type Invitation = { brand: string; campaign: string; type: string; due: string; budget: string; models: number; submissionOpen: string; submissionClose: string; realCampaignId?: string };

type View = "invitations" | "submit" | "roster" | "network" | "payments" | "messaging" | "settings";

const NAV: { id: View; label: string; Icon: typeof Inbox; count?: number }[] = [
  { id:"invitations", label:"Campaign Invitations", Icon:Inbox                 },
  { id:"submit",       label:"Talent Submissions",   Icon:Send                  },
  { id:"roster",       label:"Talent Roster",        Icon:Users2                },
  { id:"network",      label:"Network",              Icon:Share2                },
  { id:"payments",     label:"Payments",             Icon:CreditCard            },
  { id:"messaging",    label:"Messaging",            Icon:MessageSquare, count:1 },
];

// Agency's own Settings — leaner than the brand's (no Billing/Security/
// Org/Notifications/Audit placeholders that were never real), just
// Profile plus the one real, working surface: the pilot subscription.
function AgencySettingsScreen({ onLogout, onMenuClick }: { onLogout: () => void; onMenuClick?: () => void }) {
  const { profile, org } = useAuth();
  const isAdmin = org?.accessLevel === "administrator";
  const [tab, setTab] = useState<"profile"|"subscription">("profile");
  const TABS: [string,string][] = [
    ["profile","Profile"],
    ...(isAdmin ? [["subscription","Subscription"] as [string,string]] : []),
  ];
  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <TopBar title="Settings" sub={`${org?.name ?? ""} · Account settings`} onMenuClick={onMenuClick}/>
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <div className="shrink-0 border-b md:border-b-0 md:border-r glass px-2 py-2 md:py-4 flex md:block gap-0.5 md:space-y-0.5 overflow-x-auto md:w-44">
          {TABS.map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id as typeof tab)}
              className={cx("shrink-0 md:w-full text-left px-3 py-2 text-sm rounded-md cursor-pointer transition-colors",
                tab===id?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}>{label}</button>
          ))}
          <div className="hidden md:block pt-4 border-t border-border mt-4">
            <button onClick={onLogout} className="w-full text-left px-3 py-2 text-sm rounded-md cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center gap-2">
              <LogOut size={13}/> Sign out
            </button>
            <div className="px-3 pt-3 text-[10px] text-muted-foreground leading-relaxed">
              Need help? <span className="text-foreground font-medium">support@dvure.com</span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-xl">
            {tab === "profile" && (
              <div className="space-y-5">
                <div><h2 className="text-heading text-base mb-0.5">Profile</h2><p className="text-sm text-muted-foreground">Your personal account details.</p></div>
                {!isAdmin && (
                  <div className="bg-secondary border border-border rounded-md px-4 py-3 text-xs text-muted-foreground">
                    Your title is set by your organization's administrator and can't be changed here.
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <FieldLabel>Name</FieldLabel>
                    <div className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm">{profile?.fullName}</div>
                  </div>
                  <div>
                    <FieldLabel>Organization</FieldLabel>
                    <div className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-muted-foreground">{org?.name}</div>
                  </div>
                  <TextInput label="Email" type="email" placeholder="you@agency.com" defaultValue={profile?.email}/>
                </div>
              </div>
            )}
            {tab === "subscription" && (
              <div className="space-y-5">
                <div><h2 className="text-heading text-base mb-0.5">Subscription</h2><p className="text-sm text-muted-foreground">Manage your DVURE Agency subscription.</p></div>
                <SubscriptionPanel/>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mock-only invitations — AW25 has no realCampaignId attached since its
// real counterpart is matched by name (findCampaignIdByName) for
// backward compatibility with the original single-campaign real loop.
// Every campaign actually distributed via campaign_agency_distributions
// now shows up for real (see fetchAgencyInvitations) alongside these.
const INVITATIONS: Invitation[] = [
  { brand:"Vellani", campaign:"AW25 Womenswear Campaign", type:"Campaign", due:"06/20/2025", budget:"$800–$1,200/day", models:3, submissionOpen:"May 1, 2026", submissionClose:"Aug 15, 2026" },
  { brand:"Nike",         campaign:"Run Global SS25",          type:"Campaign", due:"07/01/2025", budget:"$600–$900/day",   models:5, submissionOpen:"Jul 1, 2026", submissionClose:"Aug 5, 2026"  },
  { brand:"Chanel",       campaign:"Beauty Editorial AW25",    type:"Campaign", due:"06/28/2025", budget:"$1,200–$2,000/day", models:2, submissionOpen:"Jul 10, 2026", submissionClose:"Jul 24, 2026" },
];

function submissionIsClosed(inv: { submissionClose: string }) {
  return MOCK_NOW > new Date(inv.submissionClose);
}

// Deterministic tile color per brand name — no logo assets exist (or
// should exist here, real trademarks aren't ours to reproduce), so this
// stands in for "the brand's own mark" the same way the sidebar's
// single-letter avatar does elsewhere in the app.
const LOGO_TILE_COLORS = ["#1E1C1A", "#3D3A35", "#5B5650", "#2A2E35", "#33241F"];
function brandTileColor(brand: string) {
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = (hash * 31 + brand.charCodeAt(i)) >>> 0;
  return LOGO_TILE_COLORS[hash % LOGO_TILE_COLORS.length];
}
function BrandLogoBadge({ brand }: { brand: string }) {
  const initials = brand.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: brandTileColor(brand) }}>
      <div className="text-center">
        <div className="text-heading text-3xl text-white tracking-wide">{initials}</div>
        <div className="text-[9px] font-mono text-white/60 uppercase tracking-[0.2em] mt-1">{brand}</div>
      </div>
    </div>
  );
}

// Mirrors BrandApp's campaign card structure exactly — same layout, same
// stat/footer treatment — but the cover slot shows the brand's own mark
// instead of mood/editorial stock. An agency or model cares who's
// hiring first; the brand doesn't need to be told its own campaign is
// its own campaign, so it gets the photo instead. Same data, two reads.
function InvitationsView({ invitations, onSubmitTalent }: { invitations: Invitation[]; onSubmitTalent: (campaign: string) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Brand campaign invitations requiring talent submissions.</p>
      {invitations.length === 0 && (
        <div className="border border-dashed border-border rounded-md p-10 text-center text-sm text-muted-foreground">No campaign invitations yet.</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {invitations.map(inv=>{
          const closed = submissionIsClosed(inv);
          return (
            <div key={inv.campaign} className="glass-subtle border rounded-lg overflow-hidden">
              <div className="relative aspect-[4/3]">
                <BrandLogoBadge brand={inv.brand}/>
                <div className="absolute top-2.5 left-2.5">
                  <Badge label={`${inv.models} needed`} variant="info"/>
                </div>
              </div>
              <div className="p-4">
                <div className="text-sm font-semibold leading-snug">{inv.campaign}</div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">{inv.type}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{inv.brand}</div>
                <div className="text-[10px] text-muted-foreground font-mono mt-3 pt-3 border-t border-border flex items-center gap-1.5">
                  <span>Submissions {inv.submissionOpen} – {inv.submissionClose}</span>
                  {closed
                    ? <span className="text-urgent font-semibold">Closed</span>
                    : <span className="text-offwhite-foreground bg-offwhite px-1 rounded-sm font-semibold">Open</span>}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono mt-1">Budget {inv.budget} · Due {inv.due}</div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <Btn variant="primary" size="sm" disabled={closed} onClick={()=>onSubmitTalent(inv.campaign)}>
                    {closed ? "Closed" : "Submit Talent"}
                  </Btn>
                  <Btn variant="outline" size="sm">Brief</Btn>
                  <Btn variant="ghost" size="sm">Decline</Btn>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Visual, alphabetically-indexed model picker — a card board, not a
// dropdown. This industry casts off photos and physical presence, not
// text lists, so selection should feel like flipping through a board.
function RosterPickerModal({ roster, campaign, statusFor, onPick, onClose }: {
  roster: RosterModel[]; campaign: string; statusFor: (modelId: string, campaign: string) => CampaignSubmissionStatus | undefined;
  onPick: (id: string) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const filtered = roster
      .filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a,b) => a.name.localeCompare(b.name));
    const byLetter = new Map<string, RosterModel[]>();
    for (const m of filtered) {
      const letter = m.name.trim()[0]?.toUpperCase() ?? "#";
      if (!byLetter.has(letter)) byLetter.set(letter, []);
      byLetter.get(letter)!.push(m);
    }
    return [...byLetter.entries()].sort(([a],[b]) => a.localeCompare(b));
  }, [roster, search]);

  const letters = groups.map(([l]) => l);

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <div className="text-heading text-sm">Choose a Model</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">From your roster, A–Z</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
      </div>
      <div className="px-6 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <div className="flex-1 flex items-center border border-border rounded-md bg-input-background px-3 gap-2 h-9">
          <Search size={13} className="text-muted-foreground"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search roster…"
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"/>
        </div>
        {letters.length>0 && (
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-muted-foreground shrink-0">
            {letters.map(l=><span key={l} className="w-4 text-center">{l}</span>)}
          </div>
        )}
      </div>
      <div className="max-h-[26rem] overflow-y-auto px-6 py-4 space-y-6">
        {groups.length===0 && <div className="text-center text-sm text-muted-foreground py-10">No models match "{search}"</div>}
        {groups.map(([letter, models]) => (
          <div key={letter}>
            <div className="text-xs font-display italic text-muted-foreground mb-2 sticky -top-4 bg-transparent">{letter}</div>
            <div className="grid grid-cols-3 gap-3">
              {models.map(m=>{
                const status = statusFor(m.id, campaign);
                const blocked = !!status;
                return (
                  <button key={m.id} onClick={()=>{ if (!blocked) onPick(m.id); }} disabled={blocked}
                    className={cx("text-left glass-subtle border rounded-md overflow-hidden transition-all group relative",
                      blocked ? "opacity-50 cursor-not-allowed" : "hover:border-foreground hover:shadow-md"
                    )}>
                    <XBox className="w-full h-24"/>
                    {status && (
                      <div className={cx("absolute top-1.5 right-1.5 text-[8px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-sm font-semibold",
                        status.status==="declined" ? "bg-urgent text-urgent-foreground" : "bg-offwhite text-offwhite-foreground"
                      )}>
                        {status.status==="declined" ? "Declined" : "Submitted"}
                      </div>
                    )}
                    <div className="p-2.5 space-y-0.5">
                      <div className="text-xs font-semibold truncate flex items-center gap-1">{m.name} <CountryFlag location={m.location} className="text-[11px] shrink-0"/></div>
                      <div className="text-[10px] text-muted-foreground truncate">{m.location}</div>
                      <div className="text-[10px] font-mono font-medium mt-1">{m.rate}</div>
                      {status && (
                        <div className="text-[9px] text-muted-foreground pt-0.5">
                          {status.status==="declined" ? "Already declined for this campaign" : "Already submitted, awaiting review"}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// A model already submitted (pending) or declined by THIS agency for a
// given campaign can't be resubmitted by this agency — a decline is
// final. This no longer blocks a *different* agency from submitting the
// same model to the same campaign (submissions dropped its
// unique(campaign_id, model_id) constraint — see submit_talent): that
// case succeeds and comes back with duplicateSubmission/overlapWarning
// instead of an error, since more than one agency legitimately
// representing (or believing they represent) the same model is a real,
// expected scenario, not something DVURE should silently pick a winner
// for.
//
// This local status is only ever populated from THIS session's own
// successful submits (see handleSubmit below) — it can't pre-block a
// model another agency already submitted, since RLS hides that agency's
// submission row entirely.
type CampaignSubmissionStatus = { modelId: string; campaign: string; status: "pending" | "declined" };

function SubmitTalentView({ roster, invitations, onGoToRoster, initialCampaign }: { roster: RosterModel[]; invitations: Invitation[]; onGoToRoster: () => void; initialCampaign?: string }) {
  const { profile, org } = useAuth();
  const [submitted, setSubmitted] = useState<CampaignSubmissionStatus[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [pickedCampaign, setPickedCampaign] = useState(initialCampaign ?? invitations[0]?.campaign ?? "");
  const [pickedModelId, setPickedModelId] = useState<string | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitNote, setSubmitNote] = useState("");
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  function statusFor(modelId: string, campaign: string) {
    return submitted.find(s => s.modelId === modelId && s.campaign === campaign);
  }

  const submittedIds = new Set(submitted.filter(s=>s.status==="pending").map(s=>s.modelId));
  const pickedModel = roster.find(m=>m.id===pickedModelId);
  const pickedInvitation = invitations.find(i=>i.campaign===pickedCampaign);
  const submissionClosed = pickedInvitation ? submissionIsClosed(pickedInvitation) : false;
  const pickedStatus = pickedModel ? statusFor(pickedModel.id, pickedCampaign) : undefined;

  function selectModel(id: string) {
    setPickedModelId(id);
    setPickedCampaign(initialCampaign ?? invitations[0]?.campaign ?? "");
    setSubmitError(null);
    setShowPicker(false);
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!pickedModel || !org || !profile) return;
    setSubmitting(true);
    setSubmitError(null);
    // Real invitations already know their own campaign id — falling
    // back to a name lookup only for the legacy mock/real AW25 pairing,
    // where two rows can share a name and a lookup is genuinely
    // ambiguous otherwise.
    const realCampaignId = pickedInvitation?.realCampaignId ?? await findCampaignIdByName(pickedCampaign);
    if (!realCampaignId) {
      setSubmitting(false);
      setSubmitError("This campaign isn't connected yet — check back once it's set up.");
      return;
    }
    const { overlapWarning: warning, error } = await insertSubmission({
      campaignId: realCampaignId,
      modelId: pickedModel.id,
      notes: submitNote.trim() || undefined,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(
        error.code === "23505"
          ? `${pickedModel.name} has already been submitted to this campaign.`
          : "Couldn't submit this model — try again."
      );
      return;
    }
    setSubmitted(p => [...p, { modelId: pickedModel.id, campaign: pickedCampaign, status: "pending" }]);
    setSubmitNote("");
    setShowForm(false);
    // Never a hard block — submit_talent already recorded the
    // submission. This just surfaces its territory/overlap finding so
    // the agency can confirm they're actually authorized here, per the
    // representation-relationship spec ("flag, don't silently pick a
    // winner"). Shown until dismissed rather than a toast, since it's
    // worth actually reading.
    if (warning) setOverlapWarning(warning);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Submit models from your roster to open campaigns.</p>
        <Btn variant="primary" size="sm" icon={<Plus size={12}/>} onClick={()=>setShowPicker(true)} disabled={roster.length===0}>Submit Talent</Btn>
      </div>

      {overlapWarning && (
        <div className="flex items-start gap-2 text-xs text-[#D4A017] bg-[#D4A017]/10 border border-[#D4A017]/30 rounded-md px-3 py-2.5">
          <AlertCircle size={13} className="mt-0.5 shrink-0"/>
          <span className="flex-1">{overlapWarning}</span>
          <button onClick={()=>setOverlapWarning(null)} className="text-[#D4A017] hover:opacity-70 shrink-0"><X size={13}/></button>
        </div>
      )}

      {roster.length===0 && (
        <div className="border border-dashed border-border rounded-md p-8 text-center space-y-3">
          <div className="text-sm text-muted-foreground">Your roster is empty — add a model before you can submit talent to a campaign.</div>
          <Btn variant="primary" size="sm" icon={<UserPlus size={12}/>} onClick={onGoToRoster}>Add Model</Btn>
        </div>
      )}

      <div className="space-y-2">
        {roster.filter(m=>submittedIds.has(m.id)).map(m=>{
          const sub = submitted.find(s=>s.modelId===m.id)!;
          return (
            <div key={m.id} className="glass-subtle border border-dashed rounded-md p-4 flex items-center gap-4 opacity-70">
              <XBox className="w-12 h-12 rounded-md shrink-0"/>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{m.name}</div>
                <div className="text-xs text-muted-foreground">{sub.campaign} · awaiting brand review</div>
              </div>
              <Badge label="Submitted" variant="pending"/>
            </div>
          );
        })}
        {roster.filter(m=>!submittedIds.has(m.id)).map(m=>(
          <div key={m.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
            <XBox className="w-12 h-12 rounded-md shrink-0"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.location} · {m.rate}</div>
            </div>
            <Btn variant="outline" size="sm" onClick={()=>selectModel(m.id)}>Submit</Btn>
          </div>
        ))}
      </div>

      {showPicker && (
        <RosterPickerModal roster={roster} campaign={pickedCampaign} statusFor={statusFor} onPick={selectModel} onClose={()=>setShowPicker(false)}/>
      )}

      {showForm && pickedModel && (
        <Modal onClose={()=>setShowForm(false)}>
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="text-heading text-sm">Submit Talent</div>
            <button onClick={()=>setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <FieldLabel>Model</FieldLabel>
              <button onClick={()=>{ setShowForm(false); setShowPicker(true); }}
                className="w-full flex items-center gap-3 border border-border rounded-md p-2.5 hover:border-foreground transition-colors text-left">
                <XBox className="w-10 h-10 rounded-sm shrink-0"/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{pickedModel.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{pickedModel.location} · {pickedModel.rate}</div>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5 shrink-0">Change <ChevronRight size={11}/></span>
              </button>
              <div className="text-[10px] text-muted-foreground font-mono mt-1">Pulled from their <DvureSignature size={9}/> profile.</div>
            </div>
            <FSelect label="Campaign" options={invitations.map(i=>i.campaign)} value={pickedCampaign} onChange={setPickedCampaign}/>
            {pickedInvitation && (
              <div className={cx("text-[10px] font-mono flex items-center gap-1.5", submissionClosed ? "text-urgent" : "text-muted-foreground")}>
                <span>Submissions {pickedInvitation.submissionOpen} – {pickedInvitation.submissionClose}</span>
                {submissionClosed
                  ? <span className="font-semibold">Closed</span>
                  : <span className="text-offwhite-foreground bg-offwhite px-1 rounded-sm font-semibold">Open</span>}
              </div>
            )}
            {submissionClosed && (
              <div className="text-xs text-urgent bg-urgent/5 border border-urgent rounded-md px-3 py-2">
                This campaign's submission window closed {pickedInvitation!.submissionClose}. Talent can no longer be submitted.
              </div>
            )}
            {pickedStatus && (
              <div className="text-xs text-urgent bg-urgent/5 border border-urgent rounded-md px-3 py-2">
                {pickedStatus.status==="declined"
                  ? `${pickedModel.name} was already declined for this campaign and can't be resubmitted.`
                  : `${pickedModel.name} is already submitted to this campaign, awaiting brand review.`}
              </div>
            )}
            {submitError && (
              <div className="text-xs text-urgent bg-urgent/5 border border-urgent rounded-md px-3 py-2">{submitError}</div>
            )}
            <Textarea label="Note to brand" placeholder="Optional — why this model fits the brief…" rows={3} value={submitNote} onChange={e=>setSubmitNote(e.target.value)}/>
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <Btn variant="primary" disabled={submissionClosed || !!pickedStatus || submitting} onClick={handleSubmit}>
              {submitting ? "Submitting…" : "Submit"}
            </Btn>
            <Btn variant="outline" onClick={()=>setShowForm(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Curated options exist to nudge toward consistent, comparable values
// (so territory/type matching across relationships actually lines up)
// without enforcing a closed set — both fields accept free custom entry,
// since DVURE shouldn't be the one deciding what representation types
// exist in this industry.
const CURATED_REPRESENTATION_TYPES = [
  "Mother Agency / Mother Management", "Market / Booking Agency", "Modeling Agency",
  "Management", "Exclusive Representation", "Non-Exclusive Representation", "Other",
];
const CURATED_TERRITORIES = [
  "New York", "Los Angeles", "Miami", "Chicago", "Paris", "Milan", "London", "Tokyo", "Shanghai",
  "United States", "Europe", "North America", "Worldwide",
];
const EXCLUSIVITY_OPTIONS: { value: RepresentationExclusivity; label: string }[] = [
  { value: "not_specified", label: "Not specified" },
  { value: "exclusive", label: "Exclusive" },
  { value: "non_exclusive", label: "Non-exclusive" },
  { value: "limited", label: "Limited" },
];
const RESTRICTED_DOC_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "representation_agreement", label: "Representation Agreement" },
  { value: "management_agreement", label: "Management Agreement" },
  { value: "commission_agreement", label: "Commission Agreement" },
  { value: "placement_agreement", label: "Placement Agreement" },
  { value: "amendment", label: "Amendment" },
  { value: "other_restricted", label: "Other" },
];

type AddModelStep = 1 | 2 | 3;

// Every model added goes through a real representation relationship —
// type, territory, exclusivity, effective dates, an optional supporting
// document, and (if a document's attached) the 4 attestations DVURE
// requires rather than interpreting the agreement itself. Step 1 also
// runs a live duplicate-person check (check_possible_model_duplicate)
// so two agencies uploading the same person become one canonical
// model_profiles row with two relationships, not two disconnected
// profiles.
function AddModelModal({ onClose, onAdded }: { onClose: () => void; onAdded: (m: RosterModel) => void }) {
  const { org } = useAuth();
  const [step, setStep] = useState<AddModelStep>(1);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [rate, setRate] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");

  const [checkingDup, setCheckingDup] = useState(false);
  const [dupConfidence, setDupConfidence] = useState<"high" | "low" | null>(null);
  const [dupModelId, setDupModelId] = useState<string | null>(null);
  const [dupResolved, setDupResolved] = useState(false);
  const [linkExisting, setLinkExisting] = useState(false);

  const [representationType, setRepresentationType] = useState("");
  const [isMotherAgency, setIsMotherAgency] = useState(false);
  const [territories, setTerritories] = useState<string[]>([]);
  const [territoryInput, setTerritoryInput] = useState("");
  const [exclusivity, setExclusivity] = useState<RepresentationExclusivity>("not_specified");
  const [effectiveStartDate, setEffectiveStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveEndDate, setEffectiveEndDate] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [docCategory, setDocCategory] = useState<DocumentCategory>("representation_agreement");
  const [attestAuthority, setAttestAuthority] = useState(false);
  const [attestUploadRights, setAttestUploadRights] = useState(false);
  const [attestAccurate, setAttestAccurate] = useState(false);
  const [attestWillUpdate, setAttestWillUpdate] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ model: RosterModel; overlapWarning: string | null } | null>(null);

  async function runDuplicateCheck() {
    if (!name.trim() || (!email.trim() && !phone.trim() && !dateOfBirth)) return;
    setCheckingDup(true);
    const r = await checkPossibleModelDuplicate({ fullName: name, email, phone, dateOfBirth, location });
    setCheckingDup(false);
    setDupConfidence(r.matchConfidence);
    setDupModelId(r.existingModelId);
    setDupResolved(r.matchConfidence !== "high");
    setLinkExisting(false);
  }

  function toggleTerritory(t: string) {
    setTerritories(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  }
  function addCustomTerritory() {
    const v = territoryInput.trim();
    if (v && !territories.includes(v)) setTerritories(p => [...p, v]);
    setTerritoryInput("");
  }

  const allAttested = attestAuthority && attestUploadRights && attestAccurate && attestWillUpdate;
  const step1Valid = !!name && !!email && (dupConfidence !== "high" || dupResolved);
  const step2Valid = !!representationType && territories.length > 0;
  const step3Valid = !file || allAttested; // document is optional, but attestations are required if one is attached

  async function handleFinalSubmit() {
    if (!org) return;
    setSaving(true);
    setError(null);
    const terms: RelationshipTerms = {
      representationType, isMotherAgency, territories, exclusivity,
      effectiveStartDate, effectiveEndDate: effectiveEndDate || undefined,
    };

    let modelId: string | null = null;
    let relationshipId: string | null = null;
    let overlapWarning: string | null = null;

    if (linkExisting && dupModelId) {
      const r = await linkModelToExistingRoster(dupModelId, terms);
      if (r.error) { setSaving(false); setError(r.error); return; }
      modelId = dupModelId;
      relationshipId = r.relationshipId;
      overlapWarning = r.overlapWarning;
    } else {
      const r = await addNewModelToRoster(
        { name, email, location, rate, height: "—", exp: "—", dateOfBirth: dateOfBirth || undefined, phone: phone || undefined },
        terms
      );
      if (r.error) { setSaving(false); setError(r.error); return; }
      modelId = r.modelId;
      relationshipId = r.relationshipId;
      overlapWarning = r.overlapWarning;
    }

    if (file && modelId) {
      const created = await createModelDocument({
        modelId, relationshipId: relationshipId || undefined, category: docCategory,
        fileName: file.name, mimeType: file.type,
        attestations: { authority: attestAuthority, uploadRights: attestUploadRights, accurate: attestAccurate, willUpdate: attestWillUpdate },
      });
      if (created.error || !created.storageBucket || !created.storagePath) {
        setSaving(false); setError(created.error ?? "Couldn't record the document."); return;
      }
      const uploaded = await uploadModelDocumentFile(created.storageBucket, created.storagePath, file);
      if (uploaded.error) { setSaving(false); setError(uploaded.error); return; }
    }

    const newModel: RosterModel = {
      id: modelId!, name, email, agency: org.name, location: location || "—", rate: rate || "—",
      height: "—", exp: "—", hasLogin: false,
      relationshipId: relationshipId!, relationshipType: representationType, isMotherAgency,
      territories, exclusivity, effectiveStartDate, effectiveEndDate: effectiveEndDate || null,
    };
    setSaving(false);
    setResult({ model: newModel, overlapWarning });
    onAdded(newModel);
  }

  // Once the RPCs have actually run, replace the form with a summary —
  // most importantly the overlap warning, if any, which needs its own
  // explicit acknowledgment rather than just flashing and closing.
  if (result) {
    return (
      <Modal onClose={onClose}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="text-heading text-sm">{result.model.name} added</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
        </div>
        <div className="p-5 space-y-3">
          {result.overlapWarning ? (
            <div className="text-xs text-urgent bg-urgent/5 border border-urgent rounded-md px-3 py-2">{result.overlapWarning}</div>
          ) : (
            <div className="text-xs text-muted-foreground">Representation relationship created.</div>
          )}
        </div>
        <div className="px-5 pb-5">
          <Btn variant="primary" fullWidth onClick={onClose}>Done</Btn>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-heading text-sm">Add Model to Roster</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Step {step} of 3</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
      </div>

      {step === 1 && (
        <div className="p-5 space-y-3">
          <TextInput label="Full Name" placeholder="e.g. Nadia Petrov" value={name} onChange={e=>setName(e.target.value)}/>
          <TextInput label="Email" placeholder="model@example.com" type="email" value={email}
            onChange={e=>setEmail(e.target.value)} onBlur={runDuplicateCheck}/>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Phone" placeholder="Optional" value={phone} onChange={e=>setPhone(e.target.value)} onBlur={runDuplicateCheck}/>
            <TextInput label="Date of Birth" placeholder="YYYY-MM-DD" type="date" value={dateOfBirth} onChange={e=>setDateOfBirth(e.target.value)} onBlur={runDuplicateCheck}/>
          </div>
          <TextInput label="Location" placeholder="e.g. New York, NY" value={location} onChange={e=>setLocation(e.target.value)}/>
          <TextInput label="Day Rate" placeholder="e.g. $1,000/day" value={rate} onChange={e=>setRate(e.target.value)}/>

          {checkingDup && <div className="text-[10px] text-muted-foreground font-mono">Checking for an existing profile…</div>}

          {dupConfidence === "high" && !dupResolved && (
            <div className="text-xs text-urgent bg-urgent/5 border border-urgent rounded-md px-3 py-2.5 space-y-2">
              <div className="font-medium">This model may already have a DVURE profile.</div>
              <div>Confirm whether this is the same person before continuing.</div>
              <div className="flex gap-2 pt-1">
                <Btn variant="primary" size="sm" onClick={()=>{ setLinkExisting(true); setDupResolved(true); }}>Yes — link representation</Btn>
                <Btn variant="outline" size="sm" onClick={()=>{ setLinkExisting(false); setDupResolved(true); }}>No — different person</Btn>
              </div>
            </div>
          )}
          {dupConfidence === "low" && (
            <Badge label="A similarly-named model may already exist — double check before continuing" variant="warning"/>
          )}

          <div className="bg-secondary border border-border rounded-md px-3 py-2 text-xs text-muted-foreground">
            An invitation email will be sent to this model to set up their <DvureSignature size={11}/> login, so they can see their own bookings and payment status.
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="p-5 space-y-3">
          <div>
            <FieldLabel>Representation Type</FieldLabel>
            <div className="flex flex-wrap gap-2 mb-2">
              {CURATED_REPRESENTATION_TYPES.map(t=>(
                <Chip key={t} active={representationType===t} onClick={()=>setRepresentationType(t)}>{t}</Chip>
              ))}
            </div>
            <TextInput placeholder="Or describe the relationship…" value={representationType} onChange={e=>setRepresentationType(e.target.value)}/>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isMotherAgency} onChange={e=>setIsMotherAgency(e.target.checked)}/>
            Mother / worldwide representation
          </label>
          <div>
            <FieldLabel>Territories</FieldLabel>
            <div className="flex flex-wrap gap-2 mb-2">
              {CURATED_TERRITORIES.map(t=>(
                <Chip key={t} active={territories.includes(t)} onClick={()=>toggleTerritory(t)}>{t}</Chip>
              ))}
              {territories.filter(t=>!CURATED_TERRITORIES.includes(t)).map(t=>(
                <Chip key={t} active onClick={()=>toggleTerritory(t)}>{t}</Chip>
              ))}
            </div>
            <div className="flex gap-2">
              <TextInput placeholder="Add a custom territory…" value={territoryInput} onChange={e=>setTerritoryInput(e.target.value)}/>
              <Btn variant="outline" size="sm" onClick={addCustomTerritory}>Add</Btn>
            </div>
          </div>
          <FSelect label="Exclusivity" options={EXCLUSIVITY_OPTIONS.map(o=>o.label)}
            value={EXCLUSIVITY_OPTIONS.find(o=>o.value===exclusivity)?.label}
            onChange={label=>setExclusivity(EXCLUSIVITY_OPTIONS.find(o=>o.label===label)?.value ?? "not_specified")}/>
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Effective From" placeholder="YYYY-MM-DD" type="date" value={effectiveStartDate} onChange={e=>setEffectiveStartDate(e.target.value)}/>
            <TextInput label="Effective Until" placeholder="YYYY-MM-DD" type="date" value={effectiveEndDate} onChange={e=>setEffectiveEndDate(e.target.value)}/>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="p-5 space-y-3">
          <FSelect label="Document Type" options={RESTRICTED_DOC_CATEGORIES.map(c=>c.label)}
            value={RESTRICTED_DOC_CATEGORIES.find(c=>c.value===docCategory)?.label}
            onChange={label=>setDocCategory(RESTRICTED_DOC_CATEGORIES.find(c=>c.label===label)?.value ?? "representation_agreement")}/>
          <div>
            <FieldLabel>Supporting Representation Agreement</FieldLabel>
            <input type="file" onChange={e=>setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs border border-border rounded-md px-3 py-2 bg-input-background"/>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">Stored as a restricted document — visible only to your agency, never to the brand or other agencies.</div>
          </div>
          {file && (
            <div className="space-y-1.5 border border-border rounded-md p-3 bg-secondary/50">
              <FieldLabel>Confirm before uploading</FieldLabel>
              {[
                ["authority", "We have authority to represent this model in the territories specified.", attestAuthority, setAttestAuthority],
                ["upload", "We are authorized to upload and display this model's submitted materials.", attestUploadRights, setAttestUploadRights],
                ["accurate", "The representation information entered is accurate to the best of our knowledge.", attestAccurate, setAttestAccurate],
                ["update", "We will update DVURE if this representation relationship changes or terminates.", attestWillUpdate, setAttestWillUpdate],
              ].map(([key, label, checked, setter]: any) => (
                <label key={key} className="flex items-start gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={e=>setter(e.target.checked)} className="mt-0.5"/>
                  <span>{label}</span>
                </label>
              ))}
            </div>
          )}
          {error && <div className="text-xs text-urgent bg-urgent/5 border border-urgent rounded-md px-3 py-2">{error}</div>}
        </div>
      )}

      <div className="px-5 pb-5 flex gap-2">
        {step > 1 && <Btn variant="outline" onClick={()=>setStep((step-1) as AddModelStep)}>Back</Btn>}
        {step < 3 ? (
          <Btn variant="primary" disabled={step===1 ? !step1Valid : !step2Valid} onClick={()=>setStep((step+1) as AddModelStep)}>Continue</Btn>
        ) : (
          <Btn variant="primary" disabled={!step3Valid || saving} onClick={handleFinalSubmit}>{saving ? "Adding…" : "Add Model"}</Btn>
        )}
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}

function RosterView({ roster, onModelAdded }: { roster: RosterModel[]; onModelAdded: (m: RosterModel) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [invitingModel, setInvitingModel] = useState<RosterModel | null>(null);
  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Your full talent roster — it's the agency's responsibility to add models here.</p>
        <Btn variant="primary" size="sm" icon={<UserPlus size={12}/>} onClick={()=>setShowAdd(true)}>Add Model</Btn>
      </div>
      <div className="space-y-2">
        {roster.map(m=>(
          <div key={m.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
            <XBox className="w-12 h-12 rounded-md shrink-0"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold flex items-center gap-1.5">{m.name} <CountryFlag location={m.location} className="text-xs"/></div>
              <div className="text-xs text-muted-foreground">{m.location} · {m.email}</div>
              {(m.relationshipType || (m.territories && m.territories.length > 0)) && (
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {m.relationshipType}{m.relationshipType && m.territories?.length ? " · " : ""}{m.territories?.join(", ")}
                </div>
              )}
            </div>
            <div className="text-xs font-mono">{m.rate}</div>
            {m.hasLogin ? (
              <Badge label="Has login" variant="active"/>
            ) : (
              <Btn variant="outline" size="sm" onClick={()=>setInvitingModel(m)}>Invite to <DvureSignature size={11}/></Btn>
            )}
          </div>
        ))}
        {roster.length===0 && (
          <div className="border border-dashed border-border rounded-md p-10 text-center text-sm text-muted-foreground">No models yet — add your first one.</div>
        )}
      </div>
      {showAdd && <AddModelModal onClose={()=>setShowAdd(false)} onAdded={onModelAdded}/>}
      {invitingModel && <InviteModelModal model={invitingModel} onClose={()=>setInvitingModel(null)}/>}
    </div>
  );
}

function InviteModelModal({ model, onClose }: { model: RosterModel; onClose: () => void }) {
  const { org, profile } = useAuth();
  const [email, setEmail] = useState(model.email);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSend() {
    if (!org || !profile || !email.trim()) return;
    setSending(true);
    setError(null);
    const { token, error: err } = await createModelInvite(org.id, profile.id, model.id, email.trim());
    setSending(false);
    if (err || !token) { setError(err ?? "Couldn't create invite."); return; }
    setLink(`${window.location.origin}/accept-invite/${token}`);
  }

  function handleCopy() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal onClose={onClose}>
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="text-heading text-sm">Invite {model.name} to <DvureSignature size={13}/></div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
      </div>
      {!link ? (
        <>
          <div className="p-5 space-y-3">
            <TextInput label="Email" placeholder="model@example.com" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>
            <div className="bg-secondary border border-border rounded-md px-3 py-2 text-xs text-muted-foreground">
              This creates a private sign-up link for {model.name} to set their own password and see their own bookings and payment status. There's no automated email yet — share the link with them directly.
            </div>
            {error && <div className="text-xs text-red-500">{error}</div>}
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <Btn variant="primary" disabled={!email.trim() || sending} onClick={handleSend}>{sending ? "Creating…" : "Create Invite Link"}</Btn>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          </div>
        </>
      ) : (
        <div className="p-5 space-y-3">
          <div className="text-xs text-muted-foreground">Share this link with {model.name} — it lets them set their own password and activate their account.</div>
          <div className="flex items-center gap-2 border border-border rounded-md bg-input-background px-3 py-2">
            <div className="flex-1 text-xs font-mono truncate">{link}</div>
            <button onClick={handleCopy} className="text-xs font-medium text-foreground hover:underline cursor-pointer shrink-0">{copied ? "Copied" : "Copy"}</button>
          </div>
          <Btn variant="outline" fullWidth onClick={onClose}>Done</Btn>
        </div>
      )}
    </Modal>
  );
}

// The same private, per-campaign, per-agency thread the brand sees on
// their side (Collaboration tab) — an agency only ever sees its OWN
// thread with a brand, never another agency's. There is no way to
// message a model directly from here; models only get read-only access
// to this same thread elsewhere.
function AgencyMessagingView() {
  const currentUser = useCurrentUser();
  const meName = currentUser?.name ?? "";
  const agencyName = currentUser?.org ?? "";

  const campaignsWithThreads = INVITATIONS
    .map(inv => ({ inv, campaign: CAMPAIGNS.find(c=>c.name===inv.campaign) }))
    .filter(x => x.campaign);

  const [selected, setSelected] = useState(campaignsWithThreads[0]?.campaign?.id ?? null);
  const [threads, setThreads] = useState<Record<number, CampaignThreadMessage[]>>(() => {
    const init: Record<number, CampaignThreadMessage[]> = {};
    for (const { campaign } of campaignsWithThreads) {
      if (campaign) init[campaign.id] = CAMPAIGN_AGENCY_THREADS[campaign.id]?.[agencyName] ?? [];
    }
    return init;
  });
  const [input, setInput] = useState("");

  const selectedCampaign = campaignsWithThreads.find(x=>x.campaign?.id===selected)?.campaign;
  const msgs = selected!=null ? (threads[selected] ?? []) : [];

  function send() {
    if (!input.trim() || selected==null) return;
    setThreads(p=>({ ...p, [selected]: [...(p[selected]??[]), { id:Date.now(), from:meName, fromOrg:agencyName, text:input, ts:"Now" }] }));
    setInput("");
  }

  if (campaignsWithThreads.length===0) {
    return <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-md text-sm text-muted-foreground">No campaign threads yet.</div>;
  }

  return (
    <div className="flex-1 flex min-h-0 -m-6">
      <div className="w-56 shrink-0 border-r border-border overflow-y-auto">
        <div className="px-4 py-2 text-[9px] font-mono text-muted-foreground uppercase tracking-wider border-b border-border">Your Campaign Threads</div>
        {campaignsWithThreads.map(({ inv, campaign }) => (
          <button key={campaign!.id} onClick={()=>setSelected(campaign!.id)}
            className={cx("w-full text-left px-4 py-3 text-xs border-b border-border transition-colors",
              selected===campaign!.id ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}>
            <div className="truncate">{inv.campaign}</div>
            <div className="text-[10px] text-muted-foreground truncate">{inv.brand}</div>
          </button>
        ))}
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-2.5 border-b border-border">
          <div className="text-xs font-semibold">{selectedCampaign?.name} — {agencyName}</div>
          <div className="text-[10px] text-muted-foreground">Private to {agencyName} + the brand — no other agency can see this</div>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {msgs.length===0 && <div className="text-xs text-muted-foreground italic">No messages yet.</div>}
          {msgs.map(m=>{
            const isMe = m.from===meName;
            return (
              <div key={m.id} className={cx("flex flex-col gap-1", isMe && "items-end")}>
                {m.broadcast && <div className="text-[9px] font-mono uppercase tracking-wide text-urgent mb-0.5">Update from brand</div>}
                <div className={cx("rounded-xl px-4 py-2.5 text-sm max-w-md leading-relaxed",
                  m.broadcast ? "bg-urgent/10 border border-urgent text-foreground" : isMe ? "bg-foreground text-primary-foreground" : "bg-secondary text-foreground"
                )}>{m.text}</div>
                <div className={cx("flex items-center gap-2 text-[10px] text-muted-foreground", isMe && "flex-row-reverse")}>
                  <span className="font-medium">{isMe ? "Me" : m.from}</span>
                  {!isMe && <span>· {m.fromOrg}</span>}
                  <span className="font-mono">{m.ts}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-6 py-4 border-t glass shrink-0">
          <div className="flex gap-3 items-end">
            <textarea value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); }}}
              placeholder="Message the brand…" rows={2}
              className="flex-1 bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none placeholder:text-muted-foreground"/>
            <button onClick={send} className="p-2.5 bg-foreground hover:bg-foreground/90 text-primary-foreground rounded-md transition-colors cursor-pointer shrink-0">
              <Send size={15}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const TRANSFER_STATUS_BADGE: Record<TransferStatus, { label: string; variant: "default"|"active"|"pending"|"draft"|"warning" }> = {
  pending: { label: "Awaiting payment", variant: "draft" },
  awaiting_payee_onboarding: { label: "Awaiting your Connect onboarding", variant: "pending" },
  transferred: { label: "Paid out", variant: "active" },
  failed: { label: "Failed — needs attention", variant: "warning" },
};

const INVOICE_STATUS_BADGE: Record<InvoiceStatus, { label: string; variant: "default"|"active"|"pending"|"draft" }> = {
  outstanding: { label: "Outstanding", variant: "draft" },
  partially_paid: { label: "Partially paid", variant: "pending" },
  paid: { label: "Paid", variant: "active" },
};

function PaymentsView() {
  const { org } = useAuth();
  const [tab, setTab] = useState<"payouts"|"invoices">("payouts");
  const [payouts, setPayouts] = useState<AgencyPayout[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org) return;
    setLoading(true);
    Promise.all([fetchAgencyPayouts(org.id), fetchInvoicesForAgency(org.id)]).then(([p, i]) => {
      setPayouts(p);
      setInvoices(i);
      setLoading(false);
    });
  }, [org?.id]);

  const now = new Date();
  const pendingTotal = payouts.filter(p=>p.transferStatus==="pending"||p.transferStatus==="awaiting_payee_onboarding").reduce((s,p)=>s+p.payoutAmount,0);
  const failedCount = payouts.filter(p=>p.transferStatus==="failed").length;
  const paidThisMonth = payouts.filter(p=>p.transferStatus==="transferred" && p.transferredAt && new Date(p.transferredAt).getMonth()===now.getMonth() && new Date(p.transferredAt).getFullYear()===now.getFullYear()).reduce((s,p)=>s+p.payoutAmount,0);

  return (
    <div className="max-w-2xl space-y-4">
      {org && <PaymentConfirmQueue fetchPending={()=>fetchPendingConfirmationsForAgency(org.id)}/>}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Pending payout" value={`$${pendingTotal.toLocaleString()}`}/>
        <Stat label="Needs attention" value={failedCount}/>
        <Stat label="Paid this month" value={`$${paidThisMonth.toLocaleString()}`}/>
      </div>
      <div className="flex items-center gap-1 border-b border-border">
        {(["payouts","invoices"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={cx("px-4 py-2.5 text-sm capitalize border-b-2 -mb-px transition-colors",
              tab===t?"border-foreground text-foreground font-medium":"border-transparent text-muted-foreground hover:text-foreground"
            )}>{t==="payouts"?"Payouts":"Invoices"}</button>
        ))}
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : tab==="payouts" ? (
        <div className="space-y-2">
          {payouts.length===0 && <div className="text-sm text-muted-foreground">No payouts yet.</div>}
          {payouts.map(p=>(
            <div key={p.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{p.campaignName}</div>
                <div className="text-xs text-muted-foreground">{p.brandName}</div>
              </div>
              <div className="font-mono text-sm font-semibold shrink-0">${p.payoutAmount.toLocaleString()}</div>
              <Badge {...TRANSFER_STATUS_BADGE[p.transferStatus]}/>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.length===0 && <div className="text-sm text-muted-foreground">No invoices yet.</div>}
          {invoices.map(inv=>(
            <div key={inv.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{inv.campaignName}</div>
                <div className="text-xs text-muted-foreground">${inv.acceptedAmount.toLocaleString()} of ${inv.totalAmount.toLocaleString()} confirmed</div>
              </div>
              <Badge {...INVOICE_STATUS_BADGE[inv.status]}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgencyApp({ onLogout }: { onLogout: () => void }) {
  const { profile, org, refreshIdentity } = useAuth();
  const agencyName = org?.name ?? "";
  const canEditLogo = org?.accessLevel === "administrator";
  async function handleLogoChange(dataUri: string) {
    if (!org) return;
    await updateOrgLogo(org.id, dataUri);
    await refreshIdentity();
  }
  const [view, setView] = useState<View>("invitations");
  const [roster, setRoster] = useState<RosterModel[]>([]);
  const [realInvitations, setRealInvitations] = useState<AgencyInvitation[]>([]);
  const [submitCampaign, setSubmitCampaign] = useState<string | undefined>(undefined);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const invitations: Invitation[] = [...INVITATIONS, ...realInvitations];

  function selectView(v: View) {
    setView(v);
    setMobileNavOpen(false);
  }

  useEffect(() => {
    let active = true;
    if (org) fetchAgencyRoster(org.id, org.name).then(r => { if (active) setRoster(r); });
    if (org) fetchAgencyInvitations(org.id).then(inv => { if (active) setRealInvitations(inv); });
    return () => { active = false; };
  }, [org?.id, org?.name]);

  // AddModelModal now does its own RPC calls (representation relationship
  // + optional document) and only calls this once they've actually
  // succeeded, so there's nothing left to do here but reflect the new
  // model into local state.
  function addModel(m: RosterModel) {
    setRoster(prev => [...prev, m]);
  }

  return (
    <CurrentUserProvider user={{ name:profile?.fullName ?? "", title:org?.title ?? "", org:agencyName, email:profile?.email ?? "", phone:profile?.phone ?? "", access:org?.accessLevel ?? "basic", onSettings:()=>setView("settings") }}>
      <div className="h-screen flex bg-background overflow-hidden">
        <MobileNavDrawer open={mobileNavOpen} onClose={()=>setMobileNavOpen(false)}>
          <aside className="w-full h-full glass border-r flex flex-col">
            <div className="px-4 py-2.5 min-h-14 flex items-start border-b border-border gap-2.5" style={{ paddingTop: "calc(0.625rem + env(safe-area-inset-top))" }}>
              <div className="shrink-0 mt-0.5"><OrgLogoBox org={org} canEdit={canEditLogo} onLogoChange={handleLogoChange} size={32}/></div>
              <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 self-center">
                <span className="text-sm font-medium break-words inline-flex items-center gap-1.5">{agencyName} <CountryFlag country={ORG_COUNTRY[agencyName]} className="text-xs"/></span>
                <span className="text-heading text-xs shrink-0 text-muted-foreground">Agency</span>
              </div>
            </div>
            <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
              {NAV.map(item=>{
                const NavIcon = item.Icon;
                const count = item.id==="invitations" ? invitations.length : item.count;
                return (
                  <button key={item.id} onClick={()=>selectView(item.id)}
                    className={cx("w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors text-left",
                      view===item.id?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}>
                    <NavIcon size={15}/>{item.label}
                    {!!count && <span className="ml-auto text-[10px] font-mono bg-foreground text-primary-foreground px-1.5 py-0.5 rounded-full">{count}</span>}
                  </button>
                );
              })}
            </nav>
            <div className="px-3 py-3 border-t border-border">
              <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-secondary">
                <LogOut size={13}/> Sign out
              </button>
              <div className="flex items-center justify-center gap-1.5 pt-3 opacity-40">
                <DvureMark size={12}/><DvureSignature size={10}/>
              </div>
            </div>
          </aside>
        </MobileNavDrawer>
        {view === "settings" ? (
          <AgencySettingsScreen onLogout={onLogout} onMenuClick={()=>setMobileNavOpen(true)}/>
        ) : view === "network" ? (
          <NetworkView onMenuClick={()=>setMobileNavOpen(true)}/>
        ) : (
          <main className="flex-1 flex flex-col min-h-0 min-w-0">
            <TopBar title={NAV.find(n=>n.id===view)?.label ?? ""} sub={`${agencyName} · Agency`} onMenuClick={()=>setMobileNavOpen(true)}/>
            <div className="flex-1 overflow-auto p-4 md:p-6">
              {view === "invitations" && <InvitationsView invitations={invitations} onSubmitTalent={(campaign)=>{ setSubmitCampaign(campaign); setView("submit"); }}/>}
              {view === "submit" && <SubmitTalentView roster={roster} invitations={invitations} onGoToRoster={()=>setView("roster")} initialCampaign={submitCampaign}/>}
              {view === "roster" && <RosterView roster={roster} onModelAdded={addModel}/>}
              {view === "payments" && <PaymentsView/>}
              {view === "messaging" && <AgencyMessagingView/>}
            </div>
          </main>
        )}
      </div>
    </CurrentUserProvider>
  );
}
