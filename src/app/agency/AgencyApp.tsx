import { useState, useMemo, useEffect } from "react";
import { LogOut, Plus, Send, MessageSquare, Inbox, Users2, CreditCard, X, UserPlus, Search, ChevronRight, ChevronLeft, Building2, Globe } from "lucide-react";
import { cx, XBox, Badge, Btn, Stat, TopBar, TextInput, FSelect, Textarea, FieldLabel, Chip, Modal, CurrentUserProvider, useCurrentUser, CountryFlag, DvureSignature, DvureMark } from "../shared/ui";
import { BOOKINGS, bookingBreakdown, MOCK_NOW, CAMPAIGNS, CAMPAIGN_AGENCY_THREADS, ORG_COUNTRY } from "../shared/mockData";
import type { RosterModel, CampaignThreadMessage, RepresentationExclusivity, Talent, SubmissionStage } from "../shared/types";
import { useAuth } from "../shared/auth";
import {
  fetchAgencyRoster, checkPossibleModelDuplicate, addNewModelToRoster, linkModelToExistingRoster,
  type RelationshipTerms,
} from "../../lib/queries/roster";
import { fetchAgencyCampaigns, type AgencyCampaignSummary } from "../../lib/queries/campaigns";
import { CompCard } from "../shared/CompCard";
import SubscriptionCheckout from "../shared/SubscriptionCheckout";
import NetworkView from "../shared/NetworkView";
import SupportTicketForm from "../shared/SupportTicketForm";
import { insertSubmission, fetchCampaignSubmissions } from "../../lib/queries/submissions";
import { createModelInvite } from "../../lib/queries/invites";
import { createModelDocument, uploadModelDocumentFile, type DocumentCategory } from "../../lib/queries/documents";
import { updateSelfDescribedServices } from "../../lib/queries/organizations";
import EventCalendar, { type CalendarEvent } from "../shared/EventCalendar";

type View = "projects" | "roster" | "payments" | "network" | "messaging" | "profile";

const NAV: { id: View; label: string; Icon: typeof Inbox; count?: number }[] = [
  { id:"projects",     label:"Projects",             Icon:Inbox                 },
  { id:"roster",       label:"Talent Roster",        Icon:Users2                },
  { id:"payments",     label:"Payments",             Icon:CreditCard            },
  { id:"network",      label:"Network",              Icon:Globe                 },
  { id:"profile",      label:"Agency Profile",       Icon:Building2             },
  { id:"messaging",    label:"Messaging",            Icon:MessageSquare, count:1 },
];

const INVITATIONS = [
  { brand:"Vellani",       campaign:"AW25 Womenswear Campaign", type:"Campaign", due:"06/20/2025", budget:"$800–$1,200/day", models:3, submissionOpen:"May 1, 2026", submissionClose:"Aug 15, 2026", archived:false },
  { brand:"Kinera",        campaign:"Run Global SS25",          type:"Campaign", due:"07/01/2025", budget:"$600–$900/day",   models:5, submissionOpen:"Jul 1, 2026", submissionClose:"Aug 5, 2026",  archived:false },
  { brand:"Ossara",        campaign:"Beauty Editorial AW25",    type:"Campaign", due:"06/28/2025", budget:"$1,200–$2,000/day", models:2, submissionOpen:"Jul 10, 2026", submissionClose:"Jul 24, 2026", archived:false },
];

function submissionIsClosed(c: { submissionCloseISO: string }) {
  return MOCK_NOW > new Date(c.submissionCloseISO);
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

// "Campaign invitations" was a misnomer — these are projects, same as a
// brand's own Projects list, so this mirrors BrandApp's CampaignsList
// structure exactly: the same Active/Expired/Archived/Calendar tab bar
// (Expired stands in for the brand-only "Drafts" tab, since an agency
// never has draft projects but does have ones whose submission window
// has closed). Only real difference: a brand runs a handful of projects
// at once, an agency can be fielding hundreds, so cards are smaller and
// denser (five to a row, more square than polaroid) and there's a
// search bar instead of relying on scroll alone. Within Active, projects
// this agency hasn't submitted anything to yet are pinned above ones
// it's already acted on, so the ones needing attention surface first.
function ProjectsView({ campaigns, onOpenProject, submitted }: {
  campaigns: AgencyCampaignSummary[]; onOpenProject: (campaign: string) => void; submitted: CampaignSubmissionStatus[];
}) {
  const [tab, setTab] = useState<"active" | "expired" | "archived" | "calendar">("active");
  const [search, setSearch] = useState("");

  const hasSubmitted = (campaign: string) => submitted.some(s => s.campaign === campaign);

  const byTab = campaigns.filter(c => {
    if (tab === "archived") return c.archived;
    if (c.archived) return false;
    const closed = submissionIsClosed(c);
    return tab === "expired" ? closed : !closed;
  });
  const filtered = byTab.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.brand.toLowerCase().includes(search.toLowerCase())
  );
  const awaitingSubmission = tab === "active" ? filtered.filter(c => !hasSubmitted(c.name)) : [];
  const alreadySubmitted = tab === "active" ? filtered.filter(c => hasSubmitted(c.name)) : filtered;

  // The whole card is a square, not just the cover — identifying info
  // (name/brand/status) overlays the image via a bottom scrim, always
  // visible so browsing hundreds of these still reads at a glance;
  // actions (Submit Talent/Brief/Decline) only appear on hover, same
  // reveal pattern the brand-side Moodboard cards already use.
  function Card({ c }: { c: AgencyCampaignSummary }) {
    const closed = submissionIsClosed(c);
    return (
      <div className="relative aspect-square rounded-md border overflow-hidden cursor-pointer group hover:border-foreground/40 hover:shadow-md transition-all"
        onClick={()=>onOpenProject(c.name)}>
        <BrandLogoBadge brand={c.brand}/>
        <div className="absolute top-1.5 left-1.5">
          <Badge label={`${c.talentNeeded} needed`} variant="info"/>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2.5 pt-8 pb-2">
          <div className="text-xs font-semibold leading-snug text-white truncate">{c.name}</div>
          <div className="text-[10px] text-white/70 truncate">{c.brand}</div>
          <div className="text-[9px] font-mono mt-1 flex items-center gap-1">
            {closed
              ? <span className="text-urgent font-semibold">Closed</span>
              : <span className="text-offwhite-foreground bg-offwhite px-1 rounded-sm font-semibold">Open</span>}
            <span className="text-white/60 truncate">Due {c.due}</span>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3"
          onClick={e=>e.stopPropagation()}>
          <Btn variant="primary" size="sm" fullWidth disabled={closed} onClick={()=>onOpenProject(c.name)}>
            {closed ? "Closed" : "Submit Talent"}
          </Btn>
          <div className="flex items-center justify-center gap-3">
            <button onClick={e=>e.stopPropagation()} className="text-[10px] font-mono text-white/80 hover:text-white underline underline-offset-2 cursor-pointer">Brief</button>
            <button onClick={e=>e.stopPropagation()} className="text-[10px] font-mono text-white/80 hover:text-white underline underline-offset-2 cursor-pointer">Decline</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-1 border-b border-border -mt-1">
        <div className="flex items-center gap-1">
          {(["active","expired","archived","calendar"] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={cx("px-4 py-2.5 text-sm capitalize border-b-2 -mb-px transition-colors cursor-pointer",
                tab===t?"border-foreground text-foreground font-medium":"border-transparent text-muted-foreground hover:text-foreground"
              )}>{t}</button>
          ))}
        </div>
        {tab !== "calendar" && (
          <div className="flex items-center border border-border rounded-md bg-input-background overflow-hidden w-56 shrink-0 mb-2">
            <Search size={13} className="text-muted-foreground ml-2.5 shrink-0"/>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search projects or brands…"
              className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-transparent focus:outline-none placeholder:text-muted-foreground"/>
          </div>
        )}
      </div>

      {tab === "calendar" ? (
        <AgencyCalendarView campaigns={campaigns} onOpenProject={onOpenProject}/>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-10 text-center text-sm text-muted-foreground">
          {search ? `No ${tab} projects match "${search}"` : `No ${tab} projects`}
        </div>
      ) : (
        <div className="space-y-5">
          {awaitingSubmission.length > 0 && (
            <div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Awaiting submission</div>
              <div className="grid grid-cols-5 gap-3">
                {awaitingSubmission.map(c => <Card key={c.id} c={c}/>)}
              </div>
            </div>
          )}
          {alreadySubmitted.length > 0 && (
            <div>
              {tab === "active" && awaitingSubmission.length > 0 && (
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Already submitted</div>
              )}
              <div className="grid grid-cols-5 gap-3">
                {alreadySubmitted.map(c => <Card key={c.id} c={c}/>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Every project's due date and submission open/close window, in one
// month grid — the agency-side equivalent of the brand's CampaignCalendar
// (src/app/brand/CampaignCalendar.tsx), same event derivation,
// generalized onto EventCalendar since an agency needs its whole set of
// projects plotted at once, not just one campaign.
function AgencyCalendarView({ campaigns, onOpenProject }: { campaigns: AgencyCampaignSummary[]; onOpenProject: (campaign: string) => void }) {
  const events = useMemo(() => {
    const evs: CalendarEvent[] = [];
    for (const c of campaigns) {
      const due = new Date(c.dueDateISO);
      if (!isNaN(due.getTime())) evs.push({ id: `${c.name}-due`, date: due, title: `${c.name} — Due`, dotClassName: "bg-foreground" });
      const open = new Date(c.submissionOpenISO);
      if (!isNaN(open.getTime())) evs.push({ id: `${c.name}-open`, date: open, title: `${c.name} — Submissions open`, dotClassName: "bg-muted-foreground/50" });
      const close = new Date(c.submissionCloseISO);
      if (!isNaN(close.getTime())) evs.push({ id: `${c.name}-close`, date: close, title: `${c.name} — Submissions close`, dotClassName: "bg-muted-foreground" });
    }
    return evs;
  }, [campaigns]);

  return (
    <EventCalendar
      events={events}
      onEventClick={(id) => onOpenProject(String(id).replace(/-(due|open|close)$/, ""))}
      legend={[
        { label: "Due", dotClassName: "bg-foreground" },
        { label: "Submissions close", dotClassName: "bg-muted-foreground" },
        { label: "Submissions open", dotClassName: "bg-muted-foreground/50" },
      ]}
    />
  );
}

const AGENCY_STAGE_COLUMNS: { id: SubmissionStage; label: string }[] = [
  { id: "submitted", label: "Submitted" },
  { id: "approved",  label: "Approved"  },
  { id: "booked",    label: "Booked"    },
  { id: "rejected",  label: "Rejected"  },
];

// The agency's own in-project workspace — click into a project from the
// list (or click "Submit Talent" on a card, which now lands here instead
// of a separate flow) and see its dates plus which of THIS agency's
// models were submitted/approved/booked/rejected for it, with Submit
// Talent itself living here now — picking a model already happens in
// the context of the one project you're looking at, so there's no
// reason to make you pick the campaign a second time in a separate
// screen. Real data throughout: the campaign object (including its real
// id) comes straight from fetchAgencyCampaigns via the `campaigns` prop
// — no more separate name→id lookup, and no more falling back to mock
// header data when a mock/real name happened to collide. Stage columns
// themselves stay read-only (moving a model between stages is the
// brand's call), only the Submit action writes anything from here.
function AgencyCampaignDetail({ campaign, campaigns, onBack, roster, onGoToRoster, submitted, setSubmitted }: {
  campaign: string; campaigns: AgencyCampaignSummary[]; onBack: () => void; roster: RosterModel[]; onGoToRoster: () => void;
  submitted: CampaignSubmissionStatus[]; setSubmitted: (fn: (prev: CampaignSubmissionStatus[]) => CampaignSubmissionStatus[]) => void;
}) {
  const c = campaigns.find(x => x.name === campaign);
  const realCampaignId = c?.id ?? null;
  const [talent, setTalent] = useState<Talent[] | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickedModelId, setPickedModelId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function loadSubmissions(id: string) {
    const { talent: t } = await fetchCampaignSubmissions(id);
    setTalent(t);
  }

  useEffect(() => {
    let active = true;
    setTalent(null);
    if (!realCampaignId) { setTalent([]); return; }
    loadSubmissions(realCampaignId).then(() => { if (!active) return; });
    return () => { active = false; };
  }, [realCampaignId]);

  function statusFor(modelId: string) {
    return submitted.find(s => s.modelId === modelId && s.campaign === campaign);
  }

  const pickedModel = roster.find(m => m.id === pickedModelId);
  const submissionClosed = c ? submissionIsClosed(c) : false;
  const pickedStatus = pickedModel ? statusFor(pickedModel.id) : undefined;

  function selectModel(id: string) {
    setPickedModelId(id);
    setSubmitError(null);
    setShowPicker(false);
  }

  async function handleSubmit() {
    if (!pickedModel) return;
    setSubmitting(true);
    setSubmitError(null);
    if (!realCampaignId) {
      setSubmitting(false);
      setSubmitError("This campaign isn't connected yet — check back once it's set up.");
      return;
    }
    const { duplicateSubmission, overlapWarning, error } = await insertSubmission({
      campaignId: realCampaignId,
      modelId: pickedModel.id,
    });
    if (error) {
      setSubmitting(false);
      setSubmitError(error);
      return;
    }
    setSubmitted(p => [...p, { modelId: pickedModel.id, campaign, status: "pending", duplicate: duplicateSubmission, overlapWarning }]);
    await loadSubmissions(realCampaignId);
    setSubmitting(false);
    setPickedModelId("");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <button onClick={onBack} className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer mb-1">
            <ChevronLeft size={11}/> Back to Projects
          </button>
          <div className="text-heading text-base">{campaign}</div>
          <div className="text-xs text-muted-foreground">{c?.brand ?? ""}</div>
        </div>
        <Btn variant="primary" size="sm" icon={<Plus size={12}/>} disabled={submissionClosed || roster.length===0} onClick={()=>setShowPicker(true)}>
          {submissionClosed ? "Submissions Closed" : "Submit Talent"}
        </Btn>
      </div>
      {roster.length === 0 && (
        <div className="text-xs text-muted-foreground">Your roster is empty — <button onClick={onGoToRoster} className="underline underline-offset-2 hover:text-foreground cursor-pointer">add a model</button> before you can submit talent.</div>
      )}

      {c && (
        <div className="glass-subtle border rounded-md p-4 grid grid-cols-4 gap-4">
          {([["Due", c.due], ["Submissions Open", c.submissionOpen || "Not set"], ["Submissions Close", c.submissionClose || "Not set"], ["Budget", c.budget]] as [string,string][]).map(([k,v]) => (
            <div key={k}>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">{k}</div>
              <div className="text-sm font-medium mt-0.5">{v}</div>
            </div>
          ))}
        </div>
      )}

      {talent === null ? (
        <div className="text-sm text-muted-foreground">Loading submissions…</div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {AGENCY_STAGE_COLUMNS.map(col => {
            const models = talent.filter(t => t.stage === col.id);
            return (
              <div key={col.id}>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">{col.label} ({models.length})</div>
                {/* The exact same CompCard the brand's Submissions board uses —
                    same shared component, so the two are identical by
                    construction. Read-only here (no selection/hover actions):
                    the agency tracks status, the brand acts on it. The flip
                    control still works — that's per-card, not a Brand-only
                    behavior. */}
                <div className="grid grid-cols-2 gap-2">
                  {models.map(m => <CompCard key={m.id} talent={m}/>)}
                  {models.length === 0 && <div className="col-span-2 text-xs text-muted-foreground italic">None yet</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPicker && (
        <RosterPickerModal roster={roster} campaign={campaign} statusFor={(modelId)=>statusFor(modelId)} onPick={selectModel} onClose={()=>setShowPicker(false)}/>
      )}

      {pickedModel && (
        <Modal onClose={()=>setPickedModelId("")}>
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="text-heading text-sm">Submit Talent</div>
            <button onClick={()=>setPickedModelId("")} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <FieldLabel>Model</FieldLabel>
              <button onClick={()=>{ setPickedModelId(""); setShowPicker(true); }}
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
            {c && (
              <div className={cx("text-[10px] font-mono flex items-center gap-1.5", submissionClosed ? "text-urgent" : "text-muted-foreground")}>
                <span>Submissions {c.submissionOpen || "Not set"} – {c.submissionClose || "Not set"}</span>
                {submissionClosed
                  ? <span className="font-semibold">Closed</span>
                  : <span className="text-offwhite-foreground bg-offwhite px-1 rounded-sm font-semibold">Open</span>}
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
            <Textarea label="Note to brand" placeholder="Optional — why this model fits the brief…" rows={3}/>
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <Btn variant="primary" disabled={submissionClosed || !!pickedStatus || submitting} onClick={handleSubmit}>
              {submitting ? "Submitting…" : "Submit"}
            </Btn>
            <Btn variant="outline" onClick={()=>setPickedModelId("")}>Cancel</Btn>
          </div>
        </Modal>
      )}
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

// A model this AGENCY already submitted (pending or declined) for a
// given campaign can't be resubmitted by clicking through the picker
// again — modelId/campaign pairs are unique to a specific campaign, so
// the same model can still be freely submitted to a *different* open
// campaign.
//
// This is only ever populated from THIS session's own successful
// submits (see handleSubmit below) — it can't pre-block a model another
// agency already submitted, since RLS hides that agency's submission
// row entirely. Two different agencies both submitting the same model
// to the same campaign is now allowed (submit_talent RPC, 0029) — it's
// flagged via duplicate/overlapWarning below, never blocked.
type CampaignSubmissionStatus = { modelId: string; campaign: string; status: "pending" | "declined"; duplicate?: boolean; overlapWarning?: string | null };

// Curated suggestion lists — steer agencies toward consistent strings
// (so territory/type matching across relationships actually lines up)
// without enforcing a closed set; both fields accept free custom entry.
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

// Three steps: (1) identity fields + duplicate-person check against the
// composite signal set (name/DOB/email/phone/identity-verification —
// never name alone, see check_possible_model_duplicate/0027), (2) the
// representation relationship terms (type/territory/exclusivity/dates —
// spec §4-§7), (3) the supporting representation document + the four
// required attestations (spec §8). A high-confidence duplicate match
// blocks progress until the agency explicitly says "same person, link"
// or "different person, continue" — a low-confidence match is only ever
// an advisory, non-blocking notice.
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
  const [commissionPct, setCommissionPct] = useState("20");
  const [feeEntitlement, setFeeEntitlement] = useState<"always" | "when_booking">("when_booking");
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
    const parsedCommission = parseFloat(commissionPct);
    const terms: RelationshipTerms = {
      representationType, isMotherAgency, territories, exclusivity,
      effectiveStartDate, effectiveEndDate: effectiveEndDate || undefined,
      commissionPct: Number.isFinite(parsedCommission) ? parsedCommission / 100 : null,
      feeEntitlement,
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

    setSaving(false);
    setResult({
      model: {
        id: modelId!, name, email, agency: org.name, location: location || "—", rate: rate || "—",
        height: "—", exp: "—", hasLogin: false,
        relationshipId: relationshipId!, relationshipType: representationType, isMotherAgency,
        territories, exclusivity, effectiveStartDate, effectiveEndDate: effectiveEndDate || null,
      },
      overlapWarning,
    });
    onAdded({
      id: modelId!, name, email, agency: org.name, location: location || "—", rate: rate || "—",
      height: "—", exp: "—", hasLogin: false,
      relationshipId: relationshipId!, relationshipType: representationType, isMotherAgency,
      territories, exclusivity, effectiveStartDate, effectiveEndDate: effectiveEndDate || null,
    });
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
          <div className="border border-border rounded-md p-3 space-y-2.5">
            <div>
              <FieldLabel>Your Commission</FieldLabel>
              <div className="flex items-center gap-2">
                <TextInput type="number" placeholder="20" value={commissionPct} onChange={e=>setCommissionPct(e.target.value)}/>
                <span className="text-sm text-muted-foreground shrink-0">% of gross</span>
              </div>
            </div>
            <div>
              <FieldLabel>Paid When?</FieldLabel>
              <div className="flex gap-2">
                {([
                  { id: "when_booking" as const, label: "Only when we book" },
                  { id: "always" as const, label: "Every booking, regardless" },
                ]).map(opt => (
                  <button key={opt.id} type="button" onClick={()=>setFeeEntitlement(opt.id)}
                    className={cx("flex-1 text-xs font-medium py-1.5 rounded-md border transition-colors cursor-pointer",
                      feeEntitlement===opt.id ? "bg-foreground text-primary-foreground border-foreground" : "border-border text-muted-foreground hover:border-foreground")}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mt-1">
                "Every booking, regardless" is the mother-agency case — you're entitled to your cut whenever this model books anywhere, even through a different agency.
              </div>
            </div>
          </div>
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

// Photo-forward card grid, matching the brand Moodboard's card language —
// an agency wants to see faces and full profiles at a glance, not a bare
// name list. Alphabetical by name, matching how most agency sites already
// present a roster.
function RosterView({ roster, onModelAdded }: { roster: RosterModel[]; onModelAdded: (m: RosterModel) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [invitingModel, setInvitingModel] = useState<RosterModel | null>(null);
  const sortedRoster = useMemo(() => [...roster].sort((a, b) => a.name.localeCompare(b.name)), [roster]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Your full talent roster — it's the agency's responsibility to add models here.</p>
        <Btn variant="primary" size="sm" icon={<UserPlus size={12}/>} onClick={()=>setShowAdd(true)}>Add Model</Btn>
      </div>
      {sortedRoster.length > 0 ? (
        <div className="grid grid-cols-4 gap-4">
          {sortedRoster.map(m=>(
            <div key={m.id} className="glass-subtle rounded-md border overflow-hidden">
              <XBox className="w-full h-40"/>
              <div className="p-3 space-y-1">
                <div className="text-sm font-semibold truncate flex items-center gap-1">
                  {m.name} <CountryFlag location={m.location} className="text-xs shrink-0"/>
                </div>
                {m.isMotherAgency && <Badge label="Mother" variant="info"/>}
                <div className="text-[10px] text-muted-foreground truncate">{m.location}</div>
                <div className="text-[10px] text-muted-foreground truncate">{m.email || "No email on file"}</div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">
                  {m.relationshipType || "Relationship not set"} · {m.territories.length > 0 ? m.territories.join(", ") : "Territory not set"}
                </div>
                <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-border">
                  <div className="text-xs font-mono font-medium">{m.rate}</div>
                  {m.hasLogin ? (
                    <Badge label="Has login" variant="active"/>
                  ) : (
                    <button onClick={()=>setInvitingModel(m)}
                      className="text-[10px] font-mono text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer">Invite</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-md p-10 text-center text-sm text-muted-foreground">No models yet — add your first one.</div>
      )}
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

function PaymentsView() {
  const currentUser = useCurrentUser();
  const [tab, setTab] = useState<"receivable"|"invoices">("receivable");
  const myBookings = BOOKINGS.filter(b=>b.agency===currentUser?.org);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Pending payout" value={myBookings.filter(b=>b.paymentStatus==="pending").length}/>
        <Stat label="Processing" value={myBookings.filter(b=>b.paymentStatus==="processing").length}/>
        <Stat label="Paid this month" value={myBookings.filter(b=>b.paymentStatus==="paid").length}/>
      </div>
      <div className="flex items-center gap-1 border-b border-border">
        {(["receivable","invoices"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={cx("px-4 py-2.5 text-sm capitalize border-b-2 -mb-px transition-colors",
              tab===t?"border-foreground text-foreground font-medium":"border-transparent text-muted-foreground hover:text-foreground"
            )}>{t==="receivable"?"Commission Payouts":"Invoices Sent"}</button>
        ))}
      </div>
      {tab==="receivable" && (
        <div className="space-y-2">
          {myBookings.map(b=>{
            const bd = bookingBreakdown(b);
            return (
              <div key={b.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{b.model}</div>
                  <div className="text-xs text-muted-foreground">{b.campaign} · {b.brand}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground font-mono">Your commission ({b.agencyPct}%)</div>
                  <div className="font-mono text-sm font-semibold">${bd.agencyFee.toLocaleString()}</div>
                </div>
                <Badge label={b.paymentStatus==="paid"?"Paid":b.paymentStatus==="processing"?"Processing":"Pending"} variant={b.paymentStatus==="paid"?"active":b.paymentStatus==="processing"?"pending":"draft"}/>
              </div>
            );
          })}
        </div>
      )}
      {tab==="invoices" && (
        <div className="space-y-2">
          {myBookings.map(b=>(
            <div key={b.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="text-sm font-semibold">{b.campaign}</div>
                <div className="text-xs text-muted-foreground">{b.model} · Shoot {b.shootDate}</div>
              </div>
              <Btn variant={b.paymentStatus==="pending"?"primary":"outline"} size="sm" disabled={b.paymentStatus!=="pending"}>
                {b.paymentStatus==="pending"?"Send Invoice":"Sent"}
              </Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Purely descriptive (spec §20) — explicitly non-binding on
// representation logic, which lives entirely on each per-model
// relationship (see AddModelModal's Step 2), not on any org-level label.
// Save requires administrator access (organizations_update RLS,
// 0002_rls.sql) — same posture as every other organizations column.
function AgencyProfileView() {
  const { org } = useAuth();
  const [services, setServices] = useState(org?.selfDescribedServices ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = org?.accessLevel === "administrator";

  async function handleSave() {
    if (!org) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: err } = await updateSelfDescribedServices(org.id, services);
    setSaving(false);
    if (err) { setError(err); return; }
    setSaved(true);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-3">General information about your agency — visible to brands you partner with.</p>
        <div className="glass-subtle border rounded-md p-4 space-y-3">
          <TextInput label="Agency Name" placeholder="" value={org?.name ?? ""} readOnly/>
          <div>
            <FieldLabel>Self-Described Services</FieldLabel>
            <Textarea placeholder="e.g. Mother management, market/booking representation, styling…" rows={4}
              value={services} onChange={e=>setServices(e.target.value)}/>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              This describes your agency generally and does not affect which territories or models you're authorized to represent — that's set per relationship when you add a model.
            </div>
          </div>
          {!canEdit && <div className="text-xs text-muted-foreground">Only an administrator on your team can edit this.</div>}
          {error && <div className="text-xs text-urgent bg-urgent/5 border border-urgent rounded-md px-3 py-2">{error}</div>}
          <div className="flex items-center gap-2">
            <Btn variant="primary" size="sm" disabled={!canEdit || saving} onClick={handleSave}>{saving ? "Saving…" : "Save"}</Btn>
            {saved && <span className="text-xs text-muted-foreground">Saved.</span>}
          </div>
        </div>
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-3">Subscription</p>
        {canEdit ? <SubscriptionCheckout/> : <div className="text-xs text-muted-foreground">Only an administrator on your team can manage billing.</div>}
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-3">Support</p>
        <SupportTicketForm defaultCategory="delete_organization"/>
      </div>
    </div>
  );
}

export default function AgencyApp({ onLogout }: { onLogout: () => void }) {
  const { profile, org } = useAuth();
  const agencyName = org?.name ?? "";
  const [view, setView] = useState<View>("projects");
  const [roster, setRoster] = useState<RosterModel[]>([]);
  // Set only while viewing a single project's in-project workspace,
  // drilled into from the Projects list (including via each card's own
  // "Submit Talent" button, and calendar events — clicking either just
  // opens the project, where Submit Talent itself now lives) — separate
  // from `view` since it's a nested state within the "projects" nav
  // item, not a sibling of it.
  const [openProjectName, setOpenProjectName] = useState<string | null>(null);
  // Shared between the Projects list (to pin not-yet-submitted projects
  // above already-submitted ones) and the in-project workspace (which
  // records into it on a successful submit).
  const [submitted, setSubmitted] = useState<CampaignSubmissionStatus[]>([]);
  const [campaigns, setCampaigns] = useState<AgencyCampaignSummary[]>([]);

  useEffect(() => {
    let active = true;
    if (org) fetchAgencyRoster(org.id, org.name).then(r => { if (active) setRoster(r); });
    return () => { active = false; };
  }, [org?.id, org?.name]);

  useEffect(() => {
    let active = true;
    if (org) fetchAgencyCampaigns(org.id).then(c => { if (active) setCampaigns(c); });
    return () => { active = false; };
  }, [org?.id]);

  function handleModelAdded(model: RosterModel) {
    setRoster(prev => [...prev, model]);
  }

  return (
    <CurrentUserProvider user={{ name:profile?.fullName ?? "", title:org?.title ?? "", org:agencyName, email:profile?.email ?? "", phone:profile?.phone ?? "", access:org?.accessLevel ?? "basic" }}>
      <div className="h-screen flex bg-background overflow-hidden">
        <aside className="w-52 shrink-0 glass border-r flex flex-col">
          <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
            <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">{agencyName.trim()[0]?.toUpperCase() ?? "?"}</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate flex items-center gap-1.5">{agencyName} <CountryFlag country={ORG_COUNTRY[agencyName]} className="text-xs"/></div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Agency</div>
            </div>
          </div>
          <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
            {NAV.map(item=>{
              const NavIcon = item.Icon;
              return (
                <button key={item.id} onClick={()=>{ setView(item.id); setOpenProjectName(null); }}
                  className={cx("w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors text-left",
                    view===item.id?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}>
                  <NavIcon size={15}/>{item.label}
                  {(() => { const n = item.id==="projects" ? campaigns.length : item.count; return n ? <span className="ml-auto text-[10px] font-mono bg-foreground text-primary-foreground px-1.5 py-0.5 rounded-full">{n}</span> : null; })()}
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
        <main className="flex-1 flex flex-col min-h-0">
          <TopBar title={NAV.find(n=>n.id===view)?.label ?? ""} sub={`${agencyName} · Agency`} showRefresh={false}/>
          <div className="flex-1 overflow-auto p-6">
            {view === "projects" && (
              openProjectName ? (
                <AgencyCampaignDetail
                  campaign={openProjectName}
                  campaigns={campaigns}
                  onBack={()=>setOpenProjectName(null)}
                  roster={roster}
                  onGoToRoster={()=>{ setOpenProjectName(null); setView("roster"); }}
                  submitted={submitted}
                  setSubmitted={setSubmitted}
                />
              ) : (
                <ProjectsView campaigns={campaigns} onOpenProject={setOpenProjectName} submitted={submitted}/>
              )
            )}
            {view === "roster" && <RosterView roster={roster} onModelAdded={handleModelAdded}/>}
            {view === "payments" && <PaymentsView/>}
            {view === "messaging" && <AgencyMessagingView/>}
            {view === "network" && <NetworkView/>}
            {view === "profile" && <AgencyProfileView/>}
          </div>
        </main>
      </div>
    </CurrentUserProvider>
  );
}
