import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LayoutDashboard, Plus, ChevronRight, ChevronDown, ChevronLeft,
  X, Check, Star, Search, Briefcase,
  AlertCircle, Camera, XCircle,
  MessageSquare, Download, CreditCard, MapPin,
  Settings, Building2, Shield,
  Calendar, FileText, Activity, List, BookOpen,
  BarChart2, FileCheck, Send, Edit3, Eye, ChevronUp,
  User, Users, LogOut, Pin, Lock, Globe, Shirt, Home, Megaphone
} from "lucide-react";
import type { SubmissionStage, Talent, IconFn, CardComment, Campaign, Look, CampaignThreadMessage } from "../shared/types";
import { cx, XBox, UserAvatar, PolaroidIcon, Badge, Btn, Stat, FieldLabel, TextInput, FSelect, Textarea, Chip, SidebarBadge, TopBar, ActivityFeedPanel, CurrentUserProvider, useCurrentUser, Modal, CountryFlag, DvureSignature, DvureWordmark, DvureMark, GateBanner, OrgLogoBox } from "../shared/ui";
import { getAccessGate } from "../shared/accessGate";
import { INDEPENDENT_MODELS_ENABLED } from "../shared/featureFlags";
import { SAMPLE_TALENT, PIPELINE_STAGES, DECLINE_REASONS, ORG_USERS, ACCESS_BADGE, ACTIVITY_EVENTS, CARD_COMMENTS, RUNWAY_SHOWS, RUNWAY_SHOW_OTHER_BRANDS, CREW, LOOKS, MOCK_NOW, CAMPAIGN_AGENCIES, CAMPAIGN_AGENCY_THREADS, ORG_COUNTRY, assignCampaignCovers } from "../shared/mockData";
import { useAuth } from "../shared/auth";
import { updateOrgLogo } from "../../lib/queries/auth";
import { fetchPartneredAgencies, fetchBrandCampaigns, createCampaign, distributeCampaignToAgencies, archiveCampaign } from "../../lib/queries/campaigns";
import { fetchCampaignSubmissions, updateSubmissionStage, type SubmissionShim } from "../../lib/queries/submissions";
import { fetchSubmissionComments, insertSubmissionComment } from "../../lib/queries/comments";
import { createBooking, DEFAULT_AGENCY_PCT, PLATFORM_FEE_PCT_ACH, PLATFORM_FEE_PCT_CARD } from "../../lib/queries/bookings";
import { recordInvoicePayment, confirmInvoicePayment, voidInvoicePayment, fetchInvoicesForBrand, fetchInvoiceById, type Invoice, type InvoicePayment, type InvoiceStatus, type ManualPaymentMethod, type PaymentMethod, type RecordInvoicePaymentParams } from "../../lib/queries/payments";
import { createInvoicePayment, createSetupIntent, listPaymentMethods, type SavedCard, type InvoicePaymentIntent } from "../../lib/queries/stripe";
import CardPaymentStep from "./CardPaymentStep";
import AddCardStep from "../shared/AddCardStep";
import SubscriptionPanel from "../shared/SubscriptionPanel";
import { searchIndependentModels, submitIndependentModel, type IndependentModel } from "../../lib/queries/independentModels";
import { fetchOutstandingPayees, type OutstandingPayee } from "../../lib/queries/outstandingPayments";
import CampaignCalendar, { type CalEvent, type EventKind } from "./CampaignCalendar";
import CallSheet, { CrewTab } from "../shared/CallSheet";
import { fetchCampaignsNeedingLeads, type CampaignNeedingLeads } from "../../lib/queries/callSheet";
import { fetchOrgAuditLog, type AuditLogEntry } from "../../lib/queries/auditLog";
import { fetchCampaignContracts, createContract, sendContract, markContractExecuted, type Contract } from "../../lib/queries/contracts";
import { fetchShootDays, saveShootDays, createShootDay, type ShootDay } from "../../lib/queries/deliverables";
import { createCasting } from "../../lib/queries/castings";
import { fetchScheduleEvents } from "../../lib/queries/schedule";
import { fetchCalendarFeedToken, regenerateCalendarFeedToken } from "../../lib/queries/calendarFeed";
import { fetchOrgMembers, updateOrgMember, type OrgMember, type AccessLevel } from "../../lib/queries/orgMembers";
import { createOrgStaffInvite, fetchPendingOrgInvites, type PendingInvite } from "../../lib/queries/invites";

type GlobalView = "campaigns" | "schedule" | "contracts-global" | "payments-global" | "messaging" | "reports" | "network" | "directory" | "settings";
type AppView = GlobalView | "campaign" | "create-campaign";
type CampaignSection = "overview" | "moodboard" | "crew" | "call-sheet" | "looks" | "requirements" | "deliverables" | "contracts" | "payments" | "activity" | "collaboration" | "users";

const PARTNERED_AGENCIES = ["Vantage Model Management","Meridian Models","Solenne","Vector Models"];

// ─── CONTRACT MODAL ────────────────────────────────────────────────────────

function ContractModal({ talent, onSend, onLater }: { talent: Talent; onSend: () => void; onLater: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-strong border rounded-md w-full max-w-md mx-4 overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="text-heading text-sm">Contract Generated</div>
          <button onClick={onLater} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-secondary border border-border rounded-md p-4">
            <div className="flex items-center gap-3 mb-3">
              <FileCheck size={16} className="text-foreground shrink-0"/>
              <div>
                <div className="text-sm font-semibold">{talent.name}</div>
                <div className="text-xs text-muted-foreground">CF-2025-{900 + talent.id} · {talent.agency}</div>
              </div>
            </div>
            {[["Day Rate", talent.rate],["Agency Commission", talent.agency==="Independent" ? "N/A — independent" : "20%"],["Territory","United States"],["Duration","1 year"]].map(([k,v])=>(
              <div key={k} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            A contract has been automatically generated based on {talent.name}'s booking rate. Review and edit before sending to {talent.agency} for signature.
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <Btn variant="primary" icon={<Edit3 size={13}/>} onClick={onSend}>Edit & Send Contract</Btn>
          <Btn variant="outline" onClick={onLater}>Send Later</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── BRAND SIDEBAR ─────────────────────────────────────────────────────────

// A lone "!" reads as far less alarming than any circled/triangled alert
// glyph — lucide doesn't ship a bare exclamation mark, so this renders one
// as plain text sized/positioned to drop into the same IconFn slot.
function ExclamationIcon({ size = 15, className }: { size?: number; className?: string }) {
  return (
    <span className={className} style={{ fontSize: size, lineHeight: 1, fontWeight: 800, display: "inline-block", width: size, textAlign: "center" }}>
      !
    </span>
  );
}

const GLOBAL_NAV: { id: GlobalView; label: string; Icon: IconFn; badge?: number }[] = [
  { id:"campaigns",        label:"Projects",   Icon:Camera                },
  { id:"schedule",         label:"Calendar",   Icon:Calendar               },
  { id:"contracts-global", label:"Contracts",  Icon:FileCheck              },
  { id:"payments-global",  label:"Payments",   Icon:CreditCard             },
  { id:"messaging",        label:"Messaging",  Icon:MessageSquare          },
  { id:"reports",          label:"Reports",    Icon:BarChart2              },
  { id:"network",          label:"Network",    Icon:Building2              },
  { id:"directory",        label:"Directory",  Icon:User                   },
];

function BrandSidebar({ active, onNav, onLogout }: {
  active: GlobalView; onNav: (v: GlobalView) => void; onLogout: () => void;
}) {
  const currentUser = useCurrentUser();
  const orgName = currentUser?.org ?? "";
  const { org: accountOrg, refreshIdentity } = useAuth();
  const canEditLogo = accountOrg?.accessLevel === "administrator";
  async function handleLogoChange(dataUri: string) {
    if (!accountOrg) return;
    await updateOrgLogo(accountOrg.id, dataUri);
    await refreshIdentity();
  }
  // Pending-review items live under the nav item they actually come from —
  // a contract badge on Contracts, a payment badge on Payments — rather
  // than a single catch-all "Pending Review" page. Review-type overdue
  // items don't have a global nav home of their own (they're per-campaign
  // submissions), so those still only surface via the floating Needs
  // Attention widget below.
  const navBadge: Partial<Record<GlobalView, number>> = {
    "payments-global":  OVERDUE_ACTIONS.filter(a=>a.type==="Payment").length,
    "contracts-global": OVERDUE_ACTIONS.filter(a=>a.type==="Contract").length,
  };
  return (
    <aside className="w-52 shrink-0 glass border-r flex flex-col h-full">
      <div className="px-3 py-2.5 min-h-14 flex items-start border-b border-border gap-2">
        <div className="shrink-0 mt-0.5"><OrgLogoBox org={accountOrg} canEdit={canEditLogo} onLogoChange={handleLogoChange} size={32}/></div>
        <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 self-center">
          <span className="text-sm font-medium break-words">{orgName}</span>
          <span className="text-heading text-xs shrink-0 text-muted-foreground">Brand</span>
        </div>
        <button onClick={()=>onNav("campaigns")} title="Projects"
          className="shrink-0 mt-0.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
          <Home size={13}/>
        </button>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-1.5">
        {GLOBAL_NAV.map(item => {
          const NavIcon = item.Icon;
          const badgeCount = navBadge[item.id] ?? 0;
          return (
            <button key={item.id} onClick={() => onNav(item.id)}
              className={cx("w-full flex items-center gap-3 px-3 py-3 rounded-lg border text-sm transition-colors text-left cursor-pointer",
                active===item.id
                  ? "bg-secondary border-foreground/15 text-foreground font-medium shadow-sm"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-border"
              )}>
              <span className={cx("w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors",
                active===item.id ? "bg-foreground text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}>
                <NavIcon size={15}/>
              </span>
              {item.label}
              {badgeCount>0 && <SidebarBadge count={badgeCount}/>}
            </button>
          );
        })}
      </nav>
      <div className="px-3 pb-1 border-t border-border pt-3">
        <button onClick={()=>onNav("settings")}
          className={cx("w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left",
            active==="settings"?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}>
          <Settings size={15}/>Settings
        </button>
      </div>
      <div className="px-3 pb-3 border-t border-border pt-3">
        <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary">
          <LogOut size={13}/> Sign out
        </button>
        <div className="flex items-center justify-center gap-1.5 pt-3 opacity-40">
          <DvureMark size={12}/><DvureSignature size={10}/>
        </div>
      </div>
    </aside>
  );
}

const CAMPAIGN_NAV_BASE: { id: CampaignSection; label: string; Icon: IconFn }[] = [
  { id:"overview",      label:"Overview",      Icon:LayoutDashboard },
  { id:"moodboard",     label:"Model Board",   Icon:PolaroidIcon    },
  { id:"requirements",  label:"Requirements",  Icon:BookOpen        },
  { id:"deliverables",  label:"Schedule",      Icon:Calendar        },
  { id:"contracts",     label:"Contracts",     Icon:FileCheck       },
  { id:"payments",      label:"Payments",      Icon:CreditCard      },
  { id:"activity",      label:"Activity",      Icon:Activity        },
  { id:"collaboration", label:"Messaging",     Icon:MessageSquare   },
  { id:"users",         label:"Users",         Icon:User            },
];

// Crew and Call Sheet are universal companion tools — every type gets
// both as their own tabs right under Submissions, not a swap-in only
// certain types receive. Split from a single "Call Sheet" tab: Crew is
// the working surface (assign people, set rates, manage leads) and
// Call Sheet is the read-only printed handout — production juggling
// assignments all week shouldn't share a tab with the document you
// print and send out once the roster's locked. Runway additionally
// gets a Looks tab, since that's specifically a fashion-show concern
// the others don't share. (Casting Board was pulled — it's part of
// Relay, deferred to Phase 2 along with the rest of that module.)
function campaignNavFor(type: Campaign["type"]): { id: CampaignSection; label: string; Icon: IconFn }[] {
  const withCallSheet = CAMPAIGN_NAV_BASE.flatMap(item => item.id==="moodboard" ? [
    item,
    { id:"crew" as CampaignSection, label:"Crew", Icon:Users },
    { id:"call-sheet" as CampaignSection, label:"Call Sheet", Icon:FileText },
  ] : [item]);
  if (type !== "Runway") return withCallSheet;
  return withCallSheet.flatMap(item => item.id==="requirements" ? [{ id:"looks" as CampaignSection, label:"Looks", Icon:Shirt }, item] : [item]);
}

function CampaignSidebar({ campaign, section, onSection, onBack, onNewCampaign, onHome, counts, fullExtensionUntil, isReal, canArchive, onArchive }: {
  campaign: Campaign; section: CampaignSection; onSection: (s: CampaignSection) => void;
  onBack: () => void; onNewCampaign: () => void; onHome: () => void; counts: Record<string,number>; fullExtensionUntil?: string;
  isReal?: boolean; canArchive?: boolean; onArchive?: () => void;
}) {
  const currentUser = useCurrentUser();
  const orgName = currentUser?.org ?? "";
  const { org: accountOrg, refreshIdentity } = useAuth();
  const canEditLogo = accountOrg?.accessLevel === "administrator";
  async function handleLogoChange(dataUri: string) {
    if (!accountOrg) return;
    await updateOrgLogo(accountOrg.id, dataUri);
    await refreshIdentity();
  }
  const nav = campaignNavFor(campaign.type);
  const effectiveClose = fullExtensionUntil && new Date(fullExtensionUntil) > new Date(campaign.submissionClose) ? fullExtensionUntil : campaign.submissionClose;
  return (
    <aside className="w-52 shrink-0 glass border-r flex flex-col h-full">
      <div className="px-3 py-2.5 min-h-14 flex items-start border-b border-border gap-2">
        <div className="shrink-0 mt-0.5"><OrgLogoBox org={accountOrg} canEdit={canEditLogo} onLogoChange={handleLogoChange} size={32}/></div>
        <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 self-center">
          <span className="text-sm font-medium break-words">{orgName}</span>
          <span className="text-heading text-xs shrink-0 text-muted-foreground">Brand</span>
        </div>
        <button onClick={onHome} title="Projects"
          className="shrink-0 mt-0.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
          <Home size={13}/>
        </button>
      </div>
      <div className="px-3 pt-3 pb-2">
        <button onClick={onBack} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors text-left">
          <ChevronLeft size={13}/> All Projects
        </button>
      </div>
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-1"><Badge label={campaign.status==="archived"?"Archived":"Active"} variant={campaign.status==="archived"?"draft":"active"}/></div>
        <div className="text-xs font-semibold leading-snug">{campaign.name}</div>
        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{campaign.type} · Due {campaign.due}</div>
        <div className="text-[10px] text-muted-foreground font-mono mt-1.5 flex items-center gap-1.5">
          <span>Submissions {campaign.submissionOpen} – {effectiveClose}</span>
          {MOCK_NOW > new Date(effectiveClose)
            ? <span className="text-urgent font-semibold">Closed</span>
            : <span className="text-offwhite-foreground bg-offwhite px-1 rounded-sm font-semibold">Open</span>}
        </div>
        {campaign.status!=="archived" && onArchive && (!isReal || canArchive) && (
          <button onClick={onArchive} disabled={!isReal} title={isReal?undefined:"Demo campaigns can't be archived"}
            className="w-full mt-2.5 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground border border-dashed border-border rounded-md hover:border-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted-foreground">
            <Check size={11}/> Mark Complete & Archive
          </button>
        )}
      </div>
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {nav.map(item => {
          const NavIcon = item.Icon;
          return (
            <button key={item.id} onClick={() => onSection(item.id)}
              className={cx("w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left",
                section===item.id?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}>
              <NavIcon size={14}/>{item.label}
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-3 border-t border-border">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2 px-1">Pipeline</div>
        {PIPELINE_STAGES.map(s => (
          <div key={s.id} className="flex items-center justify-between px-1 py-0.5">
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className="text-xs font-mono font-semibold">{counts[s.id] ?? 0}</span>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3 border-t border-border pt-3">
        <button onClick={onNewCampaign}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-foreground text-primary-foreground text-xs font-medium rounded-md hover:bg-foreground/90 transition-colors">
          <Plus size={13}/> New Campaign
        </button>
      </div>
    </aside>
  );
}

// ─── SUBMISSIONS (KANBAN: Submitted -> Approved -> Booked) ─────────────────

function Moodboard({ talent, setTalent, comments, onPostComment, onContractPrompt, onViewAgency, onBook, realCampaignId, onIndependentAdded }: {
  talent: Talent[]; setTalent: (fn: (prev: Talent[]) => Talent[]) => void; comments: CardComment[]; onPostComment: (talentId: number, text: string) => void; onContractPrompt: (t: Talent) => void; onViewAgency: (agency: string) => void; onBook: (ids: number[]) => void;
  realCampaignId?: string | null; onIndependentAdded?: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [showIndependentModal, setShowIndependentModal] = useState(false);
  const [dragging, setDragging] = useState<number|null>(null);
  const [dragOver, setDragOver] = useState<SubmissionStage|null>(null);
  const [toast, setToast] = useState<{ msg: string; undo: () => void }|null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const [drawer, setDrawer] = useState<Talent|null>(null);
  const [declineModal, setDeclineModal] = useState<Talent|null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [commentDraft, setCommentDraft] = useState("");

  const commentsFor = (talentId: number) => comments.filter(c => c.talentId === talentId);

  function postComment(talentId: number) {
    if (!commentDraft.trim()) return;
    onPostComment(talentId, commentDraft);
    setCommentDraft("");
  }

  const byStage = (s: SubmissionStage) => talent.filter(t => t.stage === s);
  const totalNeeded = 4;
  const booked = byStage("booked").length;
  const daysRemaining = 8;

  function moveTo(id: number, stage: SubmissionStage) {
    setTalent(prev => prev.map(t => t.id === id ? { ...t, stage } : t));
  }

  function showToast(msg: string, undo: () => void) {
    setToast({ msg, undo: () => { undo(); setToast(null); } });
    setTimeout(() => setToast(null), 7000);
  }

  function moveWithUndo(id: number, newStage: SubmissionStage, label: string) {
    if (newStage === "rejected") {
      const t = talent.find(x => x.id === id);
      if (t) setDeclineModal(t);
      return;
    }
    if (newStage === "booked") {
      onBook([id]);
      return;
    }
    const prev = talent.find(t => t.id === id);
    if (!prev) return;
    const prevStage = prev.stage;
    moveTo(id, newStage);
    if (newStage === "approved") onContractPrompt({ ...prev, stage: newStage });
    showToast(`${prev.name} moved to ${label}`, () => moveTo(id, prevStage));
  }

  function bulkMove(ids: number[], newStage: SubmissionStage, label: string) {
    if (newStage === "booked") {
      onBook(ids);
      setSelected([]);
      return;
    }
    const prevMap = ids.map(id => ({ id, stage: talent.find(x => x.id === id)?.stage ?? "submitted" as SubmissionStage }));
    ids.forEach(id => moveTo(id, newStage));
    setSelected([]);
    showToast(`${ids.length} models moved to ${label}`, () => { prevMap.forEach(({ id, stage }) => moveTo(id, stage)); });
  }

  function toggleSelect(id: number) {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  const STAGE_ACTIONS: Partial<Record<SubmissionStage, { stage: SubmissionStage; label: string }[]>> = {
    submitted: [{ stage:"approved", label:"Approve" }, { stage:"rejected", label:"Reject" }],
    approved:  [{ stage:"booked", label:"Book" }, { stage:"submitted", label:"Return" }],
    booked:    [],
  };

  return (
    <div className="flex-1 flex flex-col h-full relative">
      <div className="glass border-b px-5 py-2 shrink-0 flex items-center gap-3 flex-wrap">
        <div className="flex items-center border border-border rounded-md bg-input-background px-3 gap-2 h-8">
          <Search size={13} className="text-muted-foreground"/>
          <input placeholder="Search…" className="text-xs bg-transparent focus:outline-none w-24 placeholder:text-muted-foreground"/>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground border-l border-border pl-3">
          <span><span className="font-semibold text-foreground">{talent.filter(t=>t.stage!=="rejected").length}</span> in pipeline</span>
          <span>·</span>
          <span><span className="font-semibold text-foreground">{booked}/{totalNeeded}</span> booked</span>
          <span>·</span>
          <span className={cx("font-semibold", daysRemaining<=3?"text-foreground":"text-muted-foreground")}>{daysRemaining} days left</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {realCampaignId && INDEPENDENT_MODELS_ENABLED && (
            <button onClick={()=>setShowIndependentModal(true)}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5 hover:bg-secondary transition-colors flex items-center gap-1">
              <Plus size={10}/> Add Independent Model
            </button>
          )}
          <button onClick={() => setShowRejected(p=>!p)}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5 hover:bg-secondary transition-colors flex items-center gap-1">
            {showRejected ? <ChevronUp size={10}/> : <ChevronDown size={10}/>} Rejected ({byStage("rejected").length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex min-h-0">
        <div className="flex-1 overflow-auto">
          <div className="flex gap-0 h-full min-w-max">
            {PIPELINE_STAGES.map(stage => {
              const cards = byStage(stage.id);
              const isOver = dragOver === stage.id;
              const actions = STAGE_ACTIONS[stage.id] ?? [];
              return (
                <div key={stage.id}
                  className={cx("w-64 flex-shrink-0 flex flex-col border-r border-border last:border-0 transition-colors", isOver?"bg-secondary/60":"bg-background")}
                  onDragOver={e=>{e.preventDefault();setDragOver(stage.id);}}
                  onDragLeave={()=>setDragOver(null)}
                  onDrop={()=>{if(dragging!==null){moveWithUndo(dragging,stage.id,stage.label);setDragging(null);setDragOver(null);}}}
                >
                  <div className={cx("px-4 py-3 border-b border-border flex items-center justify-between shrink-0", stage.id==="booked"?"bg-foreground":"glass")}>
                    <div className="flex items-center gap-2">
                      <span className={cx("text-sm font-semibold",stage.id==="booked"?"text-primary-foreground":"")}>{stage.label}</span>
                      <span className={cx("text-xs font-mono px-1.5 py-0.5 rounded-sm font-semibold",stage.id==="booked"?"bg-primary-foreground/15 text-primary-foreground":"bg-secondary text-foreground")}>{cards.length}</span>
                    </div>
                    {cards.length>0&&(
                      <button onClick={()=>setSelected(p=>{const ids=cards.map(c=>c.id);const all=ids.every(id=>p.includes(id));return all?p.filter(id=>!ids.includes(id)):[...new Set([...p,...ids])];})}
                        className={cx("text-[10px] font-mono",stage.id==="booked"?"text-primary-foreground/60 hover:text-primary-foreground":"text-muted-foreground hover:text-foreground")}>
                        Select all
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {cards.length===0&&(
                      <div className={cx("h-20 flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground",isOver?"border-foreground bg-secondary":"border-border")}>
                        {isOver?"Drop here":"Empty"}
                      </div>
                    )}
                    {cards.map(t=>{
                      const isSel=selected.includes(t.id);
                      const isDrag=dragging===t.id;
                      return (
                        <div key={t.id} draggable
                          onDragStart={()=>setDragging(t.id)}
                          onDragEnd={()=>{setDragging(null);setDragOver(null);}}
                          onClick={()=>{toggleSelect(t.id);setDrawer(t);setCommentDraft("");}}
                          className={cx("glass-subtle rounded-md border overflow-hidden cursor-pointer select-none transition-all group",
                            isSel?"border-foreground ring-1 ring-foreground":"border-border hover:border-foreground/40",
                            isDrag&&"opacity-40"
                          )}
                        >
                          <div className="relative">
                            {t.photo ? <img src={t.photo} alt="" className="w-full h-32 object-cover"/> : <XBox className="w-full h-32"/>}
                            <div className={cx("absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",isSel?"bg-foreground border-foreground":"bg-card/80 border-border")}>
                              {isSel&&<Check size={11} className="text-primary-foreground"/>}
                            </div>
                          </div>
                          <div className="p-2.5 space-y-0.5">
                            <div className="text-xs font-semibold leading-tight truncate flex items-center gap-1">
                              {t.name} <CountryFlag location={t.location} className="text-[11px] shrink-0"/>
                            </div>
                            {t.motherAgency ? (<>
                              <div className="text-[10px] text-muted-foreground truncate">
                                <span className="text-muted-foreground/70">Mother:</span>{" "}
                                <button onClick={e=>{ e.stopPropagation(); onViewAgency(t.motherAgency); }}
                                  className="hover:text-foreground hover:underline underline-offset-2 cursor-pointer">{t.motherAgency}</button>
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                <span className="text-muted-foreground/70">Boutique:</span>{" "}
                                {t.boutiqueAgency ? (
                                  <button onClick={e=>{ e.stopPropagation(); onViewAgency(t.boutiqueAgency!); }}
                                    className="hover:text-foreground hover:underline underline-offset-2 cursor-pointer">{t.boutiqueAgency}</button>
                                ) : "None"}
                              </div>
                            </>) : (
                              <div className="text-[10px] text-muted-foreground truncate">
                                <span className="text-muted-foreground/70">Independent</span> — no agency
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                              <span>{t.height}</span><span>·</span><span className="truncate">{t.location.split(",")[0]}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="text-[10px] font-mono font-medium">{t.rate}</div>
                              <div className="flex items-center gap-0.5">
                                {[0,1,2,3,4].map(i=><Star key={i} size={7} className={i<t.score?"fill-foreground text-foreground":"text-muted-foreground"}/>)}
                              </div>
                            </div>
                            {commentsFor(t.id).length>0 && (
                              <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono pt-0.5">
                                <Pin size={9}/> {commentsFor(t.id).length} comment{commentsFor(t.id).length!==1?"s":""}
                              </div>
                            )}
                          </div>
                          {actions.length>0&&(
                            <div className="border-t border-border flex divide-x divide-border opacity-0 group-hover:opacity-100 transition-opacity" onClick={e=>e.stopPropagation()}>
                              {actions.map(a=>(
                                <button key={a.label} onClick={()=>moveWithUndo(t.id,a.stage,a.label)}
                                  className={cx("flex-1 py-1.5 text-[10px] font-medium transition-colors",
                                    a.label==="Reject"?"text-muted-foreground hover:bg-muted"
                                      :a.label==="Book"||a.label==="Approve"?"bg-foreground text-primary-foreground hover:bg-foreground/90"
                                      :"text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  )}>{a.label}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {drawer && (
          <div className="w-72 shrink-0 border-l glass-strong flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <div className="text-sm font-semibold truncate flex items-center gap-1.5">{drawer.name} <CountryFlag location={drawer.location} className="text-xs"/></div>
              <button onClick={()=>{setDrawer(null);setSelected(p=>p.filter(x=>x!==drawer.id));}} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Portfolio</div>
                {drawer.photo ? <img src={drawer.photo} alt="" className="w-full h-36 rounded-md object-cover"/> : <XBox className="w-full h-36 rounded-md"/>}
                <div className="grid grid-cols-3 gap-1 mt-1">{[0,1,2].map(i=><XBox key={i} className="aspect-square rounded-sm"/>)}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Measurements</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[["Height",drawer.height],["Bust",drawer.bust],["Waist",drawer.waist],["Hips","35\""],["Dress",drawer.dress],["Shoe","US 8"]].map(([k,v])=>(
                    <div key={k} className="bg-secondary rounded-sm px-2 py-1.5">
                      <div className="text-[9px] font-mono text-muted-foreground">{k}</div>
                      <div className="text-xs font-medium">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Agency Representation</div>
                <div className="bg-secondary rounded-md p-3 space-y-2">
                  <div>
                    <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wide">Mother Agency</div>
                    <button onClick={()=>onViewAgency(drawer.motherAgency)} className="text-xs font-semibold hover:underline underline-offset-2 cursor-pointer">{drawer.motherAgency}</button>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wide">Boutique Agency</div>
                    {drawer.boutiqueAgency ? (
                      <button onClick={()=>onViewAgency(drawer.boutiqueAgency!)} className="text-xs font-semibold hover:underline underline-offset-2 cursor-pointer">{drawer.boutiqueAgency}</button>
                    ) : <div className="text-xs font-semibold">None</div>}
                  </div>
                  <div className="pt-2 border-t border-border text-[10px] text-muted-foreground">
                    Submitted via {drawer.agency} · Sophie Chen · sophie@elitemodels.com
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Details</div>
                {[["Location",drawer.location],["Experience",drawer.exp],["Day Rate",drawer.rate]].map(([k,v])=>(
                  <div key={k} className="flex justify-between py-1.5 border-b border-border last:border-0 text-xs">
                    <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Pin size={10}/> Comments
                </div>
                <div className="space-y-2 mb-2">
                  {commentsFor(drawer.id).length===0 && (
                    <div className="text-[10px] text-muted-foreground italic">No comments yet — leave the first one for your team.</div>
                  )}
                  {commentsFor(drawer.id).map(c=>(
                    <div key={c.id} className="glass-subtle border rounded-md px-3 py-2 relative">
                      <div className="absolute top-0 left-3 -translate-y-1/2 w-2 h-2 rounded-full bg-foreground/70"/>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold">{c.author}</span>
                        <span className="text-[9px] font-mono text-muted-foreground shrink-0">{c.ts}</span>
                      </div>
                      <div className="text-xs leading-relaxed">{c.text}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea value={commentDraft} onChange={e=>setCommentDraft(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); postComment(drawer.id); }}}
                    placeholder="Leave a comment for your team…" rows={2}
                    className="flex-1 bg-input-background border border-border rounded-md px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-foreground resize-none"/>
                  <button onClick={()=>postComment(drawer.id)} disabled={!commentDraft.trim()}
                    className="shrink-0 px-3 rounded-md bg-foreground text-primary-foreground text-xs font-medium hover:bg-foreground/90 transition-colors disabled:opacity-30 disabled:pointer-events-none">
                    Post
                  </button>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Notes</div>
                <textarea defaultValue={drawer.note||""} placeholder="Add internal notes…" rows={3}
                  className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-foreground resize-none"/>
              </div>
            </div>
            <div className="border-t border-border p-3 space-y-2 shrink-0">
              <button onClick={()=>{moveWithUndo(drawer.id,"approved","Approved");setDrawer(null);}}
                className="w-full py-2 text-xs font-medium bg-foreground text-primary-foreground rounded-md hover:bg-foreground/90 transition-colors">
                Approve
              </button>
              <button onClick={()=>{setDeclineModal(drawer);setDrawer(null);}}
                className="w-full py-1.5 text-xs text-muted-foreground border border-border rounded-md hover:bg-muted transition-colors">Reject</button>
            </div>
          </div>
        )}
      </div>

      {showRejected && byStage("rejected").length > 0 && (
        <div className="border-t border-border glass shrink-0 max-h-36 overflow-auto">
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Rejected ({byStage("rejected").length})</span>
            <button onClick={()=>setShowRejected(false)} className="text-muted-foreground hover:text-foreground"><X size={13}/></button>
          </div>
          <div className="flex gap-3 p-3 overflow-x-auto">
            {byStage("rejected").map(t=>(
              <div key={t.id} className="flex-shrink-0 flex items-center gap-2 bg-muted/40 border border-border rounded-md px-3 py-2 opacity-60">
                <div><div className="text-xs font-medium">{t.name}</div><div className="text-[10px] text-muted-foreground">{t.agency}</div></div>
                <button onClick={()=>moveWithUndo(t.id,"submitted","Submitted")} className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 hover:bg-secondary ml-2">Restore</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-primary-foreground rounded-lg shadow-lg px-4 py-3 flex items-center gap-4 z-30">
          <span className="text-sm font-semibold whitespace-nowrap">{selected.length} selected</span>
          <div className="flex items-center gap-2">
            {["Approve","Book"].map(label=>{
              const m: Record<string,SubmissionStage>={Approve:"approved",Book:"booked"};
              return <button key={label} onClick={()=>bulkMove(selected,m[label],label)} className="text-xs font-medium bg-primary-foreground/15 hover:bg-primary-foreground/25 px-3 py-1.5 rounded-md">{label}</button>;
            })}
            <button onClick={()=>bulkMove(selected,"rejected","Rejected")} className="text-xs text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 px-2 py-1.5 rounded-md">Reject</button>
            <button onClick={()=>setSelected([])} className="ml-1 text-primary-foreground/60 hover:text-primary-foreground"><X size={15}/></button>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute bottom-6 right-6 glass-subtle border rounded-md shadow-lg px-4 py-3 flex items-center gap-4 z-30 max-w-sm">
          <span className="text-sm flex-1">{toast.msg}</span>
          <button onClick={toast.undo} className="text-xs font-semibold underline underline-offset-2 hover:no-underline shrink-0">Undo</button>
          <button onClick={()=>setToast(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X size={13}/></button>
        </div>
      )}

      {declineModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-strong border rounded-md w-80 overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="text-heading text-sm">Reject — {declineModal.name}</div>
              <button onClick={()=>{setDeclineModal(null);setDeclineReason("");}} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-xs text-muted-foreground">Select a reason to log for reporting purposes.</div>
              <div className="space-y-1.5">
                {DECLINE_REASONS.map(r=>(
                  <button key={r} onClick={()=>setDeclineReason(r)}
                    className={cx("w-full text-left px-3 py-2 text-sm rounded-md border transition-colors",
                      declineReason===r?"bg-foreground text-primary-foreground border-foreground":"border-border hover:bg-secondary"
                    )}>{r}</button>
                ))}
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <Btn variant="primary" disabled={!declineReason} onClick={()=>{
                const t=declineModal;
                const prevStage=t.stage;
                moveTo(t.id,"rejected");
                setDeclineModal(null);setDeclineReason("");
                showToast(`${t.name} rejected`,()=>moveTo(t.id,prevStage));
              }}>Confirm Reject</Btn>
              <Btn variant="outline" onClick={()=>{setDeclineModal(null);setDeclineReason("");}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {INDEPENDENT_MODELS_ENABLED && showIndependentModal && realCampaignId && (
        <AddIndependentModelModal campaignId={realCampaignId}
          onClose={()=>setShowIndependentModal(false)}
          onAdded={()=>{ setShowIndependentModal(false); onIndependentAdded?.(); }}/>
      )}
    </div>
  );
}

// Not-repped models are found here, not in the mock talent pool —
// model_profiles_select_independent (0049) exposes every independent
// row to any signed-in user, so this is a live search, not a picklist.
function AddIndependentModelModal({ campaignId, onClose, onAdded }: {
  campaignId: string; onClose: () => void; onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IndependentModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    searchIndependentModels(query).then(r => { if (active) { setResults(r); setLoading(false); } });
    return () => { active = false; };
  }, [query]);

  async function handleAdd(modelId: string) {
    setSubmittingId(modelId);
    setError(null);
    const { error } = await submitIndependentModel(campaignId, modelId);
    setSubmittingId(null);
    if (error) { setError(error); return; }
    onAdded();
  }

  return (
    <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-card border border-border rounded-md w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-heading text-sm">Add Independent Model</div>
            <div className="text-xs text-muted-foreground mt-0.5">Not repped by any agency — you'll deal with them directly.</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={16}/></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center border border-border rounded-md bg-input-background px-3 gap-2 h-9">
            <Search size={13} className="text-muted-foreground shrink-0"/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name…" autoFocus
              className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"/>
          </div>
          {error && <div className="text-xs text-red-500">{error}</div>}
          <div className="max-h-80 overflow-y-auto space-y-1.5">
            {loading ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
            ) : results.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No independent models found{query ? ` matching "${query}"` : ""}.</div>
            ) : results.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-md border border-border">
                <div className="w-9 h-9 rounded-full bg-secondary shrink-0 overflow-hidden flex items-center justify-center">
                  {m.photoUrl ? <img src={m.photoUrl} alt="" className="w-full h-full object-cover"/> : <User size={16} className="text-muted-foreground"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.fullName}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.location ?? "—"}{m.defaultDayRate ? ` · $${m.defaultDayRate}/day` : ""}</div>
                </div>
                <Btn variant="primary" size="sm" disabled={submittingId===m.id} onClick={()=>handleAdd(m.id)}>
                  {submittingId===m.id ? "Adding…" : "Add"}
                </Btn>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Real, per-campaign shoot schedule (shoot_days, migration 0032) — the
// UI never collected structured dates (a plain text field defaulting to
// "Mon 07/14", no year), so date_label stays free text rather than
// inventing a real date column nothing here actually populates.
// Mock campaigns keep the two original demo rows and just don't save.
function DeliverablesTab({ realCampaignId }: { realCampaignId: string | null }) {
  const [days, setDays] = useState<ShootDay[]>([
    { eventDate: "2026-07-14", hours: "08:00–18:00", talentNote: "James Whitfield + Amara Diallo", description: "Hero shots — Studio 9, NYC" },
    { eventDate: "2026-07-15", hours: "09:00–17:00", talentNote: "Amara Diallo", description: "Close-up editorial" },
  ]);
  const [loading, setLoading] = useState(!!realCampaignId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!realCampaignId) { setLoading(false); return; }
    let active = true;
    fetchShootDays(realCampaignId).then(real => {
      if (!active) return;
      setDays(real); // a real campaign starts genuinely empty, not seeded with the mock rows
      setLoading(false);
    });
    return () => { active = false; };
  }, [realCampaignId]);

  function updateDay(i: number, patch: Partial<ShootDay>) {
    setDays(prev => prev.map((d,idx) => idx===i ? { ...d, ...patch } : d));
  }
  function addDay() {
    setDays(prev => [...prev, { eventDate: "", hours: "", talentNote: "", description: "" }]);
  }
  function removeDay(i: number) {
    setDays(prev => prev.filter((_,idx) => idx!==i));
  }
  async function handleSave() {
    if (!realCampaignId) return;
    setSaving(true);
    await saveShootDays(realCampaignId, days);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="flex-1 overflow-auto p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-heading text-sm">Schedule</h2>
          <Badge label="Editable" variant="info"/>
        </div>
        <div className="glass-subtle border rounded-md p-5 space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Shoot Schedule</div>
          {days.map((d,i)=>(
            <div key={d.id ?? i} className="border border-border rounded-md p-3 space-y-2 relative">
              <button onClick={()=>removeDay(i)} className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground cursor-pointer" title="Remove"><X size={12}/></button>
              <div className="grid grid-cols-2 gap-2 pr-5">
                <TextInput type="date" placeholder="Date" value={d.eventDate} onChange={e=>updateDay(i,{eventDate:e.target.value})}/>
                <TextInput placeholder="Hours" value={d.hours} onChange={e=>updateDay(i,{hours:e.target.value})}/>
              </div>
              <TextInput placeholder="Talent" value={d.talentNote} onChange={e=>updateDay(i,{talentNote:e.target.value})}/>
              <TextInput placeholder="Description" value={d.description} onChange={e=>updateDay(i,{description:e.target.value})}/>
            </div>
          ))}
          <button onClick={addDay} className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-4 py-2 w-full flex items-center justify-center gap-1 hover:border-foreground cursor-pointer">
            <Plus size={12}/> Add shoot day
          </button>
        </div>
        <div className="flex justify-end items-center gap-3">
          {saved && <span className="text-xs text-[#27AE60] flex items-center gap-1"><Check size={12}/> Saved</span>}
          <Btn variant="primary" icon={<Check size={13}/>} onClick={handleSave} disabled={saving || !realCampaignId}>{saving ? "Saving…" : "Save Schedule"}</Btn>
        </div>
        {!realCampaignId && <div className="text-xs text-muted-foreground text-right">This is a demo campaign — changes here aren't saved.</div>}
      </div>
    </div>
  );
}

const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = { draft: "Draft — Not Sent", awaiting_signature: "Awaiting Signature", fully_executed: "Fully Executed" };
const CONTRACT_STATUS_VARIANT: Record<ContractStatus, "active"|"pending"|"draft"> = { draft: "draft", awaiting_signature: "pending", fully_executed: "active" };

// Real contracts (migration 0032) generated off actually booked talent
// — the "Generate Contract" picker only ever offers models who are both
// really booked on this campaign and don't already have one, so a
// contract's day_rate always traces back to a real booking. No real
// e-signature exists yet, so "Mark Signed" just records that signature
// happened outside the system (paper, DocuSign, email) — an honest MVP
// posture, not a faked in-app sign flow.
function ContractsTab({ realCampaignId, talent, shim, profileId }: { realCampaignId: string | null; talent: Talent[]; shim: SubmissionShim; profileId?: string }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(!!realCampaignId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!realCampaignId) return;
    const real = await fetchCampaignContracts(realCampaignId);
    setContracts(real);
    setLoading(false);
  }
  useEffect(() => { if (realCampaignId) reload(); else setLoading(false); }, [realCampaignId]);

  const contractedModelIds = new Set(contracts.map(c=>c.modelId));
  const uncontractedBooked = talent.filter(t => t.stage==="booked" && !contractedModelIds.has(shim.get(t.id)?.modelId ?? ""));

  async function handleGenerate(t: Talent, sendImmediately: boolean) {
    const realModelId = shim.get(t.id)?.modelId;
    if (!realCampaignId || !realModelId || !profileId) return;
    setShowPicker(false);
    setError(null);
    const dayRate = Number(String(t.rate).replace(/[^0-9.]/g, "")) || 0;
    const { error: err } = await createContract({ campaignId: realCampaignId, modelId: realModelId, dayRate, agencyPct: DEFAULT_AGENCY_PCT/100, createdByProfileId: profileId, sendImmediately });
    if (err) { setError(err); return; }
    await reload();
  }
  async function handleSend(c: Contract) {
    if (!realCampaignId) return;
    setBusyId(c.id);
    setError(null);
    const { error: err } = await sendContract(c.id, realCampaignId);
    setBusyId(null);
    if (err) { setError(err); return; }
    await reload();
  }
  async function handleMarkSigned(c: Contract) {
    if (!realCampaignId) return;
    setBusyId(c.id);
    setError(null);
    const { error: err } = await markContractExecuted(c.id, realCampaignId, { contractNumber: c.contractNumber, modelId: c.modelId, dayRate: c.dayRate, agencyPct: c.agencyPct, territory: c.territory, duration: c.duration });
    setBusyId(null);
    if (err) { setError(err); return; }
    await reload();
  }

  if (!realCampaignId) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-heading text-sm">Contracts</h2>
            <Btn variant="primary" size="sm" icon={<Plus size={13}/>} disabled>Generate Contract</Btn>
          </div>
          {[["CF-2025-0841","James Whitfield","Fully Executed","$2,850","06/14/2025"],
            ["CF-2025-0842","Amara Diallo","Awaiting Signature","$2,300","06/14/2025"],
            ["CF-2025-0843","Zara Okafor","Draft — Not Sent","$1,960","06/15/2025"]].map(c=>(
            <div key={c[0]} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
              <FileCheck size={18} className="text-muted-foreground shrink-0"/>
              <div className="flex-1">
                <div className="text-sm font-semibold">{c[1]}</div>
                <div className="text-xs text-muted-foreground font-mono">{c[0]} · {c[4]}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm">{c[3]}</span>
                <Badge label={c[2]} variant={c[2]==="Fully Executed"?"active":c[2]==="Awaiting Signature"?"pending":"draft"}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex-1 overflow-auto p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-heading text-sm">Contracts</h2>
          <Btn variant="primary" size="sm" icon={<Plus size={13}/>} disabled={uncontractedBooked.length===0} onClick={()=>setShowPicker(true)}>Generate Contract</Btn>
        </div>
        {error && <div className="text-xs text-red-500">{error}</div>}
        {contracts.length===0 ? (
          <div className="glass-subtle border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">
            No contracts yet — approving a submission generates one automatically, or use Generate Contract for any already-booked model.
          </div>
        ) : contracts.map(c=>(
          <div key={c.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
            <FileCheck size={18} className="text-muted-foreground shrink-0"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{c.modelName}</div>
              <div className="text-xs text-muted-foreground font-mono">{c.contractNumber} · {new Date(c.createdAt).toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric",timeZone:"UTC"})}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-sm">${c.dayRate.toLocaleString()}</span>
              <Badge label={CONTRACT_STATUS_LABEL[c.status]} variant={CONTRACT_STATUS_VARIANT[c.status]}/>
              {c.status==="draft" && <Btn variant="outline" size="sm" disabled={busyId===c.id} onClick={()=>handleSend(c)}>{busyId===c.id?"Sending…":"Send"}</Btn>}
              {c.status==="awaiting_signature" && <Btn variant="outline" size="sm" disabled={busyId===c.id} onClick={()=>handleMarkSigned(c)}>{busyId===c.id?"Saving…":"Mark Signed"}</Btn>}
            </div>
          </div>
        ))}
      </div>

      {showPicker && (
        <Modal onClose={()=>setShowPicker(false)} maxWidth="max-w-sm">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="text-heading text-sm">Generate Contract</div>
            <button onClick={()=>setShowPicker(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
          </div>
          <div className="p-4 space-y-1 max-h-72 overflow-y-auto">
            {uncontractedBooked.map(t=>(
              <button key={t.id} onClick={()=>handleGenerate(t, false)}
                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-secondary cursor-pointer transition-colors flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.agency} · {t.rate}</div>
                </div>
                <Plus size={13} className="text-muted-foreground"/>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── CAMPAIGN PAYMENTS (spreadsheet: every outstanding person, à la carte) ─────

const OUTSTANDING_STATUS_BADGE: Record<OutstandingPayee["status"], { label: string; variant: "default"|"active"|"pending"|"draft" }> = {
  unpaid: { label: "Unpaid", variant: "draft" },
  pending: { label: "Awaiting confirmation", variant: "pending" },
  partial: { label: "Partially paid", variant: "pending" },
  paid: { label: "Paid & confirmed", variant: "active" },
};

// Pays each selected payee's remaining balance in one shot (one payment
// event per payee, same method/note applied to all) — the batch path.
// A second, partial, or follow-up payment against an already-open
// invoice happens from InvoiceDetailModal's own "Add Payment" instead,
// where a specific amount less than the full remaining balance makes
// sense one payee at a time.
// Paying one person at a time allows an editable amount, so a first
// payment can be a genuine partial installment (not just a full-balance
// shot) — the whole point of the payment trail. A bulk multi-select
// keeps paying each payee's full remaining balance, since one shared
// partial amount across several different people's different balances
// doesn't have a sensible single number to edit.
const MANUAL_METHODS = ["check", "wire", "cash"] as const;
function isManualMethod(m: PaymentMethod): m is typeof MANUAL_METHODS[number] {
  return (MANUAL_METHODS as readonly string[]).includes(m);
}
function isElectronicMethod(m: PaymentMethod): m is "ach" | "card" {
  return m === "ach" || m === "card";
}
// Mirrors create-invoice-payment's own rounding (grossCents first, fee
// rounded off that) so this preview never drifts a cent from what the
// server actually charges.
function previewFee(grossDollars: number, pct: number) {
  const grossCents = Math.round(grossDollars * 100);
  return Math.round(grossCents * pct / 100) / 100;
}

function RecordPaymentModal({ campaignId, payees, onClose, onDone }: {
  campaignId: string; payees: OutstandingPayee[]; onClose: () => void; onDone: () => void;
}) {
  const isSingle = payees.length === 1;
  const anyCrew = payees.some(p => p.bookingId == null);
  // ACH is DVURE's recommended default — cheaper for us to process, so
  // it's priced lower and steered toward everywhere a payment starts.
  // Crew have no booking identity for either electronic method yet, so
  // they land on the manual "Other" list instead.
  const [method, setMethod] = useState<PaymentMethod>(anyCrew ? "check" : "ach");
  const [otherOpen, setOtherOpen] = useState(anyCrew);
  const [note, setNote] = useState("");
  const [amountInput, setAmountInput] = useState(isSingle ? String(payees[0].remaining) : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<InvoicePaymentIntent | null>(null);
  const singleAmount = isSingle ? Number(amountInput) : 0;
  const total = isSingle ? singleAmount : payees.reduce((s,p)=>s+p.remaining, 0);
  const canSubmit = isSingle ? singleAmount > 0 && singleAmount <= payees[0].remaining : true;
  const electronic = isElectronicMethod(method);
  const feePct = method === "ach" ? PLATFORM_FEE_PCT_ACH : method === "card" ? PLATFORM_FEE_PCT_CARD : null;
  const feePreview = feePct != null ? previewFee(total, feePct) : 0;

  function selectMethod(m: PaymentMethod) {
    setMethod(m);
    // Electronic charges the real, server-recomputed booking amount —
    // never let the client assert a partial figure for either one, even
    // though manual methods allow editing a single payee's amount down.
    if (isElectronicMethod(m) && isSingle) setAmountInput(String(payees[0].remaining));
  }

  function selectElectronic(m: "ach" | "card") {
    setOtherOpen(false);
    selectMethod(m);
  }

  function openOther() {
    setOtherOpen(true);
    if (!isManualMethod(method)) selectMethod("check");
  }

  async function handleSubmit() {
    if (electronic) return; // electronic goes through handleStartElectronicPayment instead
    if (!canSubmit) { setError("Enter an amount up to the remaining balance."); return; }
    setSubmitting(true);
    setError(null);
    for (const p of payees) {
      const amount = isSingle ? singleAmount : p.remaining;
      const params: RecordInvoicePaymentParams = p.kind === "crew"
        ? { campaignId, invoiceTotal: p.totalAmount, amount, method: method as ManualPaymentMethod, referenceNote: note, payeeKind: "crew", crewPayeeId: p.crewPayeeId! }
        : p.kind === "independent-model"
        ? { campaignId, invoiceTotal: p.totalAmount, amount, method: method as ManualPaymentMethod, referenceNote: note, payeeKind: "independent-model", modelId: p.modelId! }
        : { campaignId, invoiceTotal: p.totalAmount, amount, method: method as ManualPaymentMethod, referenceNote: note, payeeKind: "agency", agencyOrgId: p.agencyOrgId! };
      const { error } = await recordInvoicePayment(params);
      if (error) { setSubmitting(false); setError(`${p.name}: ${error}`); return; }
    }
    setSubmitting(false);
    onDone();
  }

  async function handleStartElectronicPayment() {
    if (!isElectronicMethod(method)) return;
    setSubmitting(true);
    setError(null);
    const bookingIds = payees.map(p => p.bookingId).filter((id): id is string => id != null);
    const { intent: result, error: err } = await createInvoicePayment(bookingIds, method);
    setSubmitting(false);
    if (err || !result) { setError(err ?? "Couldn't start payment."); return; }
    setIntent(result);
  }

  return (
    <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-card border border-border rounded-md w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <div className="text-heading text-sm">{intent ? "Confirm payment" : "Record Payment"}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{payees.length} {payees.length===1?"person":"people"} · ${total.toLocaleString()} total</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={16}/></button>
        </div>
        {intent ? (
          <div className="p-5 overflow-y-auto">
            <CardPaymentStep
              clientSecret={intent.clientSecret}
              grossAmount={intent.grossAmount}
              platformFeePct={intent.platformFeePct}
              platformFeeAmount={intent.platformFeeAmount}
              totalAmount={intent.totalAmount}
              onBack={()=>setIntent(null)}
              onDone={onDone}
            />
          </div>
        ) : (
        <div className="p-5 space-y-4 overflow-y-auto">
          {isSingle ? (
            <div>
              <FieldLabel>Amount</FieldLabel>
              <div className="flex items-center gap-2">
                <input value={amountInput} onChange={e=>setAmountInput(e.target.value)} type="number" min="0" max={payees[0].remaining}
                  disabled={electronic}
                  className="w-32 bg-input-background border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-foreground disabled:opacity-60"/>
                <span className="text-xs text-muted-foreground">of ${payees[0].remaining.toLocaleString()} owed to {payees[0].name}</span>
              </div>
              {electronic && <div className="text-[10px] text-muted-foreground mt-1">{method==="ach" ? "ACH" : "Card"} payments are for the full remaining balance.</div>}
            </div>
          ) : (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {payees.map(p=>(
                <div key={p.key} className="flex items-center justify-between text-xs">
                  <span>{p.name} <span className="text-muted-foreground">· {p.subLabel}</span></span>
                  <span className="font-mono">${p.remaining.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          <div>
            <FieldLabel>Method</FieldLabel>
            <div className="flex gap-1.5">
              <button disabled={anyCrew} onClick={()=>selectElectronic("ach")}
                title={anyCrew ? "ACH isn't available for crew yet — use check, wire, or cash" : undefined}
                className={cx("text-xs px-3 py-1.5 rounded-full border transition-colors text-left",
                  anyCrew ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
                    : method==="ach" && !otherOpen ? "bg-foreground text-primary-foreground border-foreground cursor-pointer" : "border-border text-muted-foreground hover:border-foreground cursor-pointer"
                )}>
                ACH <span className="opacity-70">· {PLATFORM_FEE_PCT_ACH}% · Recommended</span>
              </button>
              <button disabled={anyCrew} onClick={()=>selectElectronic("card")}
                title={anyCrew ? "Card isn't available for crew yet — use check, wire, or cash" : undefined}
                className={cx("text-xs px-3 py-1.5 rounded-full border transition-colors",
                  anyCrew ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
                    : method==="card" && !otherOpen ? "bg-foreground text-primary-foreground border-foreground cursor-pointer" : "border-border text-muted-foreground hover:border-foreground cursor-pointer"
                )}>
                Card <span className="opacity-70">· {PLATFORM_FEE_PCT_CARD}%</span>
              </button>
              <button onClick={openOther}
                className={cx("text-xs px-3 py-1.5 rounded-full border transition-colors",
                  otherOpen ? "bg-foreground text-primary-foreground border-foreground cursor-pointer" : "border-border text-muted-foreground hover:border-foreground cursor-pointer"
                )}>Other ▾</button>
            </div>
            {method==="ach" && !otherOpen && (
              <div className="text-[10px] text-muted-foreground mt-1">6% − 0.5% ACH discount = 5.5%</div>
            )}
            {otherOpen && (
              <div className="flex gap-1.5 mt-1.5">
                {MANUAL_METHODS.map(m=>(
                  <button key={m} onClick={()=>selectMethod(m)}
                    className={cx("text-xs px-3 py-1.5 rounded-full border transition-colors capitalize",
                      method===m ? "bg-foreground text-primary-foreground border-foreground cursor-pointer" : "border-border text-muted-foreground hover:border-foreground cursor-pointer"
                    )}>{m}</button>
                ))}
              </div>
            )}
          </div>
          {!electronic && (
            <div>
              <FieldLabel>Reference note (optional)</FieldLabel>
              <input value={note} onChange={e=>setNote(e.target.value)}
                placeholder={method==="check" ? "Check #1042" : method==="wire" ? "Wire confirmation #" : "e.g. Handed to them in person"}
                className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground"/>
            </div>
          )}
          {electronic && feePct != null && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">${total.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">DVURE platform fee ({feePct}%)</span><span className="font-mono">${feePreview.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
              <div className="flex justify-between font-semibold pt-1 border-t border-border"><span>Total charge</span><span className="font-mono">${(total+feePreview).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
            </div>
          )}
          {error && <div className="text-xs text-red-500">{error}</div>}
          {electronic ? (
            <Btn variant="primary" fullWidth disabled={submitting} onClick={handleStartElectronicPayment}>
              {submitting ? "Preparing payment…" : `Continue to ${method==="ach" ? "ACH" : "card"} payment`}
            </Btn>
          ) : (
            <Btn variant="primary" fullWidth disabled={submitting || !canSubmit} onClick={handleSubmit}>
              {submitting ? "Recording…" : `Record Payment${payees.length>1?"s":""}`}
            </Btn>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

// The spreadsheet — every real person the brand owes money to on this
// campaign, one row each, selectable à la carte for check/wire/cash or
// card (0054) in one unified flow (RecordPaymentModal). A row with any
// payment history at all (pending/partial/paid) opens the full trail
// via InvoiceDetailModal — that's also where a follow-up or partial
// payment gets added, and where a still-pending one gets voided.
function CampaignPaymentsTab({ realCampaignId, payees, loading, reload }: {
  realCampaignId: string | null; payees: OutstandingPayee[]; loading: boolean; reload: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payModal, setPayModal] = useState<OutstandingPayee[] | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { setSelected(new Set()); }, [payees]);

  async function openDetail(invoiceId: string) {
    setDetailLoading(true);
    setDetailInvoice(await fetchInvoiceById(invoiceId));
    setDetailLoading(false);
  }

  if (!realCampaignId) {
    return <div className="flex-1 flex items-center justify-center p-6 text-sm text-muted-foreground text-center">This campaign predates real bookings and crew slots and has no saved project record to pay against — create a new campaign to use Payments.</div>;
  }
  if (loading) return <div className="flex-1 overflow-auto p-6 text-sm text-muted-foreground">Loading…</div>;

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const allPayableKeys = payees.filter(p=>p.remaining>0).map(p=>p.key);
  const allSelected = allPayableKeys.length > 0 && allPayableKeys.every(k=>selected.has(k));
  const payableSelected = payees.filter(p => selected.has(p.key) && p.remaining>0);
  const selectedTotal = payableSelected.reduce((s,p)=>s+p.remaining, 0);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl">
        <div className="mb-4">
          <h2 className="text-heading text-sm">Outstanding Payments</h2>
          <div className="text-xs text-muted-foreground mt-0.5">Every model and crew member owed money on this campaign — select who to pay by check, wire, or cash.</div>
        </div>
        {payees.length === 0 ? (
          <div className="glass-subtle border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">
            No one to pay yet — book a model or set a rate on a filled Crew role to see them here.
          </div>
        ) : (
          <div className="glass-subtle border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 w-8">
                    <input type="checkbox" checked={allSelected} onChange={()=>setSelected(allSelected ? new Set() : new Set(allPayableKeys))}/>
                  </th>
                  {["Name","Role","Amount","Status",""].map(h=><th key={h} className="px-4 py-2.5 text-left text-xs font-mono text-muted-foreground">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {payees.map(p=>(
                  <tr key={p.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      {p.remaining>0 && <input type="checkbox" checked={selected.has(p.key)} onChange={()=>toggle(p.key)}/>}
                    </td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.subLabel}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono">${p.totalAmount.toLocaleString()}</div>
                      {(p.acceptedAmount > 0 || p.pendingAmount > 0) && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {p.acceptedAmount > 0 && `$${p.acceptedAmount.toLocaleString()} paid`}
                          {p.acceptedAmount > 0 && p.pendingAmount > 0 && " · "}
                          {p.pendingAmount > 0 && `$${p.pendingAmount.toLocaleString()} pending`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3"><Badge label={OUTSTANDING_STATUS_BADGE[p.status].label} variant={OUTSTANDING_STATUS_BADGE[p.status].variant}/></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.remaining>0 && (
                          <button onClick={()=>setPayModal([p])} className="text-xs text-foreground hover:underline cursor-pointer">Record Payment</button>
                        )}
                        {p.invoiceId && (
                          <button onClick={()=>openDetail(p.invoiceId!)} className="text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer">View</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payableSelected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-primary-foreground rounded-full shadow-xl px-5 py-3 flex items-center gap-4 z-40">
          <span className="text-sm">{payableSelected.length} selected · ${selectedTotal.toLocaleString()}</span>
          <Btn variant="secondary" size="sm" onClick={()=>setPayModal(payableSelected)}>Record Payment</Btn>
        </div>
      )}

      {payModal && (
        <RecordPaymentModal campaignId={realCampaignId} payees={payModal} onClose={()=>setPayModal(null)} onDone={()=>{ setPayModal(null); reload(); }}/>
      )}

      {detailLoading && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50">
          <div className="text-sm text-primary-foreground">Loading…</div>
        </div>
      )}
      {detailInvoice && (
        <InvoiceDetailModal invoice={detailInvoice} onClose={()=>setDetailInvoice(null)} onChanged={async()=>{
          await reload();
          setDetailInvoice(await fetchInvoiceById(detailInvoice.id));
        }}/>
      )}
    </div>
  );
}

// ─── RUNWAY: LOOKS ───────────────────────────────────────────────────────────

function LooksScreen({ campaignId }: { campaignId: number }) {
  const [looks, setLooks] = useState<Look[]>(() => LOOKS.filter(l=>l.campaignId===campaignId));
  const [drawerId, setDrawerId] = useState<number|null>(null);
  const drawer = looks.find(l=>l.id===drawerId) ?? null;

  function addLook() {
    const nextNumber = looks.reduce((max,l)=>Math.max(max,l.number),0) + 1;
    const fresh: Look = { id:Date.now(), campaignId, number:nextNumber, garments:"", shoes:"", jewelry:"", accessories:"", stylistNotes:"", dressingNotes:"" };
    setLooks(prev=>[...prev, fresh]);
    setDrawerId(fresh.id);
  }

  function updateDrawer(patch: Partial<Look>) {
    if (drawerId==null) return;
    setLooks(prev => prev.map(l => l.id===drawerId ? { ...l, ...patch } : l));
  }

  const modelName = (id?: number) => SAMPLE_TALENT.find(t=>t.id===id)?.name ?? "Unassigned model";
  const crewName = (id?: number) => CREW.find(c=>c.id===id)?.name ?? "Unassigned";
  const crewByRole = (role: string) => CREW.filter(c=>c.role===role);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">Numbered looks for this show — garments, accessories, and who's assigned to execute each one.</p>
          <Btn variant="primary" size="sm" icon={<Plus size={12}/>} onClick={addLook}>Add Look</Btn>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...looks].sort((a,b)=>a.number-b.number).map(l=>(
            <button key={l.id} onClick={()=>setDrawerId(l.id)}
              className="text-left glass-subtle border rounded-md overflow-hidden hover:border-foreground/40 hover:shadow-md transition-all cursor-pointer">
              <XBox className="w-full h-32"/>
              <div className="p-3 space-y-1">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">Look {l.number}</div>
                <div className="text-sm font-semibold truncate">{l.garments || "Untitled look"}</div>
                <div className="text-xs text-muted-foreground truncate">{modelName(l.assignedModelId)}</div>
              </div>
            </button>
          ))}
          {looks.length===0 && (
            <div className="col-span-3 glass-subtle border border-dashed rounded-md p-10 text-center text-sm text-muted-foreground">No looks yet — add the first one.</div>
          )}
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-strong border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div className="text-heading text-sm">Look {drawer.number}</div>
              <button onClick={()=>setDrawerId(null)} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Garments" placeholder="e.g. Ivory wool coat" value={drawer.garments} onChange={e=>updateDrawer({garments:e.target.value})}/>
                <TextInput label="Shoes" placeholder="e.g. Black leather boot" value={drawer.shoes} onChange={e=>updateDrawer({shoes:e.target.value})}/>
                <TextInput label="Jewelry" placeholder="e.g. Silver cuff" value={drawer.jewelry} onChange={e=>updateDrawer({jewelry:e.target.value})}/>
                <TextInput label="Accessories" placeholder="e.g. Leather clutch" value={drawer.accessories} onChange={e=>updateDrawer({accessories:e.target.value})}/>
              </div>
              <div>
                <FieldLabel>Stylist Notes</FieldLabel>
                <textarea value={drawer.stylistNotes} onChange={e=>updateDrawer({stylistNotes:e.target.value})} rows={2} placeholder="Direction for styling this look…"
                  className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-foreground resize-none"/>
              </div>
              <div>
                <FieldLabel>Dressing Notes</FieldLabel>
                <textarea value={drawer.dressingNotes} onChange={e=>updateDrawer({dressingNotes:e.target.value})} rows={2} placeholder="Quick-change instructions for the dressing team…"
                  className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-foreground resize-none"/>
              </div>
              <div className="border-t border-border pt-4">
                <FieldLabel>Assignments</FieldLabel>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <div>
                    <div className="text-[10px] text-muted-foreground font-mono mb-1">Model</div>
                    <select value={drawer.assignedModelId ?? ""} onChange={e=>updateDrawer({assignedModelId: e.target.value ? Number(e.target.value) : undefined})}
                      className="w-full appearance-none bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground">
                      <option value="">Unassigned</option>
                      {SAMPLE_TALENT.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground font-mono mb-1">Hair</div>
                    <select value={drawer.assignedHairId ?? ""} onChange={e=>updateDrawer({assignedHairId: e.target.value ? Number(e.target.value) : undefined})}
                      className="w-full appearance-none bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground">
                      <option value="">Unassigned</option>
                      {crewByRole("hair").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground font-mono mb-1">Makeup</div>
                    <select value={drawer.assignedMakeupId ?? ""} onChange={e=>updateDrawer({assignedMakeupId: e.target.value ? Number(e.target.value) : undefined})}
                      className="w-full appearance-none bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground">
                      <option value="">Unassigned</option>
                      {crewByRole("makeup").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground font-mono mb-1">Dresser</div>
                    <select value={drawer.assignedDresserId ?? ""} onChange={e=>updateDrawer({assignedDresserId: e.target.value ? Number(e.target.value) : undefined})}
                      className="w-full appearance-none bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground">
                      <option value="">Unassigned</option>
                      {crewByRole("dresser").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono mt-3">
                  {modelName(drawer.assignedModelId)} · Hair: {crewName(drawer.assignedHairId)} · Makeup: {crewName(drawer.assignedMakeupId)} · Dresser: {crewName(drawer.assignedDresserId)}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border shrink-0">
              <Btn variant="primary" fullWidth onClick={()=>setDrawerId(null)}>Done</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CAMPAIGN WORKSPACE ─────────────────────────────────────────────────────

type SubmissionExtension = { agencies: string[]; until: string };

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
}

// Brands can grant agencies extra time past a campaign's original
// submission close date — e.g. a few strong late portfolios trickling in.
// Defaults to the shortest useful bump (1 day) and to everyone the brand
// already works with, since narrowing to specific agencies is the less
// common case.
function ExtendSubmissionModal({ campaign, onClose, onGrant }: {
  campaign: Campaign; onClose: () => void; onGrant: (ext: SubmissionExtension) => void;
}) {
  const [days, setDays] = useState(1);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>(PARTNERED_AGENCIES);
  const allSelected = selectedAgencies.length === PARTNERED_AGENCIES.length;
  const toggleAgency = (name: string) =>
    setSelectedAgencies(prev => prev.includes(name) ? prev.filter(a=>a!==name) : [...prev, name]);

  const until = addDays(campaign.submissionClose, days);

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="text-heading text-sm">Extend Submission Window</div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <FieldLabel>Extend by</FieldLabel>
          <div className="flex items-center gap-2">
            <input type="number" min={1} value={days} onChange={e=>setDays(Math.max(1, Number(e.target.value)||1))}
              className="w-20 border border-border rounded-md bg-input-background px-3 py-2 text-sm focus:outline-none focus:border-foreground"/>
            <span className="text-sm text-muted-foreground">day{days===1?"":"s"} — new close date {until}</span>
          </div>
        </div>
        <div>
          <FieldLabel>Agencies</FieldLabel>
          <div className="border border-border rounded-md divide-y divide-border">
            <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-secondary">
              <input type="checkbox" checked={allSelected}
                onChange={()=>setSelectedAgencies(allSelected ? [] : PARTNERED_AGENCIES)}
                className="accent-foreground"/>
              <span className="text-sm font-medium">Select All</span>
            </label>
            {PARTNERED_AGENCIES.map(name=>(
              <label key={name} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-secondary">
                <input type="checkbox" checked={selectedAgencies.includes(name)} onChange={()=>toggleAgency(name)} className="accent-foreground"/>
                <span className="text-sm">{name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <Btn variant="primary" disabled={selectedAgencies.length===0} onClick={()=>onGrant({ agencies:selectedAgencies, until })}>Grant Extension</Btn>
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}

// Reached by clicking a mother/boutique agency name from a candidate
// card. Deliberately minimal — real agency profiles (roster size,
// standing partnership history, etc.) are follow-up work; this just
// needs to exist as a real destination with a way to message them.
function AgencyProfileScreen({ agencyName, campaign, talent, onBack }: {
  agencyName: string; campaign: Campaign; talent: Talent[]; onBack: () => void;
}) {
  const submittedHere = talent.filter(t => t.agency===agencyName || t.motherAgency===agencyName || t.boutiqueAgency===agencyName);
  const isDistributed = (CAMPAIGN_AGENCIES[campaign.id] ?? []).includes(agencyName);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-xl space-y-5">
        <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer">
          <ChevronLeft size={12}/> Back to Submissions
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-secondary border border-border rounded-md flex items-center justify-center shrink-0">
            <span className="text-sm font-bold">{agencyName.split(" ").map(w=>w[0]).slice(0,2).join("")}</span>
          </div>
          <div>
            <div className="text-heading text-lg leading-tight flex items-center gap-1.5">{agencyName} <CountryFlag country={ORG_COUNTRY[agencyName]} className="text-base"/></div>
            <Badge label={isDistributed ? "Distributed on this campaign" : "Not distributed on this campaign"} variant={isDistributed ? "active" : "draft"}/>
          </div>
        </div>
        <div className="glass-subtle border rounded-md p-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Basic Info</div>
          {[["Primary Contact","Sophie Chen"],["Email","sophie@elitemodels.com"],["Phone","+1 212 555 0200"]].map(([k,v])=>(
            <div key={k} className="flex justify-between py-1.5 border-b border-border last:border-0 text-xs">
              <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
            </div>
          ))}
        </div>
        <div className="glass-subtle border rounded-md p-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">On {campaign.name}</div>
          <div className="text-2xl font-semibold tabular-nums">{submittedHere.length}</div>
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">model{submittedHere.length!==1?"s":""} submitted (as mother or boutique agency)</div>
        </div>
      </div>
    </div>
  );
}

function CampaignWorkspace({ campaigns, realIdShim, campaignId, section, onSection, onBack, onNewCampaign, onHome, onArchived }: {
  campaigns: Campaign[]; realIdShim: Map<number, string>; campaignId: number; section: CampaignSection; onSection: (s: CampaignSection) => void; onBack: () => void; onNewCampaign: () => void; onHome: () => void; onArchived?: () => void;
}) {
  const { profile, org } = useAuth();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string|null>(null);
  const [pendingManualCount, setPendingManualCount] = useState(0);
  const [talent, setTalent] = useState<Talent[]>(SAMPLE_TALENT);
  const [comments, setComments] = useState<CardComment[]>(CARD_COMMENTS);
  const [shim, setShim] = useState<SubmissionShim>(new Map());
  // Non-null once `campaignId` resolves to a real Supabase campaign via
  // realIdShim — only then do talent/comments reflect real data instead
  // of the SAMPLE_TALENT/CARD_COMMENTS mock.
  const [realCampaignId, setRealCampaignId] = useState<string | null>(null);
  const [contractModal, setContractModal] = useState<Talent|null>(null);
  const [extensions, setExtensions] = useState<SubmissionExtension[]>([]);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [viewingAgency, setViewingAgency] = useState<string|null>(null);
  const [focusAgency, setFocusAgency] = useState<string|null>(null);
  const [bookModal, setBookModal] = useState<{ ids: number[] } | null>(null);
  const [bookForm, setBookForm] = useState<Record<number, { dayRate: string; days: string; shootDate: string }>>({});
  const [bookSaving, setBookSaving] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  // Lifted out of CampaignPaymentsTab so the sidebar's Mark Complete &
  // Archive gate (due date passed + everyone paid) sees the same live
  // payment data the Payments tab itself does, without a second fetch
  // path drifting out of sync.
  const [payees, setPayees] = useState<OutstandingPayee[]>([]);
  const [payeesLoading, setPayeesLoading] = useState(true);

  const campaign = campaigns.find(c=>c.id===campaignId);

  async function refetchTalent(realId: string) {
    const { talent: realTalent, shim: realShim } = await fetchCampaignSubmissions(realId);
    setTalent(realTalent);
    setShim(realShim);
    setComments(await fetchSubmissionComments(realShim));
  }

  async function reloadPayees(realId: string | null) {
    if (!realId) { setPayeesLoading(false); return; }
    setPayeesLoading(true);
    setPayees(await fetchOutstandingPayees(realId));
    setPayeesLoading(false);
  }

  useEffect(() => {
    let active = true;
    const realId = realIdShim.get(campaignId) ?? null;
    setRealCampaignId(realId);
    reloadPayees(realId);
    if (!realId) return; // no real campaign for this id — mock data already seeded above
    (async () => {
      const { talent: realTalent, shim: realShim } = await fetchCampaignSubmissions(realId);
      if (!active) return;
      setTalent(realTalent);
      setShim(realShim);
      const realComments = await fetchSubmissionComments(realShim);
      if (!active) return;
      setComments(realComments);
    })();
    return () => { active = false; };
  }, [campaignId, realIdShim]);

  // Crew rates (Call Sheet) and manual/card payments can change what's
  // owed without going through this component's own mutation paths —
  // re-check the archive gate's inputs on every section switch so a
  // rate edited on Call Sheet, then viewed from elsewhere, isn't stale.
  useEffect(() => { reloadPayees(realCampaignId); }, [section]);

  if (!campaign) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground gap-2">
        Campaign not found.
        <button onClick={onHome} className="underline cursor-pointer">Back to campaigns</button>
      </div>
    );
  }

  async function openArchiveConfirm() {
    setArchiveError(null);
    setPendingManualCount(0);
    setShowArchiveConfirm(true);
    if (org && realCampaignId) {
      const invoices = await fetchInvoicesForBrand(org.id);
      const count = invoices
        .filter(inv => inv.campaignId === realCampaignId)
        .reduce((n, inv) => n + inv.payments.filter(p => p.status === "pending").length, 0);
      setPendingManualCount(count);
    }
  }

  async function handleArchive() {
    if (!realCampaignId) return;
    setArchiving(true);
    setArchiveError(null);
    const { error } = await archiveCampaign(realCampaignId);
    setArchiving(false);
    if (error) { setArchiveError(error); return; }
    setShowArchiveConfirm(false);
    onArchived?.();
  }

  function persistingSetTalent(fn: (prev: Talent[]) => Talent[]) {
    setTalent(prev => {
      const next = fn(prev);
      if (realCampaignId) {
        for (const t of next) {
          const prevT = prev.find(p => p.id === t.id);
          if (prevT && prevT.stage !== t.stage) {
            const entry = shim.get(t.id);
            if (entry) updateSubmissionStage(entry.submissionId, t.stage, { reviewedByProfileId: profile?.id });
          }
        }
      }
      return next;
    });
  }

  function parseRateDefault(rate: string): string {
    const n = parseInt(rate.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? String(n) : "";
  }

  // Fires from the "Contract Generated" modal at approval time — before
  // a real booking necessarily exists yet, which is why contracts key
  // off model_id directly rather than requiring a booking_id.
  async function generateContractFor(t: Talent, sendImmediately: boolean) {
    if (!realCampaignId || !profile) return; // mock campaign — nothing real to persist
    const realModelId = shim.get(t.id)?.modelId;
    if (!realModelId) return;
    const dayRate = Number(String(t.rate).replace(/[^0-9.]/g, "")) || 0;
    await createContract({ campaignId: realCampaignId, modelId: realModelId, dayRate, agencyPct: DEFAULT_AGENCY_PCT / 100, createdByProfileId: profile.id, sendImmediately });
  }

  function openBookModal(ids: number[]) {
    const today = new Date().toISOString().slice(0, 10);
    const form: Record<number, { dayRate: string; days: string; shootDate: string }> = {};
    for (const id of ids) {
      const t = talent.find(x => x.id === id);
      form[id] = { dayRate: parseRateDefault(t?.rate ?? ""), days: "1", shootDate: today };
    }
    setBookForm(form);
    setBookError(null);
    setBookModal({ ids });
  }

  async function confirmBook() {
    if (!bookModal) return;
    setBookSaving(true);
    setBookError(null);

    if (realCampaignId && org) {
      for (const id of bookModal.ids) {
        const entry = shim.get(id);
        const f = bookForm[id];
        if (!entry || !f) continue;
        const dayRate = Number(f.dayRate);
        const days = Number(f.days);
        if (!dayRate || !days || !f.shootDate) {
          setBookSaving(false);
          setBookError("Every model needs a day rate, days, and shoot date.");
          return;
        }
        const { error } = await createBooking({
          campaignId: realCampaignId,
          submissionId: entry.submissionId,
          brandOrgId: org.id,
          agencyOrgId: entry.agencyOrgId,
          modelId: entry.modelId,
          dayRate, days,
          shootDate: f.shootDate,
        });
        if (error) {
          setBookSaving(false);
          setBookError(error);
          return;
        }
      }
    }

    const ids = bookModal.ids;
    persistingSetTalent(prev => prev.map(t => ids.includes(t.id) ? { ...t, stage: "booked" as SubmissionStage } : t));
    setBookSaving(false);
    setBookModal(null);
    // A fresh booking is a new unpaid payee — refresh so the archive
    // gate (due date passed + everyone paid) doesn't stay stale and
    // show Mark Complete & Archive as available when it no longer is.
    reloadPayees(realCampaignId);
  }

  function handlePostComment(talentId: number, text: string) {
    const author = profile?.fullName ?? "";
    const authorOrg = org?.name ?? "";
    if (realCampaignId) {
      const entry = shim.get(talentId);
      if (entry && profile && org) {
        insertSubmissionComment(entry.submissionId, profile.id, org.id, text).then(({ error }) => {
          if (!error) setComments(prev => [...prev, { id: Date.now(), talentId, author, org: authorOrg, text, ts: "Now" }]);
        });
      }
      return;
    }
    setComments(prev => [...prev, { id: Date.now(), talentId, author, org: authorOrg, text, ts: "Now" }]);
  }
  // Only an extension covering every partnered agency moves the
  // campaign-wide Open/Closed indicator — partial extensions stay listed
  // per-agency instead of overstating what's actually open to everyone.
  const fullExtensionUntil = extensions
    .filter(e=>e.agencies.length===PARTNERED_AGENCIES.length)
    .reduce((latest,e)=> !latest || new Date(e.until)>new Date(latest) ? e.until : latest, "" as string);

  const counts: Record<string,number> = {
    submitted: talent.filter(t=>t.stage==="submitted").length,
    approved:  talent.filter(t=>t.stage==="approved").length,
    booked:    talent.filter(t=>t.stage==="booked").length,
    rejected:  talent.filter(t=>t.stage==="rejected").length,
  };

  const sectionLabel = campaignNavFor(campaign.type).find(n=>n.id===section)?.label ?? "";
  // Mark Complete & Archive only becomes available once the shoot date
  // has passed AND every payee on this campaign is fully paid — it's a
  // live derived value (not a one-time check), so it appears the moment
  // the later of those two conditions becomes true, e.g. right after the
  // final payment is confirmed. Dismissing the confirm modal doesn't
  // hide it again; visibility is driven purely by this data, not by
  // whether the user already saw the modal once.
  const dueDatePassed = !!campaign.dueDateISO && new Date(campaign.dueDateISO) < new Date();
  const allPaid = !payeesLoading && payees.every(p => p.status === "paid");
  const canArchive = dueDatePassed && allPaid;

  return (
    <>
      <CampaignSidebar campaign={campaign} section={section} onSection={onSection} onBack={onBack} onNewCampaign={onNewCampaign} onHome={onHome} counts={counts} fullExtensionUntil={fullExtensionUntil||undefined} isReal={!!realCampaignId} canArchive={canArchive} onArchive={openArchiveConfirm}/>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TopBar title={viewingAgency ?? sectionLabel} sub={campaign.name}
          actions={viewingAgency ? <Btn variant="primary" size="sm" icon={<Send size={13}/>}
            onClick={()=>{ setViewingAgency(null); setFocusAgency(viewingAgency); onSection("collaboration"); }}>Message Agency</Btn> : undefined}/>
        <div className="flex-1 min-h-0 overflow-hidden">
          {viewingAgency ? (
            <AgencyProfileScreen agencyName={viewingAgency} campaign={campaign} talent={talent} onBack={()=>setViewingAgency(null)}/>
          ) : (<>

          {section==="overview" && (
            <div className="h-full overflow-auto p-6">
              <div className="max-w-3xl space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  {[["Talent",counts.submitted],["Selections",counts.approved],["Confirmed",counts.booked]].map(([l,v])=>(
                    <div key={String(l)} className={cx("border rounded-md p-3 text-center cursor-pointer hover:border-foreground/40", String(l)==="Confirmed"&&Number(v)>0?"bg-foreground border-foreground":"glass-subtle")} onClick={()=>onSection("moodboard")}>
                      <div className={cx("text-xl font-semibold tabular-nums", String(l)==="Confirmed"&&Number(v)>0?"text-primary-foreground":"")}>{String(v)}</div>
                      <div className={cx("text-[10px] font-mono mt-0.5", String(l)==="Confirmed"&&Number(v)>0?"text-primary-foreground/70":"text-muted-foreground")}>{String(l)}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-subtle border rounded-md p-4">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Campaign Details</div>
                    {[["Type","Editorial"],["Budget","$800–$1,200/day"],["Dates","07/14–07/16/2025"],["Location","Studio 9, New York"],["Talent needed","3"],["Status","Active"]].map(([k,v])=>(
                      <div key={k} className="flex justify-between py-1.5 border-b border-border last:border-0 text-xs">
                        <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="glass-subtle border rounded-md p-4">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Campaign Budget</div>
                    {[["Total budget","$18,000"],["Committed","$5,150"],["Remaining","$12,850"]].map(([k,v])=>(
                      <div key={k} className="flex justify-between py-1.5 border-b border-border last:border-0 text-xs">
                        <span className="text-muted-foreground">{k}</span><span className="font-mono font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-subtle border rounded-md p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Talent Submission Window</div>
                    <Btn variant="outline" size="sm" onClick={()=>setShowExtendModal(true)}>Extend Submission Window</Btn>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border text-xs">
                    <span className="text-muted-foreground">Window</span>
                    <span className="font-medium">{campaign.submissionOpen} – {campaign.submissionClose}</span>
                  </div>
                  {extensions.length===0 ? (
                    <div className="text-xs text-muted-foreground pt-2">No extensions granted yet.</div>
                  ) : extensions.map((ext,i)=>(
                    <div key={i} className="flex justify-between py-1.5 border-b border-border last:border-0 text-xs">
                      <span className="text-muted-foreground">
                        {ext.agencies.length===PARTNERED_AGENCIES.length ? "All agencies" : ext.agencies.join(", ")}
                      </span>
                      <span className="font-medium">Extended to {ext.until}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section==="moodboard" && <Moodboard talent={talent} setTalent={persistingSetTalent} comments={comments} onPostComment={handlePostComment} onContractPrompt={t=>setContractModal(t)} onViewAgency={setViewingAgency} onBook={openBookModal} realCampaignId={realCampaignId} onIndependentAdded={()=>{ if (realCampaignId) refetchTalent(realCampaignId); }}/>}


          {section==="crew" && (
            realCampaignId
              ? <CrewTab campaignId={realCampaignId} campaignName={campaign.name}/>
              : <div className="flex-1 flex items-center justify-center p-6 text-sm text-muted-foreground text-center">This campaign predates Crew and has no saved project record to attach roles to — create a new campaign to use Crew.</div>
          )}

          {section==="call-sheet" && (
            realCampaignId
              ? <CallSheet campaignId={realCampaignId} campaignName={campaign.name}/>
              : <div className="flex-1 flex items-center justify-center p-6 text-sm text-muted-foreground text-center">This campaign predates Call Sheet and has no saved project record to attach roles to — create a new campaign to use Call Sheet.</div>
          )}

          {section==="looks" && <LooksScreen campaignId={campaign.id}/>}

          {section==="requirements" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-heading text-sm">Requirements</h2>
                  <Badge label="Editable" variant="info"/>
                </div>
                <div className="glass-subtle border rounded-md p-5 space-y-4">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Talent Requirements</div>
                  <div className="grid grid-cols-2 gap-4">
                    <TextInput label="Models needed" placeholder="e.g. 3" defaultValue="3"/>
                    <FSelect label="Gender" options={["Female","Male","Non-binary","Any"]}/>
                    <TextInput label="Age range" placeholder="e.g. 22–30" defaultValue="22–30"/>
                    <TextInput label="Height range" placeholder={`e.g. 5'8"–6'0"`} defaultValue={`5'8"–6'0"`}/>
                    <TextInput label="Categories" placeholder="e.g. Editorial, Runway" defaultValue="Editorial, Runway"/>
                    <TextInput label="Experience" placeholder="e.g. 5+ years" defaultValue="5+ years"/>
                  </div>
                </div>
                <div className="glass-subtle border rounded-md p-5">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Campaign Brief</div>
                  <Textarea placeholder="Campaign brief…" defaultValue="AW25 editorial campaign focusing on architectural minimalism." rows={5}/>
                </div>
                <div className="flex justify-end"><Btn variant="primary" icon={<Check size={13}/>}>Save Requirements</Btn></div>
              </div>
            </div>
          )}

          {section==="deliverables" && <DeliverablesTab realCampaignId={realCampaignId}/>}

          {section==="contracts" && <ContractsTab realCampaignId={realCampaignId} talent={talent} shim={shim} profileId={profile?.id}/>}

          {section==="payments" && <CampaignPaymentsTab realCampaignId={realCampaignId} payees={payees} loading={payeesLoading} reload={()=>reloadPayees(realCampaignId)}/>}

          {section==="activity" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl space-y-1">
                {ACTIVITY_EVENTS.map(e=>(
                  <div key={e.id} className="flex gap-3 pb-3 border-b border-border last:border-0">
                    <div className={cx("w-1.5 h-1.5 rounded-full mt-2 shrink-0", e.system?"bg-muted-foreground":"bg-foreground")}/>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold">{e.type}</span>
                        <span className="text-xs text-muted-foreground font-mono">{e.ts}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{e.detail}</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{e.actor}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section==="collaboration" && <CollaborationTab campaign={campaign} focusAgency={focusAgency} onFocusAgencyHandled={()=>setFocusAgency(null)}/>}

          {section==="users" && <UsersTab orgId={org?.id}/>}
          </>)}
        </div>
      </div>

      {contractModal && (
        <ContractModal talent={contractModal}
          onSend={async ()=>{ await generateContractFor(contractModal, true); setContractModal(null); }}
          onLater={async ()=>{ await generateContractFor(contractModal, false); setContractModal(null); }}/>
      )}
      {bookModal && (
        <Modal onClose={()=>{ if (!bookSaving) setBookModal(null); }} maxWidth="max-w-md">
          <div className="p-6 space-y-4">
            <div>
              <div className="text-heading text-lg">Confirm booking</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Day rate, days, and shoot date for {bookModal.ids.length === 1 ? "this model" : `these ${bookModal.ids.length} models`}.{" "}
                {(() => {
                  const selectedTalent = bookModal.ids.map(id => talent.find(t => t.id === id)).filter((t): t is Talent => !!t);
                  const hasIndependent = selectedTalent.some(t => t.agency === "Independent");
                  const hasRepped = selectedTalent.some(t => t.agency !== "Independent");
                  const feeRange = `${PLATFORM_FEE_PCT_ACH}–${PLATFORM_FEE_PCT_CARD}% depending on how they pay`;
                  if (hasIndependent && !hasRepped) return `No agency in the middle — just DVURE's platform fee (${feeRange}).`;
                  if (hasIndependent && hasRepped) return `Repped models use DVURE's standard agency split (${DEFAULT_AGENCY_PCT}%) plus the platform fee (${feeRange}); independent models pay only the platform fee.`;
                  return `Agency split is DVURE's standard ${DEFAULT_AGENCY_PCT}%, plus the platform fee (${feeRange}).`;
                })()}
              </div>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {bookModal.ids.map(id => {
                const t = talent.find(x => x.id === id);
                const f = bookForm[id] ?? { dayRate: "", days: "1", shootDate: "" };
                return (
                  <div key={id} className="border border-border rounded-md p-3 space-y-2">
                    <div className="text-sm font-medium">{t?.name ?? "Model"}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <FieldLabel>Day rate</FieldLabel>
                        <input type="number" value={f.dayRate} onChange={e=>setBookForm(prev=>({ ...prev, [id]: { ...f, dayRate: e.target.value } }))}
                          placeholder="950" className="w-full bg-input-background border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-foreground"/>
                      </div>
                      <div>
                        <FieldLabel>Days</FieldLabel>
                        <input type="number" value={f.days} onChange={e=>setBookForm(prev=>({ ...prev, [id]: { ...f, days: e.target.value } }))}
                          placeholder="1" className="w-full bg-input-background border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-foreground"/>
                      </div>
                      <div>
                        <FieldLabel>Shoot date</FieldLabel>
                        <input type="date" value={f.shootDate} onChange={e=>setBookForm(prev=>({ ...prev, [id]: { ...f, shootDate: e.target.value } }))}
                          className="w-full bg-input-background border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-foreground"/>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {bookError && <div className="flex items-center gap-1.5 text-xs text-red-500"><AlertCircle size={12}/> {bookError}</div>}
            <div className="flex items-center gap-2">
              <Btn variant="secondary" onClick={()=>setBookModal(null)} disabled={bookSaving}>Cancel</Btn>
              <Btn variant="primary" fullWidth onClick={confirmBook} disabled={bookSaving}>{bookSaving ? "Booking…" : "Confirm booking"}</Btn>
            </div>
          </div>
        </Modal>
      )}
      {showExtendModal && (
        <ExtendSubmissionModal campaign={campaign} onClose={()=>setShowExtendModal(false)}
          onGrant={ext=>{ setExtensions(prev=>[...prev, ext]); setShowExtendModal(false); }}/>
      )}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-card border border-border rounded-md w-96 p-6 shadow-xl">
            <div className="text-sm font-semibold mb-1">Mark "{campaign.name}" complete & archive?</div>
            <div className="text-xs text-muted-foreground mb-4">
              This moves the campaign to Archived. It stays visible there — this isn't permanent deletion.
            </div>
            {pendingManualCount > 0 && (
              <div className="flex items-start gap-2 text-xs text-[#D4A017] bg-[#D4A017]/10 border border-[#D4A017]/30 rounded-md px-3 py-2.5 mb-4">
                <AlertCircle size={13} className="mt-0.5 shrink-0"/>
                <span>{pendingManualCount} check/wire/cash payment{pendingManualCount===1?"":"s"} on this campaign {pendingManualCount===1?"is":"are"} still awaiting confirmation from the recipient. You can still archive — just make sure that's intentional.</span>
              </div>
            )}
            {archiveError && <div className="text-xs text-red-500 mb-4">{archiveError}</div>}
            <div className="flex gap-2">
              <Btn variant="primary" fullWidth disabled={archiving} onClick={handleArchive}>{archiving ? "Archiving…" : "Mark Complete & Archive"}</Btn>
              <Btn variant="outline" fullWidth onClick={()=>setShowArchiveConfirm(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── COLLABORATION ───────────────────────────────────────────────────────────

type CollabScope = "internal" | "agency" | "broadcast";

// Every agency distributed on a campaign gets its own private thread with
// the brand — two agencies never see each other's messages. Models get
// read-only access to their own agency's thread elsewhere in the app.
// The one exception is the Blast thread: a dedicated top-of-list thread
// that posts the same message into every agency's thread at once, for
// logistics changes (call time, location) that need to reach everyone
// without opening up cross-agency visibility for normal conversation.
function CollaborationTab({ campaign, focusAgency, onFocusAgencyHandled }: {
  campaign: Campaign; focusAgency: string | null; onFocusAgencyHandled: () => void;
}) {
  const currentUser = useCurrentUser();
  const meName = currentUser?.name ?? "";
  const meOrg = currentUser?.org ?? "";
  const { org: accountOrg } = useAuth();
  const messagingGate = getAccessGate(accountOrg);
  const agencies = CAMPAIGN_AGENCIES[campaign.id] ?? [];
  const [scope, setScope] = useState<CollabScope>("internal");
  const [selectedAgency, setSelectedAgency] = useState(agencies[0] ?? "");
  const [threads, setThreads] = useState<Record<string, CampaignThreadMessage[]>>(
    () => CAMPAIGN_AGENCY_THREADS[campaign.id] ?? {}
  );
  const [broadcastMsgs, setBroadcastMsgs] = useState<CampaignThreadMessage[]>([]);
  const [internalMsgs, setInternalMsgs] = useState([
    { id:1, from:"Priya Anand", text:"Mood board direction is locked — sharing the deck before we brief the agencies.", ts:"Jun 18, 4:10 PM" },
    { id:2, from:"Marcus Webb", text:"Nice. Let's hold final budget sign-off until Priya confirms the number.", ts:"Jun 18, 4:22 PM" },
    { id:3, from:"Priya Anand", text:"Confirmed — $18,000 total, $5,150 committed so far.", ts:"Jun 18, 4:30 PM" },
  ]);
  const [input, setInput] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  function flashSent(label: string) {
    setSent(label);
    setTimeout(() => setSent(null), 3000);
  }

  useEffect(() => {
    if (focusAgency) {
      setScope("agency");
      setSelectedAgency(focusAgency);
      onFocusAgencyHandled();
    }
  }, [focusAgency]);

  const isInternal = scope === "internal";
  const isBroadcast = scope === "broadcast";
  const agencyMsgs = threads[selectedAgency] ?? [];
  const displayMsgs = isInternal ? internalMsgs : isBroadcast ? broadcastMsgs : agencyMsgs;

  function send() {
    if (!input.trim() || messagingGate.gated) return;
    if (isInternal) {
      setInternalMsgs(p=>[...p,{ id:Date.now(), from:meName, text:input, ts:"Now" }]);
      flashSent("Message sent");
    } else if (isBroadcast) {
      const text = input;
      setBroadcastMsgs(p=>[...p, { id:Date.now(), from:meName, fromOrg:meOrg, text, ts:"Now", broadcast:true }]);
      setThreads(prev => {
        const next = { ...prev };
        for (const a of agencies) {
          next[a] = [...(next[a]??[]), { id:Date.now()+Math.random(), from:meName, fromOrg:meOrg, text, ts:"Now", broadcast:true }];
        }
        return next;
      });
      flashSent(`Sent to all ${agencies.length} agenc${agencies.length===1?"y":"ies"}`);
    } else {
      setThreads(p=>({ ...p, [selectedAgency]: [...(p[selectedAgency]??[]), { id:Date.now(), from:meName, fromOrg:meOrg, text:input, ts:"Now" }] }));
      flashSent("Message sent");
    }
    setInput("");
  }

  return (
    <div className="h-full flex min-h-0 relative">
      <div className="w-48 shrink-0 border-r border-border overflow-y-auto">
        <button onClick={()=>setScope("broadcast")}
          className={cx("w-full flex items-center gap-1.5 px-4 py-3 text-xs font-medium text-left border-b border-border transition-colors",
            isBroadcast?"bg-secondary text-foreground":"text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}>
          <Megaphone size={11}/> All Agencies
        </button>
        <button onClick={()=>setScope("internal")}
          className={cx("w-full flex items-center gap-1.5 px-4 py-3 text-xs font-medium text-left border-b border-border transition-colors",
            isInternal?"bg-secondary text-foreground":"text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}>
          <Lock size={11}/> Brand Team
        </button>
        <div className="px-4 py-2 text-[9px] font-mono text-muted-foreground uppercase tracking-wider border-b border-border">Agencies</div>
        {agencies.length===0 && <div className="px-4 py-3 text-[10px] text-muted-foreground">No agencies distributed yet</div>}
        {agencies.map(a=>(
          <button key={a} onClick={()=>{ setScope("agency"); setSelectedAgency(a); }}
            className={cx("w-full flex items-center gap-1.5 px-4 py-3 text-xs font-medium text-left border-b border-border transition-colors",
              scope==="agency" && selectedAgency===a?"bg-secondary text-foreground":"text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}>
            <Globe size={11} className="shrink-0"/> <span className="truncate">{a}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-2.5 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <div className="text-xs font-semibold">{isInternal ? `${meOrg} — Internal` : isBroadcast ? `${campaign.name} — All Agencies` : `${campaign.name} — ${selectedAgency}`}</div>
            <div className="text-[10px] text-muted-foreground">
              {isInternal ? `Visible only to ${meOrg}` : isBroadcast ? `Delivered into every distributed agency's own thread at once — ${agencies.length} agenc${agencies.length===1?"y":"ies"} on this campaign` : `Private to ${meOrg} + ${selectedAgency} — no other agency can see this`}
            </div>
          </div>
          <Badge label={isInternal ? "Internal" : isBroadcast ? "Blast" : "Private thread"} variant={isInternal ? "draft" : isBroadcast ? "warning" : "info"}/>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {displayMsgs.length===0 && (
            <div className="text-xs text-muted-foreground italic">{isBroadcast ? "No updates sent to all agencies yet." : "No messages yet."}</div>
          )}
          {displayMsgs.map(m => {
            const isMe = m.from === meName;
            return (
              <div key={m.id} className={cx("flex flex-col gap-1", isMe && "items-end")}>
                {"broadcast" in m && m.broadcast && !isBroadcast && (
                  <div className="text-[9px] font-mono uppercase tracking-wide text-urgent mb-0.5">Update sent to all agencies</div>
                )}
                <div className={cx("rounded-xl px-4 py-2.5 text-sm max-w-md leading-relaxed",
                  "broadcast" in m && m.broadcast ? "bg-urgent/10 border border-urgent text-foreground" : isMe ? "bg-foreground text-primary-foreground" : "bg-secondary text-foreground"
                )}>{m.text}</div>
                <div className={cx("flex items-center gap-2 text-[10px] text-muted-foreground", isMe && "flex-row-reverse")}>
                  <span className="font-medium">{isMe ? "Me" : m.from}</span>
                  {!isMe && "fromOrg" in m && <span>· {m.fromOrg}</span>}
                  <span className="font-mono">{m.ts}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-6 py-4 border-t glass shrink-0">
          {messagingGate.gated && (
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              <Lock size={12}/> {messagingGate.reason === "unverified" ? "Verification required before messages can be sent." : "Add a payment method to send messages."}
            </div>
          )}
          <div className="flex gap-3 items-end">
            <textarea value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); }}}
              placeholder={isInternal ? "Message your team…" : isBroadcast ? "Message all agencies at once…" : `Message ${selectedAgency}…`} rows={2}
              className="flex-1 bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none placeholder:text-muted-foreground"/>
            <button onClick={send} disabled={messagingGate.gated}
              className="p-2.5 bg-foreground hover:bg-foreground/90 text-primary-foreground rounded-md transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
              <Send size={15}/>
            </button>
          </div>
        </div>
      </div>

      {sent && (
        <div className="absolute bottom-6 right-6 glass-strong border rounded-lg shadow-xl px-5 py-4 flex items-center gap-3 z-30 animate-in fade-in slide-in-from-bottom-2">
          <div className="w-9 h-9 rounded-full bg-foreground text-primary-foreground flex items-center justify-center shrink-0">
            <Check size={16}/>
          </div>
          <div>
            <div className="text-sm font-semibold">{sent}</div>
            <div className="text-xs text-muted-foreground">Delivered just now</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ORG USERS ──────────────────────────────────────────────────────────────
// Brand's own team only — who's on the agency side of a campaign is that
// agency's own roster to manage, not something a brand has (or should
// have) access to edit. Membership is org-wide (org_memberships has no
// per-campaign scoping), so "Campaign Users" really means "your team,"
// same as before this was wired to real data.
const ACCESS_LEVEL_OPTIONS: AccessLevel[] = ["administrator", "enhanced", "basic"];

function UsersTab({ orgId }: { orgId: string | undefined }) {
  const { profile } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { title: string; accessLevel: AccessLevel }>>({});

  async function reload() {
    if (!orgId) { setLoading(false); return; }
    const [rows, invites] = await Promise.all([fetchOrgMembers(orgId), fetchPendingOrgInvites(orgId, "brand_staff")]);
    setMembers(rows);
    setPending(invites);
    setDrafts(Object.fromEntries(rows.map(m => [m.membershipId, { title: m.title ?? "", accessLevel: m.accessLevel }])));
    setLoading(false);
  }
  useEffect(() => { reload(); }, [orgId]);

  async function saveMember(membershipId: string) {
    const draft = drafts[membershipId];
    if (!draft) return;
    setSavingId(membershipId);
    await updateOrgMember(membershipId, draft);
    setSavingId(null);
    await reload();
  }

  if (loading) return <div className="flex-1 overflow-auto p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-heading text-sm">Campaign Users</h2>
          <div className="flex items-center gap-2">
            <Btn variant="outline" size="sm" icon={<Edit3 size={12}/>} onClick={()=>setEditMode(e=>!e)}>{editMode ? "Done" : "Edit"}</Btn>
            <Btn variant="primary" size="sm" icon={<Plus size={12}/>} onClick={()=>setShowInvite(true)}>Add</Btn>
          </div>
        </div>
        {members.length===0 && pending.length===0 ? (
          <div className="glass-subtle border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">No team members yet.</div>
        ) : (
          <div className="space-y-2">
            {members.map(m=>(
              <div key={m.membershipId} className="glass-subtle border rounded-md px-4 py-3 flex items-center gap-3">
                <UserAvatar name={m.name} className="w-7 h-7 text-[10px]"/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{m.name}</div>
                  {editMode ? (
                    <input value={drafts[m.membershipId]?.title ?? ""} placeholder="Title"
                      onChange={e=>setDrafts(d=>({ ...d, [m.membershipId]: { ...d[m.membershipId], title: e.target.value } }))}
                      className="mt-1 text-xs bg-input-background border border-border rounded px-2 py-1 w-full focus:outline-none focus:border-foreground placeholder:text-muted-foreground"/>
                  ) : (
                    <div className="text-xs text-muted-foreground">{m.title ?? "—"}</div>
                  )}
                </div>
                {editMode ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <select value={drafts[m.membershipId]?.accessLevel ?? m.accessLevel}
                      onChange={e=>setDrafts(d=>({ ...d, [m.membershipId]: { ...d[m.membershipId], accessLevel: e.target.value as AccessLevel } }))}
                      className="text-xs bg-input-background border border-border rounded px-2 py-1 focus:outline-none focus:border-foreground">
                      {ACCESS_LEVEL_OPTIONS.map(a=><option key={a} value={a}>{a}</option>)}
                    </select>
                    <Btn variant="outline" size="sm" disabled={savingId===m.membershipId} onClick={()=>saveMember(m.membershipId)}>{savingId===m.membershipId?"Saving…":"Save"}</Btn>
                  </div>
                ) : (
                  <Badge label={m.accessLevel} variant={ACCESS_BADGE[m.accessLevel]}/>
                )}
              </div>
            ))}
            {pending.map(p=>(
              <div key={p.id} className="glass-subtle border border-dashed rounded-md px-4 py-3 flex items-center gap-3">
                <UserAvatar name={p.email} className="w-7 h-7 text-[10px]"/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.email}</div>
                  <div className="text-xs text-muted-foreground">Invited — hasn't joined yet</div>
                </div>
                <Badge label="Pending" variant="draft"/>
              </div>
            ))}
          </div>
        )}
      </div>
      {showInvite && orgId && profile && (
        <InviteStaffModal orgId={orgId} invitedByProfileId={profile.id} onClose={()=>setShowInvite(false)} onInvited={reload}/>
      )}
    </div>
  );
}

function InviteStaffModal({ orgId, invitedByProfileId, onClose, onInvited }: {
  orgId: string; invitedByProfileId: string; onClose: () => void; onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSend() {
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    const { token, error: err } = await createOrgStaffInvite(orgId, invitedByProfileId, email.trim(), "brand_staff");
    setSending(false);
    if (err || !token) { setError(err ?? "Couldn't create invite."); return; }
    setLink(`${window.location.origin}/accept-invite/${token}`);
    onInvited();
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
        <div className="text-heading text-sm">Add a teammate</div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
      </div>
      {!link ? (
        <>
          <div className="p-5 space-y-3">
            <TextInput label="Email" placeholder="teammate@company.com" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>
            <div className="bg-secondary border border-border rounded-md px-3 py-2 text-xs text-muted-foreground">
              Creates a private sign-up link with basic access — raise their access level from here once they've joined. There's no automated email yet — share the link with them directly.
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
          <div className="text-xs text-muted-foreground">Share this link with your teammate — it lets them set their own password and join.</div>
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

// ─── CAMPAIGNS LIST (the landing screen — Dashboard was retired) ───────────────

// Icon components, not emoji — every icon in the app is a black silhouette
// outline (lucide or the hand-built ExclamationIcon), no emoji anywhere.
const CAMPAIGNS_ATTENTION = [
  { Icon:ExclamationIcon, msg:"AW25 Womenswear — due tomorrow. 14 submissions need review.", action:"Review now", urgent:true,  campaignId:1 },
  { Icon:Send,            msg:"1 unsent contract for Zara Okafor pending signature.",        action:"Send",       urgent:true,  campaignId:1 },
  { Icon:User,            msg:"SS25 Fragrance — 9 submissions awaiting first review.",       action:"Review",     urgent:false, campaignId:2 },
];

// Overdue actions — payment due dates and other time-sensitive items past
// their deadline. Feeds the per-section nav badges (Contracts, Payments) —
// each overdue item surfaces on the nav item it actually belongs to,
// rather than a single catch-all page. Mock only; real due-date tracking
// comes later.
const OVERDUE_ACTIONS = [
  { id:1, type:"Payment",  msg:"Payment due for Zara Okafor booking — 3 days overdue.",             campaignId:1, due:"Jul 12, 2026" },
  { id:2, type:"Contract", msg:"Unsent contract for Zara Okafor pending signature.",                 campaignId:1, due:"Jul 10, 2026" },
  { id:3, type:"Review",   msg:"AW25 Womenswear — 14 submissions need review before due date.",      campaignId:1, due:"Jul 16, 2026" },
  { id:4, type:"Payment",  msg:"Payment due for Ines Ferreira booking — 1 day overdue.",              campaignId:2, due:"Jul 14, 2026" },
];

function CampaignsList({ campaigns, openCampaign, onNewCampaign, updatedAt }: { campaigns: Campaign[]; openCampaign: (id: number) => void; onNewCampaign: () => void; updatedAt?: number }) {
  const currentUser = useCurrentUser();
  const [tab, setTab] = useState("active");
  const filtered = campaigns.filter(c=>c.status===(tab==="active"?"active":tab==="drafts"?"drafts":"archived"));
  // Assigned per the currently-visible set, not per campaign in isolation —
  // guarantees no two cards on screen at once ever show the same photo.
  // AW26 Runway Presentation (id 5) deliberately gets no cover — direct request.
  const covers = assignCampaignCovers(filtered.map(c=>c.id).filter(id=>id!==5));
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Projects" sub={`${currentUser?.org ?? ""} · Brand`} updatedAt={updatedAt}/>
      <div className="flex items-center justify-between gap-1 px-6 pt-5 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {["active","drafts","archived"].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={cx("px-4 py-2.5 text-sm capitalize border-b-2 -mb-px transition-colors cursor-pointer",
                tab===t?"border-foreground text-foreground font-medium":"border-transparent text-muted-foreground hover:text-foreground"
              )}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
          ))}
        </div>
        <button onClick={onNewCampaign}
          className="mb-2 flex items-center gap-2 px-4 py-2 bg-foreground text-primary-foreground text-sm font-medium rounded-md hover:bg-foreground/90 transition-colors cursor-pointer shrink-0">
          <Plus size={14}/> New Campaign
        </button>
      </div>
      <div className="flex-1 overflow-auto p-6 space-y-5">
        {filtered.length===0 ? (
          <div className="glass-subtle border border-dashed rounded-md p-10 text-center">
            <div className="text-sm text-muted-foreground mb-3">No {tab} campaigns</div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map(c=>(
              <div key={c.id} className="glass-subtle border rounded-lg overflow-hidden cursor-pointer hover:border-foreground/40 hover:shadow-md transition-all group" onClick={()=>openCampaign(c.id)}>
                {/* Cover — the brand's own view gets mood/editorial stock;
                    agencies/models see this brand's logo instead (see
                    BrandLogoBadge in AgencyApp's invitations list) so the
                    same campaign reads differently depending on who's
                    looking at it. */}
                <div className="relative aspect-[4/3] bg-secondary overflow-hidden">
                  {/* Natural color, deliberately — the app's own chrome is
                      black and white now, so whatever a brand picks for
                      their own cover is the only color on the page. */}
                  {(c.coverPhoto ?? covers.get(c.id)) && (
                    <img src={c.coverPhoto ?? covers.get(c.id)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                  )}
                  <div className="absolute top-2.5 left-2.5">
                    <Badge label={c.status==="archived"?"Archived":"Active"} variant={c.status==="archived"?"draft":"active"}/>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-sm font-semibold leading-snug">{c.name}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{c.type}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{currentUser?.org ?? ""}</div>
                  <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-border">
                    {([["Talent",c.submitted],["Selections",c.approved],["Confirmed",c.booked]] as [string,number][]).map(([l,v],i,arr)=>(
                      <div key={l} className={cx("text-center rounded-sm py-1.5", i===arr.length-1&&v>0?"bg-offwhite":"")}>
                        <div className={cx("text-base font-semibold tabular-nums", i===arr.length-1&&v>0?"text-offwhite-foreground":"")}>{v}</div>
                        <div className={cx("text-[8px] font-mono uppercase tracking-wide leading-tight", i===arr.length-1&&v>0?"text-offwhite-foreground/70":"text-muted-foreground")}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <div className={cx("text-[10px] font-mono", c.dueLabel?.includes("overdue") ? "font-bold text-[#C0392B]/80" : "text-muted-foreground")}>
                      {c.due ? `Due ${c.due}` : "Due —"}
                    </div>
                    <ChevronRight size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CREATE CAMPAIGN ──────────────────────────────────────────────────────────

const CAMPAIGN_TYPES = ["Campaign","Runway","Event","Other"];

function CreateCampaign({ onBack, onCreated }: { onBack: () => void; onCreated: (realId: string) => void }) {
  const { profile, org } = useAuth();
  const [step, setStep] = useState(1);
  const [genders, setGenders] = useState(["Female"]);
  const [cats, setCats] = useState(["Editorial"]);
  const [campaignType, setCampaignType] = useState("Campaign");
  const [customType, setCustomType] = useState("");
  const [name, setName] = useState("");
  const [shootStart, setShootStart] = useState("");
  const [submissionOpen, setSubmissionOpen] = useState("");
  const [submissionClose, setSubmissionClose] = useState("");
  const [talentNeeded, setTalentNeeded] = useState("3");
  const [budget, setBudget] = useState("");
  const [partneredAgencies, setPartneredAgencies] = useState<{ id: string; name: string }[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const toggle = (arr: string[], val: string, set: (a:string[])=>void) =>
    set(arr.includes(val)?arr.filter(v=>v!==val):[...arr,val]);
  const allAgenciesSelected = partneredAgencies.length > 0 && selectedAgencies.length === partneredAgencies.length;
  const STEPS = [{n:1,label:"Basics"},{n:2,label:"Talent"},{n:3,label:"Brief"},{n:4,label:"Publish"}];

  useEffect(() => {
    if (!org) return;
    fetchPartneredAgencies(org.id).then(agencies => {
      setPartneredAgencies(agencies);
      setSelectedAgencies(agencies.map(a => a.id));
    });
  }, [org?.id]);

  async function handleSaveDraft() {
    if (!org || !profile || !name.trim()) return;
    setSaving(true);
    setSaveError(null);
    const { id, error } = await createCampaign({
      brandOrgId: org.id,
      createdByProfileId: profile.id,
      name: name.trim(),
      type: campaignType as any,
      status: "drafts",
      dueDate: shootStart || undefined,
      submissionOpen: submissionOpen || undefined,
      submissionClose: submissionClose || undefined,
      talentNeeded: talentNeeded ? Number(talentNeeded) : undefined,
      budget: budget ? Number(budget) : undefined,
    });
    setSaving(false);
    if (error || !id) { setSaveError(error ?? "Couldn't save draft."); return; }
    onCreated(id);
  }

  async function handlePublish() {
    if (!org || !profile || !name.trim()) return;
    setSaving(true);
    setSaveError(null);
    const { id, error } = await createCampaign({
      brandOrgId: org.id,
      createdByProfileId: profile.id,
      name: name.trim(),
      type: campaignType as any,
      status: "active",
      dueDate: shootStart || undefined,
      submissionOpen: submissionOpen || undefined,
      submissionClose: submissionClose || undefined,
      talentNeeded: talentNeeded ? Number(talentNeeded) : undefined,
      budget: budget ? Number(budget) : undefined,
    });
    if (error || !id) { setSaving(false); setSaveError(error ?? "Couldn't publish campaign."); return; }
    const { error: distError } = await distributeCampaignToAgencies(id, selectedAgencies, profile.id);
    setSaving(false);
    if (distError) { setSaveError(distError); return; }
    onCreated(id);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="New Campaign" sub={`Step ${step} of 4`} actions={<Btn variant="ghost" size="sm" onClick={onBack}><X size={13}/> Discard</Btn>}/>
      <div className="glass border-b px-6 py-4 shrink-0">
        <div className="max-w-xl mx-auto flex items-start">
          {STEPS.map((s,i)=>(
            <div key={s.n} className="flex-1 flex flex-col items-center relative">
              {i<STEPS.length-1&&<div className={cx("absolute top-3.5 left-1/2 w-full h-px",s.n<step?"bg-foreground":"bg-border")}/>}
              <div className={cx("w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold z-10 border-2",
                s.n<step?"bg-foreground text-primary-foreground border-foreground":s.n===step?"bg-card text-foreground border-foreground":"bg-card text-muted-foreground border-border"
              )}>{s.n<step?<Check size={12}/>:s.n}</div>
              <div className={cx("text-xs mt-1.5",s.n===step?"font-medium":"text-muted-foreground")}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="max-w-xl mx-auto px-6 py-8 space-y-5">
          {step===1&&(<><div><h2 className="text-heading text-base mb-0.5">Campaign Basics</h2><p className="text-sm text-muted-foreground">Define the campaign and its timeline.</p></div>
            <div className="border-t border-border"/>
            <TextInput label="Campaign Name" placeholder="e.g. AW25 Womenswear Campaign" value={name} onChange={e=>setName(e.target.value)}/>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Type</FieldLabel>
                <div className="relative">
                  <select value={campaignType} onChange={e=>{ setCampaignType(e.target.value); if(e.target.value!=="Other") setCustomType(""); }}
                    className="w-full appearance-none bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground pr-8">
                    {CAMPAIGN_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"/>
                </div>
                {campaignType==="Other" && (
                  <div className="mt-2">
                    <TextInput placeholder="Describe the campaign type…" value={customType} onChange={e=>setCustomType(e.target.value)}/>
                  </div>
                )}
              </div>
              <TextInput label="Talent Needed" placeholder="e.g. 3" type="number" value={talentNeeded} onChange={e=>setTalentNeeded(e.target.value)}/>
              <TextInput label="Budget" placeholder="e.g. 18000" type="number" value={budget} onChange={e=>setBudget(e.target.value)}/>
              <TextInput label="Shoot Date" placeholder="MM/DD/YYYY" type="date" value={shootStart} onChange={e=>setShootStart(e.target.value)}/>
            </div>
            <TextInput label="Location" placeholder="City, state, or studio address"/>
            <div>
              <FieldLabel>Talent Submission Window</FieldLabel>
              <p className="text-xs text-muted-foreground mb-2">Agencies can only submit talent between these dates.</p>
              <div className="grid grid-cols-2 gap-4">
                <TextInput label="Opens" placeholder="MM/DD/YYYY" type="date" value={submissionOpen} onChange={e=>setSubmissionOpen(e.target.value)}/>
                <TextInput label="Closes" placeholder="MM/DD/YYYY" type="date" value={submissionClose} onChange={e=>setSubmissionClose(e.target.value)}/>
              </div>
            </div>
          </>)}
          {step===2&&(<><div><h2 className="text-heading text-base mb-0.5">Talent Requirements</h2><p className="text-sm text-muted-foreground">Agencies match their roster to these requirements.</p></div>
            <div className="border-t border-border"/>
            {/* Runway-specific show planning — other types keep the generic
                fields below for now; extend this pattern per type as those
                requirements get defined. */}
            {campaignType==="Runway" && (
              <div className="bg-secondary border border-border rounded-md p-4 space-y-4">
                <FieldLabel>Show Details</FieldLabel>
                <div className="grid grid-cols-2 gap-4">
                  <FSelect label="Season" options={["SS27","FW27","Resort","Couture"]}/>
                  <TextInput label="Venue" placeholder="e.g. Park Avenue Armory"/>
                  <TextInput label="Show Producer" placeholder="e.g. Bureau Betak"/>
                  <FSelect label="Time Zone" options={["ET","CT","MT","PT","GMT","CET"]}/>
                  <TextInput label="Show Date" placeholder="MM/DD/YYYY" type="date"/>
                  <TextInput label="Show Time" placeholder="HH:MM" type="time"/>
                </div>
              </div>
            )}
            <div><FieldLabel>Gender</FieldLabel><div className="flex flex-wrap gap-2">{["Female","Male","Non-binary","Any"].map(g=><Chip key={g} active={genders.includes(g)} onClick={()=>toggle(genders,g,setGenders)}>{g}</Chip>)}</div></div>
            <div className="grid grid-cols-2 gap-4"><FSelect label="Min Age" options={["18","20","22","25"]}/><FSelect label="Max Age" options={["No max","25","30","35","40"]}/></div>
            <div><FieldLabel>Categories</FieldLabel><div className="flex flex-wrap gap-2">{["Editorial","Runway","Beauty","Fitness","E-commerce","Luxury"].map(t=><Chip key={t} active={cats.includes(t)} onClick={()=>toggle(cats,t,setCats)}>{t}</Chip>)}</div></div>
          </>)}
          {step===3&&(<><div><h2 className="text-heading text-base mb-0.5">Creative Brief</h2><p className="text-sm text-muted-foreground">Shared with agencies and their talent.</p></div>
            <div className="border-t border-border"/>
            <Textarea label="Campaign Brief" placeholder="Describe the creative concept, mood, and aesthetic direction…" rows={5}/>
            <div className="grid grid-cols-2 gap-4">
              <FSelect label="Usage Territory" options={["United States","North America","Worldwide"]}/>
              <FSelect label="Duration" options={["6 months","1 year","2 years","Unlimited"]}/>
            </div>
          </>)}
          {step===4&&(<><div><h2 className="text-heading text-base mb-0.5">Review & Publish</h2><p className="text-sm text-muted-foreground">Distribute to agencies and open for submissions.</p></div>
            <div className="border-t border-border"/>
            <div className="bg-secondary border border-border rounded-md p-4">
              <div className="flex items-center justify-between mb-1">
                <FieldLabel>Distribute to partnered agencies</FieldLabel>
                <button onClick={()=>setSelectedAgencies(allAgenciesSelected?[]:partneredAgencies.map(a=>a.id))}
                  className="text-[10px] font-mono text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer">
                  {allAgenciesSelected?"Clear all":"Select all"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {partneredAgencies.map(a=>(
                  <Chip key={a.id} active={selectedAgencies.includes(a.id)} onClick={()=>toggle(selectedAgencies,a.id,setSelectedAgencies)}>{a.name}</Chip>
                ))}
              </div>
              {partneredAgencies.length===0 && <div className="text-xs text-muted-foreground mt-1">No partnered agencies yet.</div>}
              <div className="text-[10px] text-muted-foreground font-mono mt-2">{selectedAgencies.length} of {partneredAgencies.length} selected</div>
            </div>
            <div className="glass-subtle border rounded-md p-4 flex items-start gap-2.5">
              <AlertCircle size={13} className="text-muted-foreground mt-0.5 shrink-0"/>
              <div className="text-xs text-muted-foreground leading-relaxed">No payment is due until talent is booked.</div>
            </div>
          </>)}
          {saveError && <div className="text-xs text-red-500">{saveError}</div>}
          <div className="flex items-center justify-between pt-6 border-t border-border">
            <div className="flex gap-2">
              {step>1&&<Btn variant="outline" onClick={()=>setStep(step-1)}><ChevronLeft size={13}/> Back</Btn>}
              <Btn variant="ghost" size="sm" disabled={!name.trim() || saving} onClick={handleSaveDraft}>Save draft</Btn>
            </div>
            {step<4?<Btn variant="primary" disabled={!name.trim()} onClick={()=>setStep(step+1)}>Continue <ChevronRight size={13}/></Btn>
              :<Btn variant="primary" icon={<Check size={13}/>} disabled={!name.trim() || selectedAgencies.length===0 || saving} onClick={handlePublish}>{saving?"Publishing…":"Publish Campaign"}</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GLOBAL CONTRACTS ─────────────────────────────────────────────────────────

function GlobalContracts() {
  const currentUser = useCurrentUser();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Contracts" sub={`All contracts · ${currentUser?.org ?? ""}`} actions={<Btn variant="primary" size="sm" icon={<Plus size={13}/>}>Generate Contract</Btn>}/>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Active contracts" value="3" sub="2 awaiting signature"/>
          <Stat label="Unsent drafts"    value="1" sub="Action required" accent/>
          <Stat label="Executed"         value="8" sub="All time"/>
        </div>
        <div className="glass-subtle border rounded-md overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">All Contracts</span>
            <div className="flex items-center border border-border rounded-md bg-input-background px-3 gap-2 h-8">
              <Search size={13} className="text-muted-foreground"/>
              <input placeholder="Search…" className="text-xs bg-transparent focus:outline-none w-32 placeholder:text-muted-foreground"/>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30">{["Reference","Talent","Agency","Campaign","Value","Status","Actions"].map(h=><th key={h} className="px-4 py-2.5 text-left text-xs font-mono text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>
              {[["CF-2025-0841","James Whitfield","Vantage Model Mgmt.","AW25 Womenswear","$2,850","Fully Executed"],
                ["CF-2025-0842","Amara Diallo","Vantage Model Mgmt.","AW25 Womenswear","$2,300","Awaiting Signature"],
                ["CF-2025-0843","Zara Okafor","Vantage Model Mgmt.","AW25 Womenswear","$1,960","Draft — Not Sent"],
                ["CF-2025-0791","Mila Tran","Meridian Models","SS25 Fragrance","$1,100","Fully Executed"]].map((r,i)=>(
                <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary cursor-pointer">
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r[0]}</td>
                  <td className="px-4 py-3 font-medium">{r[1]}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r[2]}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r[3]}</td>
                  <td className="px-4 py-3 font-mono text-sm">{r[4]}</td>
                  <td className="px-4 py-3"><Badge label={r[5]} variant={r[5]==="Fully Executed"?"active":r[5]==="Awaiting Signature"?"pending":"draft"}/></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md" title="View"><Eye size={12}/></button>
                      <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md" title="PDF"><Download size={12}/></button>
                      {r[5]==="Draft — Not Sent"&&<button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md" title="Edit & Send"><Send size={12}/></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── GLOBAL PAYMENTS ──────────────────────────────────────────────────────────

function PaidStamp({ size = 120, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={animate ? "animate-bounce" : ""}>
      <circle cx="60" cy="60" r="56" stroke="#16a34a" strokeWidth="4" fill="none"/>
      <circle cx="60" cy="60" r="48" stroke="#16a34a" strokeWidth="2" fill="none"/>
      <rect x="4" y="42" width="112" height="14" fill="#16a34a" opacity="0.15"/>
      <rect x="4" y="64" width="112" height="14" fill="#16a34a" opacity="0.15"/>
      <text x="60" y="66" textAnchor="middle" fontSize="26" fontWeight="900" fill="#16a34a" fontFamily="serif" transform="rotate(-22 60 60)" letterSpacing="3">PAID</text>
      <line x1="10" y1="42" x2="110" y2="42" stroke="#16a34a" strokeWidth="3"/>
      <line x1="10" y1="78" x2="110" y2="78" stroke="#16a34a" strokeWidth="3"/>
    </svg>
  );
}

// Every real outcome a card/bank authorization can land on — designed as
// its own state rather than "declined" being an afterthought bolted onto
// the success path. Each has its own color, icon, and a next step that
// actually gets someone unblocked, not just an apology.
const MANUAL_METHOD_LABEL: Record<PaymentMethod, string> = { check: "Check", wire: "Wire", cash: "Cash", card: "Card", ach: "ACH" };

function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// The 4-step timeline every payment is drawn on — Initiated/Pending/
// Paid/Accepted — plus Voided as a distinct exception state that
// replaces the bar outright rather than sitting on it (a voided payment
// didn't "get partway to Accepted and stop," it's a different outcome).
// Card/ACH (once Stripe is live) reaches Paid and Accepted in the same
// instant a charge succeeds; a manual payment has no processor to
// confirm receipt, so it stays at Pending until the agency itself
// confirms, at which point Paid and Accepted land together too — see
// 0047's migration header for the full reasoning.
function PaymentTimeline({ payment }: { payment: InvoicePayment }) {
  if (payment.status === "voided") {
    return (
      <div className="flex items-center gap-2 text-xs">
        <XCircle size={13} className="text-[#C0392B] shrink-0"/>
        <span className="text-[#C0392B] font-medium">Voided</span>
        <span className="text-muted-foreground">before the agency confirmed it</span>
      </div>
    );
  }
  const steps: { label: string; reached: boolean; at: string | null }[] = [
    { label: "Initiated", reached: true, at: payment.createdAt },
    { label: "Pending",   reached: !!payment.pendingAt, at: payment.pendingAt },
    { label: "Paid",      reached: !!payment.acceptedAt, at: payment.acceptedAt },
    { label: "Accepted",  reached: !!payment.acceptedAt, at: payment.acceptedAt },
  ];
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1 flex-1">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={cx("w-2.5 h-2.5 rounded-full shrink-0", s.reached ? "bg-foreground" : "bg-border")} title={s.at ? fmtDateTime(s.at) : undefined}/>
            <span className={cx("text-[9px] font-mono uppercase tracking-wide whitespace-nowrap", s.reached ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
          </div>
          {i < steps.length - 1 && <div className={cx("h-px flex-1", steps[i+1].reached ? "bg-foreground" : "bg-border")}/>}
        </div>
      ))}
    </div>
  );
}

// The audit trail the void action promised — who recorded it, who
// confirmed or voided it, and when, spelled out rather than left to a
// tooltip.
function PaymentAuditTrail({ payment }: { payment: InvoicePayment }) {
  return (
    <div className="text-[10px] text-muted-foreground font-mono space-y-0.5">
      <div>Recorded {fmtDateTime(payment.createdAt)}</div>
      {payment.status === "accepted" && (
        <>
          <div>Confirmed by {payment.confirmedByName ?? "the agency"} · {fmtDateTime(payment.acceptedAt)}</div>
          {payment.signatureName && <div>Signed "{payment.signatureName}" · {fmtDateTime(payment.signatureCapturedAt)}</div>}
        </>
      )}
      {payment.status === "voided" && (
        <div>Voided by {payment.voidedByName ?? "—"} · {fmtDateTime(payment.voidedAt)} — "{payment.voidReason}"</div>
      )}
    </div>
  );
}

const INVOICE_STATUS_BADGE: Record<InvoiceStatus, { label: string; variant: "default"|"active"|"pending"|"draft" }> = {
  outstanding: { label: "Outstanding", variant: "draft" },
  partially_paid: { label: "Partially paid", variant: "pending" },
  paid: { label: "Paid", variant: "active" },
};

// The actual "trail" — every payment event ever recorded against one
// invoice, oldest first, each with its own timeline/audit trail and a
// void action while still pending. Shared by the spreadsheet (Payments
// tab) and the Invoices tab so a payee's balance reads identically no
// matter which screen it's opened from. Includes a lightweight "add a
// payment" control so a second, third... payment can be recorded
// against the same open balance without leaving this view.
function InvoiceDetailModal({ invoice, onClose, onChanged }: {
  invoice: Invoice; onClose: () => void; onChanged: () => void;
}) {
  const [voidTarget, setVoidTarget] = useState<InvoicePayment | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidSubmitting, setVoidSubmitting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addMethod, setAddMethod] = useState<ManualPaymentMethod>("check");
  const [addNote, setAddNote] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const committed = invoice.payments.filter(p => p.status !== "voided").reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, invoice.totalAmount - committed);

  async function handleVoidConfirm() {
    if (!voidTarget || !voidReason.trim()) return;
    setVoidSubmitting(true);
    const { error } = await voidInvoicePayment(voidTarget.id, voidReason.trim());
    setVoidSubmitting(false);
    if (error) return;
    setVoidTarget(null);
    setVoidReason("");
    onChanged();
  }

  async function handleAddPayment() {
    const amount = Number(addAmount);
    if (!(amount > 0)) { setAddError("Enter an amount."); return; }
    setAddSubmitting(true);
    setAddError(null);
    const params: RecordInvoicePaymentParams = invoice.payeeKind === "crew"
      ? { campaignId: invoice.campaignId, invoiceTotal: invoice.totalAmount, amount, method: addMethod, referenceNote: addNote, payeeKind: "crew", crewPayeeId: invoice.payeeId }
      : invoice.payeeKind === "independent-model"
      ? { campaignId: invoice.campaignId, invoiceTotal: invoice.totalAmount, amount, method: addMethod, referenceNote: addNote, payeeKind: "independent-model", modelId: invoice.payeeId }
      : { campaignId: invoice.campaignId, invoiceTotal: invoice.totalAmount, amount, method: addMethod, referenceNote: addNote, payeeKind: "agency", agencyOrgId: invoice.payeeId };
    const { error } = await recordInvoicePayment(params);
    setAddSubmitting(false);
    if (error) { setAddError(error); return; }
    setShowAdd(false);
    setAddAmount(""); setAddNote("");
    onChanged();
  }

  return (
    <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Badge label={INVOICE_STATUS_BADGE[invoice.status].label} variant={INVOICE_STATUS_BADGE[invoice.status].variant}/>
            </div>
            <div className="text-sm font-semibold truncate">{invoice.payeeName}</div>
            <div className="text-xs text-muted-foreground">{invoice.campaignName}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0"><X size={16}/></button>
        </div>

        <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-muted-foreground font-mono">Paid / Total</div>
            <div className="text-lg font-semibold font-mono">${invoice.acceptedAmount.toLocaleString()} <span className="text-muted-foreground font-normal">/ ${invoice.totalAmount.toLocaleString()}</span></div>
          </div>
          {remaining > 0 && (
            <Btn variant="outline" size="sm" onClick={()=>{ setShowAdd(o=>!o); setAddAmount(String(remaining)); }}>
              {showAdd ? "Cancel" : "Add Payment"}
            </Btn>
          )}
        </div>

        {showAdd && (
          <div className="px-6 py-4 border-b border-border shrink-0 space-y-3 bg-secondary/30">
            <div className="text-xs text-muted-foreground">${remaining.toLocaleString()} remaining</div>
            <div className="flex gap-2">
              <input value={addAmount} onChange={e=>setAddAmount(e.target.value)} type="number" min="0" max={remaining}
                className="w-28 bg-input-background border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-foreground"/>
              <div className="flex gap-1.5">
                {(["check","wire","cash"] as const).map(m=>(
                  <button key={m} onClick={()=>setAddMethod(m)}
                    className={cx("text-xs px-3 py-2 rounded-full border transition-colors cursor-pointer capitalize",
                      addMethod===m?"bg-foreground text-primary-foreground border-foreground":"border-border text-muted-foreground hover:border-foreground"
                    )}>{m}</button>
                ))}
              </div>
            </div>
            <input value={addNote} onChange={e=>setAddNote(e.target.value)} placeholder="Reference note (optional)"
              className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground"/>
            {addError && <div className="text-xs text-red-500">{addError}</div>}
            <Btn variant="primary" size="sm" disabled={addSubmitting} onClick={handleAddPayment}>{addSubmitting ? "Recording…" : "Record Payment"}</Btn>
          </div>
        )}

        <div className="px-6 py-4 overflow-y-auto space-y-3">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Payment Trail · {invoice.payments.length}</div>
          {invoice.payments.map(p => (
            <div key={p.id} className="glass-subtle border rounded-md p-3">
              <div className="flex items-start justify-between gap-4 mb-2.5">
                <div className="text-xs text-muted-foreground">{MANUAL_METHOD_LABEL[p.method]}{p.referenceNote ? ` · ${p.referenceNote}` : ""}</div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="font-mono text-sm font-semibold">${p.amount.toLocaleString()}</div>
                  {p.status === "pending" && (
                    <button onClick={()=>{ setVoidTarget(p); setVoidReason(""); }} className="text-xs text-[#C0392B] hover:underline cursor-pointer">Void</button>
                  )}
                </div>
              </div>
              <div className="max-w-md mb-2"><PaymentTimeline payment={p}/></div>
              <PaymentAuditTrail payment={p}/>
            </div>
          ))}
        </div>
      </div>

      {voidTarget && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-card border border-border rounded-md w-96 p-6 shadow-xl">
            <div className="text-sm font-semibold mb-1">Void this payment?</div>
            <div className="text-xs text-muted-foreground mb-4">
              ${voidTarget.amount.toLocaleString()} via {MANUAL_METHOD_LABEL[voidTarget.method]} to {invoice.payeeName}. This can only be done before {invoice.payeeName} confirms receipt — once voided, it no longer counts toward the balance.
            </div>
            <FieldLabel>Reason (required)</FieldLabel>
            <textarea value={voidReason} onChange={e=>setVoidReason(e.target.value)} rows={2} placeholder="e.g. Entered wrong amount"
              className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground mb-4 resize-none"/>
            <div className="flex gap-2">
              <Btn variant="primary" fullWidth disabled={!voidReason.trim() || voidSubmitting} onClick={handleVoidConfirm}>{voidSubmitting ? "Voiding…" : "Void Payment"}</Btn>
              <Btn variant="outline" fullWidth onClick={()=>{ setVoidTarget(null); setVoidReason(""); }}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stripe's card.brand is already lowercase-ish and mostly presentable,
// but a couple of common networks read better with real casing than
// str.toUpperCase() would give them.
const CARD_BRAND_LABEL: Record<string, string> = {
  visa: "VISA", mastercard: "MASTERCARD", amex: "AMEX", discover: "DISCOVER",
  diners: "DINERS CLUB", jcb: "JCB", unionpay: "UNIONPAY",
};
function cardBrandLabel(brand: string): string {
  return CARD_BRAND_LABEL[brand] ?? brand.toUpperCase();
}

function GlobalPayments() {
  const currentUser = useCurrentUser();
  const org = currentUser?.org ?? "";
  const meName = currentUser?.name ?? "";
  const { org: accountOrg } = useAuth();
  const [paymentsTab, setPaymentsTab] = useState<"payments"|"invoices">("payments");
  const [selectedInvoice, setSelectedInvoice] = useState<UnifiedInvoice | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  // Authorize Payment — a cross-campaign shortcut into the same real
  // RecordPaymentModal each campaign's own Payments tab uses. Picking an
  // outstanding invoice here resolves its real OutstandingPayee (by
  // matching Invoice.payeeKind/payeeId against the campaign's live
  // fetchOutstandingPayees rows) so it's the exact same check/wire/cash/
  // card flow, not a second implementation of it.
  const [showAuthorize, setShowAuthorize] = useState(false);
  const [authorizeInvoice, setAuthorizeInvoice] = useState<UnifiedInvoice | null>(null);
  const [authorizePayee, setAuthorizePayee] = useState<OutstandingPayee | null>(null);
  const [resolvingAuthorize, setResolvingAuthorize] = useState(false);
  const [authorizeError, setAuthorizeError] = useState<string | null>(null);

  // Both check/wire/cash and card now go through the same real,
  // per-campaign Payments tab (fetchOutstandingPayees + RecordPaymentModal)
  // — this screen is the cross-campaign list of every invoice built that
  // way, real and persisted (0046/0051/0053/0054). Void/confirm/add-
  // payment all live inside InvoiceDetailModal now, not here —
  // GlobalPayments just loads the list and hands off to it.
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

  async function reloadInvoices() {
    if (!accountOrg) return;
    setInvoicesLoading(true);
    setInvoices(await fetchInvoicesForBrand(accountOrg.id));
    setInvoicesLoading(false);
  }

  useEffect(() => {
    reloadInvoices();
  }, [accountOrg?.id]);

  // Same merged (mock card + real invoice) list the Invoices tab itself
  // renders from, so a card seen here looks and reads identically there —
  // outstanding only, overdue-first.
  const outstandingInvoices = useMemo(() => {
    const overdueOrder = (inv: UnifiedInvoice) => inv.overdue ? 0 : 1;
    return buildUnifiedInvoices(invoices)
      .filter(inv => inv.status === "outstanding")
      .sort((a,b) => overdueOrder(a)-overdueOrder(b));
  }, [invoices]);

  function openInvoice(inv: UnifiedInvoice) {
    setSelectedInvoice(inv);
    setPaymentsTab("invoices");
  }

  function closeAuthorize() {
    setShowAuthorize(false);
    setAuthorizeInvoice(null);
    setAuthorizePayee(null);
    setAuthorizeError(null);
  }

  async function selectAuthorizeTarget(inv: UnifiedInvoice) {
    setAuthorizeInvoice(inv);
    setAuthorizeError(null);
    setResolvingAuthorize(true);
    const payees = await fetchOutstandingPayees(inv.invoice.campaignId);
    const match = payees.find(p =>
      inv.invoice.payeeKind === "agency" ? p.agencyOrgId === inv.invoice.payeeId :
      inv.invoice.payeeKind === "independent-model" ? p.modelId === inv.invoice.payeeId :
      p.crewPayeeId === inv.invoice.payeeId
    );
    setResolvingAuthorize(false);
    if (!match || match.remaining <= 0) {
      setAuthorizeError("Couldn't find a live outstanding balance for this payee — try refreshing.");
      return;
    }
    setAuthorizePayee(match);
  }

  // Quiet history column, not another call to action — most recent first.
  // "delayed" reflects money already authorized on the brand's side —
  // the payout to the agency is what's held up, not the brand's payment.
  // No refund action here deliberately — the brand paid the agency, so
  // the agency (who's actually holding the funds) is the one who'd
  // initiate returning them, not the brand unilaterally reversing its
  // own completed payment from this dashboard.
  const recentActivity: { campaign: string; amount: string; paidDate: string; status: "paid" | "delayed" }[] = [
    { campaign:"AW26 Runway Presentation", amount:"$3,200", paidDate:"Jun 18", status:"paid" },
    { campaign:"Holiday 2026 Lookbook",    amount:"$1,850", paidDate:"Jun 14", status:"paid" },
    { campaign:"AW25 Womenswear Campaign", amount:"$2,300", paidDate:"Jun 09", status:"paid" },
    { campaign:"SS25 Fragrance Launch",    amount:"$1,100", paidDate:"Jun 02", status:"delayed" },
    { campaign:"Resort Lookbook 2025",     amount:"$980",   paidDate:"May 27", status:"paid" },
  ];
  const [pendingBankAdded, setPendingBankAdded] = useState(false);

  // Real cards, straight from Stripe (organizations.stripe_customer_id,
  // reused from the never-wired-up subscription column — see
  // create-setup-intent's header). Bank Accounts stays mock/decorative
  // below — ACH/Financial Connections is a separate, not-yet-decided
  // effort.
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [addCardSecret, setAddCardSecret] = useState<string | null>(null);
  const [addCardLoading, setAddCardLoading] = useState(false);
  const [addCardError, setAddCardError] = useState<string | null>(null);

  async function reloadCards() {
    setCardsLoading(true);
    const { cards: fetched } = await listPaymentMethods();
    setCards(fetched);
    setCardsLoading(false);
  }

  useEffect(() => { reloadCards(); }, [accountOrg?.id]);

  async function startAddCard() {
    setShowAddCard(true);
    setAddCardError(null);
    setAddCardLoading(true);
    const { clientSecret, error } = await createSetupIntent();
    setAddCardLoading(false);
    if (error || !clientSecret) { setAddCardError(error ?? "Couldn't start card setup."); return; }
    setAddCardSecret(clientSecret);
  }

  function closeAddCard() {
    setShowAddCard(false);
    setAddCardSecret(null);
    setAddCardError(null);
  }

  // Gold button style, shared by the Authorize Payment/Add Card/Add
  // Bank actions — plain sentence case, matching every other button's
  // Instrument Sans treatment.
  const goldBtn = "bg-gold hover:bg-gold/90 text-gold-foreground font-semibold transition-all shadow-md hover:shadow-lg";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Payments" sub={`${org} · Payment methods and invoices`}/>
      <GateBanner org={accountOrg}/>
      {/* Tab bar: Payments | Invoices (invoices now includes every check/wire/cash payment too) */}
      <div className="bg-card border-b border-border px-6 flex items-center shrink-0">
        {([{id:"payments" as const,label:"Payments"},{id:"invoices" as const,label:"Invoices"}]).map(t=>(
          <button key={t.id} onClick={()=>setPaymentsTab(t.id)}
            className={cx("px-5 py-3 text-sm border-b-2 -mb-px transition-colors cursor-pointer",
              paymentsTab===t.id?"border-foreground text-foreground font-medium":"border-transparent text-muted-foreground hover:text-foreground"
            )}>{t.label}</button>
        ))}
      </div>
      {paymentsTab==="invoices" && (
        <InvoicesPanel
          invoices={invoices}
          invoicesLoading={invoicesLoading}
          onChanged={reloadInvoices}
          selected={selectedInvoice}
          onSelect={setSelectedInvoice}
        />
      )}
      {paymentsTab==="payments" && <div className="flex-1 flex min-h-0">
      {/* Full-height layout — button pinned to bottom */}
      <div className="flex-1 flex min-h-0 p-6 gap-5">

        {/* LEFT 1/3 — Cards + Bank Accounts */}
        <div className="w-72 shrink-0 flex flex-col gap-4 overflow-y-auto">
          <div>
            <h2 className="text-heading text-base mb-3">Payment Cards</h2>
            {cardsLoading ? (
              <div className="h-44 border border-dashed border-border rounded-xl flex items-center justify-center text-xs text-muted-foreground">Loading…</div>
            ) : cards.length > 0 ? (
              <div className="space-y-3">
                {cards.map((c, i) => i === 0 ? (
                  <div key={c.id} className="relative rounded-xl overflow-hidden h-44 bg-gradient-to-br from-[#2A2826] via-[#1E1C1A] to-[#0B0B0A] p-5 flex flex-col justify-between select-none hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div><div className="text-[10px] font-mono text-white/80 uppercase tracking-widest">Primary</div><div className="text-base font-bold text-white tracking-widest mt-1">{cardBrandLabel(c.brand)}</div></div>
                    </div>
                    <div>
                      <div className="text-white font-mono text-lg tracking-widest mb-2">•••• •••• •••• {c.last4}</div>
                      <div className="flex items-end justify-between">
                        <div><div className="text-[9px] text-white/60 uppercase">Card Holder</div><div className="text-xs text-white font-medium">{meName.toUpperCase()}</div></div>
                        <div className="text-right"><div className="text-[9px] text-white/60 uppercase">Expires</div><div className="text-xs text-white font-mono">{String(c.expMonth).padStart(2,"0")}/{String(c.expYear).slice(-2)}</div></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={c.id} className="relative rounded-xl overflow-hidden h-28 bg-gradient-to-br from-[#2a2a2a] to-[#444] p-4 flex flex-col justify-between hover:shadow-md transition-shadow opacity-70">
                    <div className="text-xs text-white/60 font-mono">{cardBrandLabel(c.brand)}</div>
                    <div><div className="text-white font-mono text-sm tracking-widest mb-1">•••• •••• •••• {c.last4}</div><div className="text-xs text-white/60">{meName.toUpperCase()} · {String(c.expMonth).padStart(2,"0")}/{String(c.expYear).slice(-2)}</div></div>
                  </div>
                ))}
                <button onClick={startAddCard} className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-4 py-2 flex items-center justify-center gap-1 hover:border-foreground transition-colors w-full">
                  <Plus size={12}/> Add card
                </button>
              </div>
            ) : (
              <div className="h-44 border-2 border-dashed border-border rounded-xl flex items-center justify-center cursor-pointer hover:border-foreground transition-colors" onClick={startAddCard}>
                <div className="text-center"><Plus size={20} className="text-muted-foreground mx-auto mb-1"/><div className="text-xs text-muted-foreground">Add payment card</div></div>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-heading text-base mb-3">Bank Accounts</h2>
            <div className="space-y-2">
              <div className="glass-subtle border border-foreground/20 rounded-md p-3">
                <div className="flex items-start justify-between mb-1.5">
                  <div><div className="text-xs font-semibold">{org} Operating</div><div className="text-[10px] text-muted-foreground font-mono">Checking · Primary</div></div>
                  <Badge label="Default" variant="active"/>
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Account</span><span className="font-mono">••••4422</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Routing</span><span className="font-mono">021000021</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Bank</span><span className="font-mono">JPMorgan Chase</span></div>
                </div>
              </div>
              <div className="glass-subtle border rounded-md p-3">
                <div className="text-xs font-semibold mb-0.5">Creative Fund</div>
                <div className="text-[10px] text-muted-foreground font-mono mb-1.5">Savings</div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Account</span><span className="font-mono">••••8834</span></div>
              </div>
              {pendingBankAdded && (
                <div className="glass-subtle border border-[#D4A017]/30 bg-[#D4A017]/5 rounded-md p-3">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="text-xs font-semibold">New Account</div>
                    <span className="flex items-center gap-1 text-[9px] font-mono text-[#D4A017] uppercase tracking-wider"><Shield size={10}/> Pending Verification</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-relaxed">Micro-deposits sent — usually settles in 1–2 business days. This account can't be used to authorize payments until verified.</div>
                </div>
              )}
              <button className="text-xs text-muted-foreground hover:text-foreground w-full text-center border border-dashed border-border rounded-md px-4 py-2 hover:border-foreground transition-colors">See all accounts</button>
              <button onClick={()=>setShowAddBank(true)} className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-4 py-2 flex items-center justify-center gap-1 hover:border-foreground w-full transition-colors"><Plus size={12}/> Add account</button>
            </div>
          </div>
        </div>

        {/* MIDDLE — Invoices, flex-1 */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3 shrink-0 gap-3">
            <h2 className="text-heading text-base shrink-0">Outstanding Invoices</h2>
            <button className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer shrink-0" onClick={() => setPaymentsTab("invoices")}>
              See all invoices →
            </button>
          </div>
          {/* Same card as the Invoices tab — unpaid only */}
          <div className="flex-1 overflow-auto">
            {outstandingInvoices.length === 0 ? (
              <div className="text-sm text-muted-foreground">No outstanding invoices.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {outstandingInvoices.slice(0,9).map(inv => (
                  <InvoiceCard key={inv.key} inv={inv} onClick={()=>openInvoice(inv)}/>
                ))}
              </div>
            )}
          </div>

          <button onClick={()=>setShowAuthorize(true)} disabled={outstandingInvoices.length===0}
            className={`w-full shrink-0 mt-4 py-3.5 rounded-md text-sm ${goldBtn} disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none`}>
            Authorize Payment
          </button>
        </div>

        {/* RIGHT — Recent Activity, small quiet column */}
        <div className="w-56 shrink-0 flex flex-col min-h-0 border-l border-border pl-5">
          <h2 className="text-heading text-base mb-3 shrink-0">Recent Activity</h2>
          <div className="flex-1 overflow-y-auto space-y-3">
            {recentActivity.map((a,i)=>(
              <div key={i} className="text-xs group">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={cx("w-1.5 h-1.5 rounded-full inline-block shrink-0", a.status==="delayed" ? "bg-[#D4A017]" : "bg-[#27AE60]")}/>
                  <span className="text-[10px] font-mono text-muted-foreground">{a.paidDate}</span>
                </div>
                <div className="leading-snug">{a.campaign}</div>
                <div className={cx("font-mono", a.status==="delayed" ? "text-[#D4A017]" : "text-muted-foreground")}>
                  {a.status==="delayed" ? `${a.amount} — payout delayed` : `${a.amount} paid`}
                </div>
                {a.status==="delayed" && (
                  <div className="text-[9px] text-muted-foreground/70 leading-snug mt-0.5">Agency payout held — bank processing, ~2 days</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>{/* end payments flex */}
      </div>}{/* end paymentsTab==="payments" */}

      {/* Add Card Modal — real Stripe SetupIntent, same Elements
          treatment as CardPaymentStep, saved for reuse against future
          invoice payments. */}
      {showAddCard && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div className="text-heading text-sm">Add Payment Card</div>
              <button onClick={closeAddCard} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
            </div>
            <div className="p-6 overflow-y-auto">
              {addCardLoading && <div className="text-sm text-muted-foreground py-6 text-center">Preparing secure card form…</div>}
              {addCardError && !addCardLoading && (
                <div className="text-xs text-[#C0392B] bg-[#C0392B]/10 border border-[#C0392B]/30 rounded-md px-3 py-2.5 mb-4">{addCardError}</div>
              )}
              {addCardSecret && (
                <AddCardStep clientSecret={addCardSecret} onCancel={closeAddCard} onDone={()=>{ closeAddCard(); reloadCards(); }}/>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Bank Account Modal */}
      {showAddBank && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[60]">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="text-heading text-sm">Add Bank Account</div>
              <button onClick={()=>setShowAddBank(false)} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
            </div>
            <div className="p-6 space-y-4">
              <TextInput label="Account Nickname" placeholder={`e.g. ${org || "Company"} Operating`}/>
              <FSelect label="Account Type" options={["Checking","Savings"]}/>
              <TextInput label="Account Holder Name" placeholder={`e.g. ${org || "Company"} LLC`}/>
              <div>
                <FieldLabel>Account Number</FieldLabel>
                <input placeholder="Enter account number" className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:border-foreground"/>
              </div>
              <TextInput label="Routing Number" placeholder="9 digit routing number"/>
              <TextInput label="Bank Name" placeholder="e.g. JPMorgan Chase"/>
              <div className="bg-secondary border border-border rounded-md px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
                <Lock size={13} className="shrink-0 mt-0.5"/>
                <span>ACH account details are verified and stored securely. A micro-deposit may be sent to confirm ownership.</span>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button className={`flex-1 py-3 rounded-md text-sm ${goldBtn}`} onClick={()=>{ setShowAddBank(false); setPendingBankAdded(true); }}>Save Account</button>
              <Btn variant="outline" onClick={()=>setShowAddBank(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Authorize Payment — pick any outstanding invoice across every
          campaign, then hand off to the real RecordPaymentModal scoped
          to that one payee. */}
      {showAuthorize && !authorizePayee && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <div className="text-heading text-sm">Authorize Payment</div>
                <div className="text-xs text-muted-foreground mt-0.5">Pick who you're paying — any campaign.</div>
              </div>
              <button onClick={closeAuthorize} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {authorizeError && <div className="text-xs text-red-500 px-2 pb-2">{authorizeError}</div>}
              {outstandingInvoices.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">No outstanding invoices.</div>
              ) : outstandingInvoices.map(inv => (
                <button key={inv.key} onClick={()=>selectAuthorizeTarget(inv)} disabled={resolvingAuthorize}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-md border border-border hover:border-foreground/40 hover:bg-secondary/50 transition-colors text-left disabled:opacity-50 cursor-pointer disabled:cursor-wait">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{inv.payee}</div>
                    <div className="text-xs text-muted-foreground truncate">{inv.campaign}</div>
                  </div>
                  <div className="text-sm font-mono shrink-0">${inv.amount.toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {authorizePayee && authorizeInvoice && (
        <RecordPaymentModal campaignId={authorizeInvoice.invoice.campaignId} payees={[authorizePayee]}
          onClose={closeAuthorize} onDone={()=>{ closeAuthorize(); reloadInvoices(); }}/>
      )}

    </div>
  );
}

// ─── INVOICES PANEL ─────────────────────────────────────────────────────────

// One shape for every invoice card on the brand side — real now,
// whether the underlying payment was manual (check/wire/cash) or card
// (0054), since both write into the same invoices/invoice_payments
// tables. Outstanding Invoices (Payments tab) and the Invoices tab both
// build from this and render with the same <InvoiceCard/>, so they
// can't drift apart in look or info (a real requirement, not a
// coincidence).
interface UnifiedInvoice {
  key: string;
  id: string;
  campaign: string;
  payee: string;
  detail: string;
  amount: number;
  dateLabel: string;
  overdue: boolean;
  status: InvoiceStatus;
  invoice: Invoice;
}

function buildUnifiedInvoices(invoices: Invoice[]): UnifiedInvoice[] {
  return invoices.map(inv => {
    const pendingAmount = inv.payments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
    const lastAccepted = [...inv.payments].reverse().find(p => p.status === "accepted");
    const detail = inv.payments.length === 1
      ? `${MANUAL_METHOD_LABEL[inv.payments[0].method]}${inv.payments[0].referenceNote ? ` · ${inv.payments[0].referenceNote}` : ""}`
      : `${inv.payments.length} payments`;
    const dateLabel = inv.status === "paid"
      ? `Paid ${fmtDate(lastAccepted?.acceptedAt ?? null)}`
      : inv.status === "partially_paid"
      ? `$${inv.acceptedAmount.toLocaleString()} of $${inv.totalAmount.toLocaleString()}`
      : pendingAmount > 0 ? "Pending confirmation" : "";
    return {
      key: inv.id, id: `INV-${inv.id.slice(0, 8).toUpperCase()}`, campaign: inv.campaignName, payee: inv.payeeName,
      detail, amount: inv.totalAmount, dateLabel, overdue: false, status: inv.status, invoice: inv,
    };
  });
}

// The one card look every invoice uses, mock or real, outstanding,
// partially paid, or paid — a single colored dot (red only if actually
// overdue, the established convention, no yellow/green due-date
// tiering; gold specifically means "some money has landed," a genuinely
// different signal from urgency) instead of the old three-way legend.
function InvoiceCard({ inv, onClick }: { inv: UnifiedInvoice; onClick: () => void }) {
  const dotClass = inv.status === "paid" ? "bg-[#27AE60]" : inv.status === "partially_paid" ? "bg-[#D4A017]" : inv.overdue ? "bg-[#C0392B]" : "bg-muted-foreground/40";
  return (
    <div
      onClick={onClick}
      className="glass-subtle border rounded-xl p-5 cursor-pointer hover:border-foreground/40 hover:shadow-md transition-all group relative overflow-hidden"
    >
      {inv.status === "paid" && (
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.16] pointer-events-none"><PaidStamp size={190} animate={false}/></div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cx("w-2 h-2 rounded-full shrink-0", dotClass)}/>
          <span className="text-[10px] font-mono text-muted-foreground">{inv.id}</span>
        </div>
        {inv.status !== "paid" && <span className="text-[10px] font-mono text-muted-foreground">{inv.dateLabel}</span>}
      </div>
      <div className="mb-4">
        <div className="text-sm font-semibold leading-snug mb-0.5">{inv.campaign}</div>
        <div className="text-xs text-muted-foreground">{inv.payee}</div>
        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{inv.detail}</div>
      </div>
      <div className="border-t border-border pt-3 flex items-end justify-between">
        <div>
          <div className="text-[10px] text-muted-foreground font-mono">{inv.status !== "paid" ? "Total Due" : inv.dateLabel}</div>
          <div className={cx("text-xl font-semibold font-mono", inv.status === "outstanding" && inv.overdue && "font-bold text-[#C0392B]/80")}>
            ${inv.amount.toLocaleString()}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity font-mono">View →</span>
      </div>
    </div>
  );
}

function InvoicesPanel({ invoices, invoicesLoading, onChanged, selected, onSelect }: {
  invoices: Invoice[]; invoicesLoading: boolean; onChanged: () => void;
  selected: UnifiedInvoice | null; onSelect: (inv: UnifiedInvoice | null) => void;
}) {
  const currentUser = useCurrentUser();
  const org = currentUser?.org ?? "";

  const all = useMemo(() => buildUnifiedInvoices(invoices), [invoices]);
  // "Outstanding" covers both untouched and partially-paid invoices —
  // both still owe money, they just differ in how much (InvoiceCard's
  // gold dot + progress line is what tells them apart). "Paid" is the
  // only fully-settled bucket now; there's no invoice-level "voided"
  // anymore (0053) — a voided payment just never counted, so an invoice
  // with only voided payments is simply outstanding.
  const outstanding = useMemo(() => {
    const order = (i: UnifiedInvoice) => (i.overdue ? 0 : 1);
    return all.filter(i => i.status !== "paid").sort((a, b) => order(a) - order(b));
  }, [all]);
  const paid = useMemo(() => all.filter(i => i.status === "paid"), [all]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Invoices" sub={`All invoices · ${org}`}/>
      <div className="flex-1 overflow-auto p-6">
        {invoicesLoading && <div className="text-sm text-muted-foreground mb-4">Loading…</div>}
        {outstanding.length === 0 && !invoicesLoading ? (
          <div className="text-sm text-muted-foreground">No outstanding invoices.</div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {outstanding.map(inv => <InvoiceCard key={inv.key} inv={inv} onClick={() => onSelect(inv)}/>)}
          </div>
        )}

        {paid.length > 0 && (<>
          <h2 className="text-heading text-base mt-8 mb-4">Paid</h2>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {paid.map(inv => <InvoiceCard key={inv.key} inv={inv} onClick={() => onSelect(inv)}/>)}
          </div>
        </>)}
      </div>

      {selected && (
        <InvoiceDetailModal
          invoice={selected.invoice}
          onClose={() => onSelect(null)}
          onChanged={async () => { onChanged(); onSelect(null); }}
        />
      )}
    </div>
  );
}

// ─── MESSAGING ─────────────────────────────────────────────────────────────

const INBOX_MSGS = [
  { id:1,  urgent:true,  date:"Jun 19, 2:14 PM", subject:"Payout requested — Booking #0841",              sender:"Sophie Chen",   org:"Vantage Model Mgmt.", title:"Senior Agent",      campaign:"AW25 Womenswear",     read:false, body:"Please review and authorize payment for the AW25 Womenswear booking. Let us know if you have any questions." },
  { id:2,  urgent:false, date:"Jun 18, 10:30 AM",subject:"Talent availability confirmed — Amara Diallo",  sender:"James Kirk",    org:"Vantage Model Mgmt.", title:"Booking Agent",    campaign:"AW25 Womenswear",     read:false, body:"Amara has confirmed availability for the full window, 07/14–07/15. Please proceed with the contract." },
  { id:3,  urgent:false, date:"Jun 17, 4:05 PM", subject:"Rate question — SS25 Fragrance",                sender:"Diana Park",    org:"Meridian Models",        title:"Agent",             campaign:"SS25 Fragrance",      read:true,  body:"Following up on rates for Mila's booking. Please advise." },
  { id:4,  urgent:true,  date:"Jun 17, 11:52 AM",subject:"Fitting rescheduled — need sign-off today",      sender:"Priya Anand",   org:"Solenne",        title:"Booking Coordinator",campaign:"AW26 Runway Presentation", read:false, body:"The 2pm fitting slot moved to 4pm due to a venue conflict. Need your sign-off on the new call sheet before we notify talent." },
  { id:5,  urgent:false, date:"Jun 16, 5:40 PM", subject:"Usage terms question — Resort Lookbook",         sender:"Marcus Reyes",  org:"Vector Models",        title:"Agent",             campaign:"Resort Lookbook 2025",read:true,  body:"Client is asking whether the lookbook usage extends to paid social. Can you confirm before we sign?" },
  { id:6,  urgent:false, date:"Jun 16, 9:15 AM", subject:"Comp cards attached — 3 new submissions",        sender:"Sophie Chen",   org:"Vantage Model Mgmt.", title:"Senior Agent",      campaign:"SS25 Fragrance",      read:true,  body:"Sending over three additional comp cards for consideration ahead of Friday's deadline." },
  { id:7,  urgent:false, date:"Jun 15, 3:22 PM", subject:"Contract executed — Ines Ferreira",              sender:"James Kirk",    org:"Vantage Model Mgmt.", title:"Booking Agent",    campaign:"AW26 Runway Presentation", read:true,  body:"Signed contract attached. Let us know if wardrobe needs measurements ahead of the fitting." },
  { id:8,  urgent:true,  date:"Jun 15, 8:03 AM", subject:"Overdue invoice — please advise",                sender:"Diana Park",    org:"Meridian Models",        title:"Agent",             campaign:"SS25 Fragrance",      read:false, body:"Invoice #4471 is now five days past due. Can you let us know the status on your end?" },
  { id:9,  urgent:false, date:"Jun 14, 6:48 PM", subject:"Travel confirmation needed",                     sender:"Marcus Reyes",  org:"Vector Models",        title:"Agent",             campaign:"Resort Lookbook 2025",read:true,  body:"Can you confirm flight details for the location shoot are finalized on your side?" },
  { id:10, urgent:false, date:"Jun 14, 1:10 PM", subject:"New talent for consideration — Runway",          sender:"Priya Anand",   org:"Solenne",        title:"Booking Coordinator",campaign:"AW26 Runway Presentation", read:true,  body:"Adding two new faces to the roster ahead of casting. Comp cards to follow shortly." },
  { id:11, urgent:false, date:"Jun 13, 4:30 PM", subject:"Re: Rate question — SS25 Fragrance",             sender:"Diana Park",    org:"Meridian Models",        title:"Agent",             campaign:"SS25 Fragrance",      read:true,  body:"Thanks for confirming — we'll move forward at the quoted rate." },
  { id:12, urgent:false, date:"Jun 12, 9:55 AM", subject:"Deliverables received — Womenswear",             sender:"James Kirk",    org:"Vantage Model Mgmt.", title:"Booking Agent",    campaign:"AW25 Womenswear",     read:true,  body:"All deliverables for the shoot have been received and logged on our end. Thank you." },
];

// Split view — an inbox list on the left, a persistent compose/detail pane
// on the right. Always lands blank (no compose, no message open) — every
// time this screen mounts, including after signing back in — rather than
// jumping back to whatever was last open.
// Send/Reply are mocked (no recipients, no delivery) until there's a real
// backend to send through — that's expected at this stage.
type MessagingMode = "empty" | "compose" | "view";

function MessagingScreen() {
  const [messages, setMessages] = useState(INBOX_MSGS);
  const [mode, setMode] = useState<MessagingMode>("empty");
  const [selectedId, setSelectedId] = useState<number|null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const allChecked = messages.length>0 && checked.length===messages.length;
  // Derived from messages rather than its own snapshot, so the detail pane
  // always reflects the latest read state instead of going stale the
  // moment openMessage flips it.
  const selectedMsg = messages.find(m=>m.id===selectedId) ?? null;

  function openMessage(m: typeof INBOX_MSGS[number]) {
    setSelectedId(m.id);
    setMode("view");
    setMessages(prev => prev.map(x => x.id===m.id ? { ...x, read:true } : x));
  }
  function startNewMessage() {
    setSelectedId(null);
    setMode("compose");
  }
  function toggleChecked(id: number) {
    setChecked(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  }
  function toggleCheckAll() {
    setChecked(allChecked ? [] : messages.map(m=>m.id));
  }
  function toggleRead(id: number) {
    setMessages(prev => prev.map(x => x.id===id ? { ...x, read:!x.read } : x));
  }
  function markChecked(read: boolean) {
    setMessages(prev => prev.map(m => checked.includes(m.id) ? { ...m, read } : m));
    setChecked([]);
  }
  function archiveChecked() {
    setMessages(prev => prev.filter(m=>!checked.includes(m.id)));
    if (selectedId!==null && checked.includes(selectedId)) {
      setSelectedId(null);
      setMode("empty");
    }
    setChecked([]);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Messaging" sub="Organization and agency communications"
        actions={<Btn variant="primary" size="sm" icon={<Edit3 size={13}/>} onClick={startNewMessage}>New Message</Btn>}/>
      <div className="flex-1 flex min-h-0">
        <div className="w-80 shrink-0 border-r border-border flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold">Inbox</div>
              <span className="text-[10px] font-mono text-muted-foreground">{messages.length}</span>
            </div>
            <button onClick={toggleCheckAll} className="text-[10px] font-mono text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer">
              {allChecked ? "Clear all" : "Select all"}
            </button>
          </div>
          {checked.length>0 && (
            <div className="px-4 py-2 border-b border-border flex items-center justify-between shrink-0 bg-muted/30">
              <span className="text-[10px] font-mono text-muted-foreground">{checked.length} selected</span>
              <div className="flex items-center gap-3">
                <button onClick={()=>markChecked(true)} className="text-[10px] font-mono text-foreground hover:underline cursor-pointer">Mark read</button>
                <button onClick={()=>markChecked(false)} className="text-[10px] font-mono text-foreground hover:underline cursor-pointer">Mark unread</button>
                <button onClick={archiveChecked} className="text-[10px] font-mono text-foreground hover:underline cursor-pointer">Archive</button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto divide-y divide-border">
            {messages.map(m=>(
              <div key={m.id} onClick={()=>openMessage(m)}
                className={cx("px-5 py-4 cursor-pointer hover:bg-secondary transition-colors flex items-start gap-3",
                  mode==="view" && selectedId===m.id ? "bg-secondary" : !m.read && "bg-muted/20"
                )}>
                <button onClick={(e)=>{ e.stopPropagation(); toggleChecked(m.id); }}
                  className={cx("w-[18px] h-[18px] rounded-sm border flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors",
                    checked.includes(m.id) ? "bg-foreground border-foreground" : "border-border hover:border-foreground/40"
                  )}>
                  {checked.includes(m.id) && <Check size={11} strokeWidth={3} className="text-primary-foreground"/>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={cx("text-sm truncate", !m.read&&"font-semibold")}>
                      {m.sender} <span className="text-muted-foreground font-normal">· {m.org}</span>
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">{m.date}</span>
                  </div>
                  <div className={cx("text-sm flex items-center gap-1.5", !m.read&&"font-semibold")}>
                    {m.urgent && <span className="text-[8px] font-mono border border-urgent text-urgent px-1 py-0.5 rounded-sm tracking-wider shrink-0">URGENT</span>}
                    <span className="truncate">{m.subject}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          {mode==="empty" && (
            <div className="flex-1 flex items-center justify-center text-center px-6">
              <div>
                <div className="text-sm text-muted-foreground mb-3">Select a message to read, or start a new one.</div>
                <Btn variant="outline" size="sm" icon={<Edit3 size={13}/>} onClick={startNewMessage}>New Message</Btn>
              </div>
            </div>
          )}
          {mode==="compose" && <ComposePane replyTo={selectedMsg}/>}
          {mode==="view" && selectedMsg && (
            <MessageDetailPane msg={selectedMsg} allMessages={messages}
              onReply={()=>setMode("compose")}
              onToggleRead={()=>toggleRead(selectedMsg.id)}
              onOpenRelated={openMessage}/>
          )}
        </div>
      </div>
    </div>
  );
}

function UrgentToggle({ defaultUrgent }: { defaultUrgent: boolean }) {
  const [urgent, setUrgent] = useState(defaultUrgent);
  return (
    <button type="button" onClick={()=>setUrgent(u=>!u)}
      className={cx("flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors cursor-pointer",
        urgent ? "border-urgent text-urgent bg-urgent/5" : "border-border text-muted-foreground hover:border-foreground/40"
      )}>
      <span className={cx("w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0",
        urgent ? "bg-urgent border-urgent" : "border-border"
      )}>
        {urgent && <Check size={9} strokeWidth={3} className="text-urgent-foreground"/>}
      </span>
      Mark as urgent
    </button>
  );
}

function ComposePane({ replyTo }: { replyTo: typeof INBOX_MSGS[number]|null }) {
  const [formKey, setFormKey] = useState(0);
  const [sent, setSent] = useState(false);
  const { org: accountOrg } = useAuth();
  const messagingGate = getAccessGate(accountOrg);

  function handleSend() {
    if (messagingGate.gated) return;
    setSent(true);
    setFormKey(k=>k+1);
    setTimeout(()=>setSent(false), 3000);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2 shrink-0">
        <Edit3 size={14} className="text-muted-foreground"/>
        <div className="text-heading text-sm">New Message</div>
      </div>
      <div key={`${formKey}-${replyTo?.id ?? "new"}`} className="flex-1 overflow-auto p-6 space-y-4">
        <div>
          <FSelect label="To" options={ORG_USERS.map(u=>`${u.name} (${u.org})`)}
            value={replyTo ? `${replyTo.sender} (${replyTo.org})` : undefined}/>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">
            Brand team and agency contacts only — models can't be messaged directly here; use the campaign group chat instead.
          </div>
        </div>
        <TextInput label="Subject" placeholder="Subject" defaultValue={replyTo ? `Re: ${replyTo.subject}` : undefined}/>
        <Textarea label="Message" placeholder="Write your message…" rows={12}/>
        <UrgentToggle defaultUrgent={replyTo?.urgent ?? false}/>
      </div>
      <div className="border-t border-border px-6 py-4 flex items-center gap-3 shrink-0">
        <Btn variant="primary" size="sm" icon={<Send size={13}/>} onClick={handleSend} disabled={messagingGate.gated}>Send</Btn>
        {messagingGate.gated && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock size={12}/> {messagingGate.reason === "unverified" ? "Verification required to send." : "Add a payment method to send."}
          </span>
        )}
      </div>
      {sent && (
        <div className="absolute bottom-20 right-6 glass-strong border rounded-lg shadow-xl px-5 py-4 flex items-center gap-3 z-30 animate-in fade-in slide-in-from-bottom-2">
          <div className="w-9 h-9 rounded-full bg-foreground text-primary-foreground flex items-center justify-center shrink-0">
            <Check size={16}/>
          </div>
          <div>
            <div className="text-sm font-semibold">Message sent</div>
            <div className="text-xs text-muted-foreground">Delivered just now</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Header reads like a plain old mail client (mutt/Pine/early Outlook) —
// labeled fields in a monospace block — rather than a single condensed
// byline. A short one-sentence body used to leave the whole pane looking
// mostly blank; the "Related" thread below (same campaign, grouped from
// the same inbox data, not fabricated) gives it real content to fill
// with instead of empty space.
function MessageDetailPane({ msg, allMessages, onReply, onToggleRead, onOpenRelated }: {
  msg: typeof INBOX_MSGS[number]; allMessages: typeof INBOX_MSGS[number][];
  onReply: () => void; onToggleRead: () => void; onOpenRelated: (m: typeof INBOX_MSGS[number]) => void;
}) {
  const currentUser = useCurrentUser();
  const related = allMessages.filter(m => m.campaign===msg.campaign && m.id!==msg.id);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-3">
          {msg.urgent && <span className="text-[8px] font-mono border border-urgent text-urgent px-1.5 py-0.5 rounded-sm tracking-wider">URGENT</span>}
          <div className="text-heading text-lg">{msg.subject}</div>
        </div>
        <div className="border border-border rounded-md divide-y divide-border font-mono text-xs overflow-hidden">
          <div className="flex"><span className="w-20 shrink-0 px-3 py-1.5 text-muted-foreground uppercase tracking-wider bg-muted/30 border-r border-border">From</span><span className="px-3 py-1.5">{msg.sender} — {msg.title}, {msg.org}</span></div>
          <div className="flex"><span className="w-20 shrink-0 px-3 py-1.5 text-muted-foreground uppercase tracking-wider bg-muted/30 border-r border-border">To</span><span className="px-3 py-1.5">{currentUser?.name ?? ""} — {currentUser?.org ?? ""}</span></div>
          <div className="flex"><span className="w-20 shrink-0 px-3 py-1.5 text-muted-foreground uppercase tracking-wider bg-muted/30 border-r border-border">Date</span><span className="px-3 py-1.5">{msg.date}</span></div>
          <div className="flex"><span className="w-20 shrink-0 px-3 py-1.5 text-muted-foreground uppercase tracking-wider bg-muted/30 border-r border-border">Campaign</span><span className="px-3 py-1.5">{msg.campaign}</span></div>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <p className="text-base leading-relaxed">{msg.body}</p>
        </div>
        {related.length>0 && (
          <div className="border-t border-border">
            <div className="px-6 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted/20">
              Related — {msg.campaign} ({related.length})
            </div>
            <div className="divide-y divide-border">
              {related.map(m=>(
                <button key={m.id} onClick={()=>onOpenRelated(m)}
                  className="w-full text-left px-6 py-4 hover:bg-secondary transition-colors flex items-center justify-between gap-3 cursor-pointer">
                  <div className="min-w-0">
                    <div className={cx("text-sm truncate", !m.read&&"font-semibold")}>{m.subject}</div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{m.sender} · {m.org}</div>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">{m.date}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-border px-6 py-4 flex items-center gap-2 shrink-0">
        <Btn variant="primary" size="sm" icon={<Send size={13}/>} onClick={onReply}>Reply</Btn>
        <Btn variant="ghost" size="sm" onClick={onToggleRead}>{msg.read ? "Mark as unread" : "Mark as read"}</Btn>
      </div>
    </div>
  );
}

// ─── DIRECTORY ───────────────────────────────────────────────────────────────

function DirectoryScreen() {
  const [filterAccess, setFilterAccess] = useState("all");
  const [search, setSearch] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [showMakeGroup, setShowMakeGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<number[]>([]);
  const [groups, setGroups] = useState(["Creative Leadership","Campaign Team","Finance","Legal","Elite Team"]);
  const [users, setUsers] = useState(ORG_USERS);

  const ME_ID = 1; // logged in user is admin (id=1)
  const isAdmin = (id: number) => users.find(u=>u.id===id)?.access==="administrator";

  function changeAccess(userId: number, newAccess: string) {
    // Admins can't change other admins' status; only admins can change any status
    if (isAdmin(userId) && userId !== ME_ID) return;
    if (!isAdmin(ME_ID)) return;
    setUsers(p=>p.map(u=>u.id===userId?{...u,access:newAccess}:u));
  }

  const q = search.trim().toLowerCase();
  const filtered = users
    .filter(u=>filterAccess==="all" || u.access===filterAccess)
    .filter(u=> !q || [u.name,u.title,u.org,u.email].some(f=>f.toLowerCase().includes(q)));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Directory" sub="Organization members and agency contacts"
        actions={<button onClick={()=>setShowAddUser(true)} className="px-4 py-2 text-sm font-medium bg-foreground text-primary-foreground rounded-md hover:bg-[#2a2a2a] cursor-pointer flex items-center gap-2"><Plus size={13}/> Add User</button>}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 gap-5">

          {/* Left: Member roster */}
          <div>
            <div className="flex items-center justify-between mb-3 gap-3">
              <h2 className="text-heading text-sm shrink-0">Members</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center border border-border rounded-md bg-input-background overflow-hidden w-40">
                  <Search size={13} className="text-muted-foreground ml-2.5 shrink-0"/>
                  <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-transparent focus:outline-none placeholder:text-muted-foreground"/>
                </div>
                <div className="flex items-center gap-1">
                  {["all","administrator","enhanced","basic"].map(a=>(
                    <button key={a} onClick={()=>setFilterAccess(a)}
                      className={cx("text-[9px] font-mono px-2 py-1 rounded-sm border cursor-pointer capitalize transition-colors",
                        filterAccess===a?"bg-foreground text-primary-foreground border-foreground":"border-border text-muted-foreground hover:border-foreground"
                      )}>{a}</button>
                  ))}
                </div>
              </div>
            </div>
            {filtered.length===0 ? (
              <div className="glass-subtle border border-dashed rounded-md p-10 text-center text-sm text-muted-foreground">No members match "{search}"</div>
            ) : (
              <div className="space-y-2">
                {filtered.map(u=>{
                  const canEdit = isAdmin(ME_ID) && !(isAdmin(u.id) && u.id !== ME_ID);
                  return (
                    <div key={u.id} className="glass-subtle border rounded-md p-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={u.name} className="w-9 h-9 text-xs"/>
                          <div><div className="text-sm font-semibold">{u.name}</div><div className="text-xs text-muted-foreground">{u.title} · {u.org}</div></div>
                        </div>
                        <Badge label={u.access} variant={ACCESS_BADGE[u.access]}/>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">{u.email} · {u.phone}</div>
                      {canEdit && (
                        <div className="flex gap-1">
                          {["basic","enhanced","administrator"].map(a=>(
                            <button key={a} onClick={()=>changeAccess(u.id, a)}
                              className={cx("text-[9px] font-mono px-2 py-0.5 rounded-sm border cursor-pointer capitalize transition-colors",
                                u.access===a?"bg-foreground text-primary-foreground border-foreground":"border-border text-muted-foreground hover:border-foreground"
                              )}>{a.slice(0,5)}</button>
                          ))}
                        </div>
                      )}
                      {!canEdit && isAdmin(u.id) && u.id!==ME_ID && (
                        <div className="text-[9px] font-mono text-muted-foreground flex items-center gap-1"><Shield size={9}/> Admin status protected</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Groups */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-heading text-sm">Groups</h2>
              <button onClick={()=>setShowMakeGroup(true)}
                className="text-xs font-medium bg-secondary border border-border text-muted-foreground rounded-md px-3 py-1.5 hover:border-foreground hover:text-foreground cursor-pointer flex items-center gap-1 transition-colors">
                <Plus size={11}/> Make Group
              </button>
            </div>
            <div className="space-y-2">
              {groups.map(g=>{
                const members = users.filter(u=>u.group===g);
                return (
                  <div key={g} className="glass-subtle border rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold">{g}</div>
                      <Badge label={`${members.length} member${members.length!==1?"s":""}`} variant="default"/>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {members.map(m=><span key={m.id} className="text-[9px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-sm font-mono">{m.name.split(" ")[0]}</span>)}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono italic">Agency auto-assign eligible</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add User modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="text-heading text-sm">Add New User</div>
              <button onClick={()=>setShowAddUser(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-3">
              <TextInput label="Full Name" placeholder="e.g. Jordan Smith"/>
              <TextInput label="Email" placeholder="email@company.com" type="email"/>
              <TextInput label="Title" placeholder="e.g. Campaign Manager"/>
              <TextInput label="Phone" placeholder="+1 212 555 0100" type="tel"/>
              <FSelect label="Access Level" options={["basic — Standard access","enhanced — Elevated access","administrator — Full admin access"]}/>
              <div className="bg-secondary border border-border rounded-md px-3 py-2 text-xs text-muted-foreground">
                An invitation email will be sent to this user to set up their login credentials.
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <Btn variant="primary" onClick={()=>setShowAddUser(false)}>Send Invitation</Btn>
              <Btn variant="outline" onClick={()=>setShowAddUser(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Make Group modal */}
      {showMakeGroup && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="text-heading text-sm">Create Group</div>
              <button onClick={()=>setShowMakeGroup(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-4">
              <TextInput label="Group Name" placeholder="e.g. Campaign Team A" value={groupName} onChange={e=>setGroupName(e.target.value)}/>
              <div>
                <FieldLabel>Select Members</FieldLabel>
                <div className="border border-border rounded-md divide-y divide-border max-h-52 overflow-auto">
                  {users.map(u=>(
                    <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-secondary transition-colors">
                      <input type="checkbox" checked={groupMembers.includes(u.id)} onChange={()=>setGroupMembers(p=>p.includes(u.id)?p.filter(x=>x!==u.id):[...p,u.id])} className="cursor-pointer"/>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">{u.name} <span className="text-muted-foreground">· {u.org}</span></div>
                        <div className="text-[10px] text-muted-foreground">{u.title}</div>
                      </div>
                      <Badge label={u.access} variant={ACCESS_BADGE[u.access]}/>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <Btn variant="primary" onClick={()=>{ if(groupName) setGroups(p=>[...p,groupName]); setShowMakeGroup(false); setGroupMembers([]); setGroupName(""); }}>Create Group</Btn>
              <Btn variant="outline" onClick={()=>setShowMakeGroup(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────

function ScheduleScreen({ campaigns, realIdShim, openCampaign }: { campaigns: Campaign[]; realIdShim: Map<number, string>; openCampaign: (id: number) => void }) {
  const { profile, org } = useAuth();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedToken, setFeedToken] = useState<string | null>(null);

  useEffect(() => {
    if (org?.id) fetchCalendarFeedToken(org.id).then(setFeedToken);
  }, [org?.id]);

  async function handleRegenerateFeed() {
    if (!org?.id) return;
    const { token } = await regenerateCalendarFeedToken(org.id);
    if (token) setFeedToken(token);
  }

  const activeCampaigns = campaigns.filter(c=>c.status!=="archived");
  // Only real campaigns (present in realIdShim) can actually persist a
  // casting or shoot day — mock campaigns don't back onto a real row to
  // attach one to, same restriction Deliverables already has.
  const addableCampaigns = activeCampaigns.filter(c=>realIdShim.has(c.id));

  async function reload() {
    const realIds = [...realIdShim.values()];
    const raw = await fetchScheduleEvents(realIds);
    const byRealId = new Map(activeCampaigns.map(c => [realIdShim.get(c.id), c] as const));
    const resolved: CalEvent[] = [];
    for (const e of raw) {
      const campaign = byRealId.get(e.campaignRealId);
      if (!campaign) continue;
      resolved.push({
        date: new Date(`${e.eventDate}T00:00:00`),
        campaignId: campaign.id,
        campaignName: campaign.name,
        kind: e.kind,
        label: `${campaign.name}: ${e.title}`,
      });
    }
    setEvents(resolved);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [realIdShim]);

  async function handleAddEvent(params: { campaignId: number; kind: EventKind; date: string; title: string }): Promise<{ error: string | null }> {
    const realId = realIdShim.get(params.campaignId);
    if (!realId) return { error: "Campaign not found." };
    const { error } = params.kind === "casting"
      ? await createCasting({ campaignId: realId, eventDate: params.date, title: params.title, createdByProfileId: profile?.id })
      : await createShootDay({ campaignId: realId, eventDate: params.date, description: params.title });
    if (!error) await reload();
    return { error };
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Calendar" sub="Across every active campaign"/>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <CampaignCalendar campaigns={activeCampaigns} addableCampaigns={addableCampaigns} openCampaign={openCampaign} events={events} onAddEvent={handleAddEvent} feedToken={feedToken} onRegenerateFeed={handleRegenerateFeed}/>
      )}
    </div>
  );
}

function Reports() {
  const [running, setRunning] = useState<string|null>(null);
  const reportTypes = [
    { id:"ytd-finance",  label:"YTD Finance Report",       desc:"Total spend, invoices, payments, and budget utilization for the current fiscal year.", icon:BarChart2  },
    { id:"bookings",     label:"Booking Report",            desc:"All bookings by campaign, talent, agency, and date range.", icon:Briefcase     },
    { id:"quarterly",    label:"Quarterly Report",          desc:"Campaign performance, talent pipeline metrics, and spend summary by quarter.", icon:Calendar   },
    { id:"campaigns",    label:"Campaign Report",           desc:"Per-campaign breakdown: submissions, approvals, bookings, and costs.", icon:Camera },
    { id:"contracts",    label:"Contract Report",           desc:"Contract status, execution dates, and signature tracking.", icon:FileCheck    },
    { id:"agencies",     label:"Agency Performance Report", desc:"Submission volume, approval rate, and booking history by agency.", icon:Building2 },
    { id:"declines",     label:"Decline Reasons Report",    desc:"Reasons talent was declined across all campaigns — identify patterns and brief alignment issues.", icon:X },
  ];
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Reports" sub="Generate reports from available data"/>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl">
          <p className="text-sm text-muted-foreground mb-6">Generate reports from any data available in <DvureSignature size={13}/>. Select a report type and configure the date range to export.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reportTypes.map(r=>{
              const RIcon = r.icon;
              const isRunning = running === r.id;
              return (
                <div key={r.id} className="glass-subtle border rounded-md p-5 hover:border-foreground/30 transition-colors">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 bg-secondary border border-border rounded-md flex items-center justify-center shrink-0"><RIcon size={15} className="text-muted-foreground"/></div>
                    <div><div className="text-sm font-semibold">{r.label}</div><div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{r.desc}</div></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <FSelect options={["Last 30 days","This quarter","YTD 2025","Custom range"]}/>
                    <Btn variant={isRunning?"secondary":"primary"} size="sm" onClick={()=>setRunning(isRunning?null:r.id)}>{isRunning?"Close":"Run Report"}</Btn>
                  </div>
                  {isRunning&&(
                    <div className="mt-3 bg-secondary border border-border rounded-md p-3">
                      <div className="text-xs font-mono text-muted-foreground mb-2">Preview — {r.label}</div>
                      <div className="text-xs text-muted-foreground">Report data will appear here once wired to Supabase.</div>
                      <div className="flex gap-2 mt-3">
                        <Btn variant="outline" size="sm" icon={<Download size={11}/>}>Export CSV</Btn>
                        <Btn variant="outline" size="sm" icon={<Download size={11}/>}>Export PDF</Btn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NETWORK ──────────────────────────────────────────────────────────────────

function Network() {
  const [added, setAdded] = useState(["Vantage Model Management","Meridian Models"]);
  const agencies = [
    { name:"Vantage Model Management", loc:"New York · London · Paris", talent:420, bookings:8, spend:"$24,500", lastSub:"2 days ago",  responseRate:"94%", preferred:true  },
    { name:"Meridian Models",             loc:"New York · London · Milan",  talent:380, bookings:5, spend:"$11,100", lastSub:"5 days ago",  responseRate:"87%", preferred:false },
    { name:"Solenne",             loc:"New York · Los Angeles",     talent:210, bookings:2, spend:"$4,400",  lastSub:"12 days ago", responseRate:"76%", preferred:false },
    { name:"Vector Models",             loc:"New York",                   talent:180, bookings:1, spend:"$3,600",  lastSub:"3 days ago",  responseRate:"91%", preferred:false },
  ];
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Network" sub="Agency relationships and partners"/>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Agencies" value="4" sub="3 with active bookings"/>
          <Stat label="Added" value={String(added.length)} sub="Instant campaign alerts"/>
          <Stat label="Submissions" value="44" sub="Across active campaigns"/>
        </div>
        <div className="space-y-2">
          {agencies.map(a=>{
            const isAdded = added.includes(a.name);
            return (
              <div key={a.name} className="glass-subtle border rounded-md p-4 flex items-center gap-4 hover:border-foreground/30">
                <XBox className="w-10 h-10 rounded-md"/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{a.name}</span>
                    {isAdded && <Badge label="Added" variant="info"/>}
                    {a.preferred && <Badge label="Preferred Partner" variant="success"/>}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono flex items-center gap-1"><MapPin size={10}/>{a.loc} · {a.talent} talent</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-muted-foreground font-mono">Last submission: <span className="text-foreground">{a.lastSub}</span></span>
                    <span className="text-[10px] text-muted-foreground font-mono">Response rate: <span className="text-foreground font-semibold">{a.responseRate}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  <div className="text-center hidden md:block"><div className="text-sm font-semibold">{a.bookings}</div><div className="text-xs text-muted-foreground">Bookings</div></div>
                  <div className="text-center hidden md:block"><div className="text-sm font-semibold font-mono">{a.spend}</div><div className="text-xs text-muted-foreground">Spend</div></div>
                  <button onClick={()=>setAdded(p=>isAdded?p.filter(x=>x!==a.name):[...p,a.name])}
                    className={cx("px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
                      isAdded?"bg-foreground text-primary-foreground border-foreground":"border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    )}>{isAdded?"Added":"Add"}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

const NOTIFICATION_CHANNELS = ["Text","Email"];
const NOTIFICATION_TIMING = ["1 week before","3 days before","1 day before","Day of"];

// Checkbox row — reads more explicitly as "pick any number of these" than
// the Chip pill pattern used elsewhere, which is what this multi-select
// specifically needs to communicate.
function CheckRow({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cx("w-full flex items-center gap-3 px-3 py-2.5 rounded-md border text-left cursor-pointer transition-colors",
        checked ? "border-foreground/40 bg-secondary" : "border-border hover:border-foreground/30"
      )}>
      <span className={cx("w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors",
        checked ? "bg-foreground border-foreground" : "border-border bg-input-background"
      )}>
        {checked && <Check size={11} strokeWidth={3} className="text-primary-foreground"/>}
      </span>
      <span className="text-sm">{children}</span>
    </button>
  );
}

// Real, DB-backed — the client-side proof-of-history surface onto
// audit_log (0018) / fetch_org_audit_log (0027). Administrator-only,
// scoped server-side to this org; there is no client-side filter to
// bypass since the RPC itself refuses non-admins and other orgs' rows.
function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load(before?: string) {
    const { entries: fetched, error: err } = await fetchOrgAuditLog(before);
    if (err) { setError(err); setLoading(false); setLoadingMore(false); return; }
    setEntries(prev => before ? [...prev, ...fetched] : fetched);
    setHasMore(fetched.length >= 100);
    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => { load(); }, []);

  function loadMore() {
    if (entries.length === 0) return;
    setLoadingMore(true);
    load(entries[entries.length - 1].occurredAt);
  }

  function exportCsv() {
    const header = ["Timestamp", "Actor", "Email", "Action", "Object Type", "Campaign", "IP Address"];
    const rows = entries.map(e => [
      new Date(e.occurredAt).toISOString(), e.actorName ?? "", e.actorEmail ?? "", e.action,
      e.objectType ?? "", e.campaignName ?? "", e.ipAddress ?? "",
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `dvure-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-heading text-base mb-0.5">Audit Log</h2>
          <p className="text-sm text-muted-foreground">Every recorded action on your organization's account — kept for compliance and legal record-keeping. Administrators only.</p>
        </div>
        <Btn variant="outline" size="sm" icon={<Download size={13}/>} onClick={exportCsv} disabled={entries.length===0}>Export CSV</Btn>
      </div>
      {error && <div className="text-xs text-red-500">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="glass-subtle border border-dashed rounded-md p-10 text-center text-sm text-muted-foreground">No recorded actions yet.</div>
      ) : (
        <div className="glass-subtle border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-secondary text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Time</th>
                <th className="text-left px-4 py-2 font-medium">Actor</th>
                <th className="text-left px-4 py-2 font-medium">Action</th>
                <th className="text-left px-4 py-2 font-medium">Campaign</th>
                <th className="text-left px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <Fragment key={e.id}>
                  <tr className="border-t border-border">
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums">{new Date(e.occurredAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                    <td className="px-4 py-2">{e.actorName ?? "—"}</td>
                    <td className="px-4 py-2 font-mono">{e.action}</td>
                    <td className="px-4 py-2">{e.campaignName ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {(e.previousValue || e.newValue || e.ipAddress || e.userAgent) && (
                        <button onClick={()=>setExpanded(expanded===e.id?null:e.id)} className="text-muted-foreground hover:text-foreground cursor-pointer underline underline-offset-2">
                          {expanded===e.id ? "Hide" : "Details"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded===e.id && (
                    <tr className="border-t border-border bg-secondary/40">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div><div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Before</div><pre className="text-[10px] whitespace-pre-wrap break-all">{e.previousValue ? JSON.stringify(e.previousValue, null, 1) : "—"}</pre></div>
                          <div><div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">After</div><pre className="text-[10px] whitespace-pre-wrap break-all">{e.newValue ? JSON.stringify(e.newValue, null, 1) : "—"}</pre></div>
                        </div>
                        {(e.ipAddress || e.userAgent) && (
                          <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">
                            {e.ipAddress && <>IP {e.ipAddress}</>}{e.ipAddress && e.userAgent && " · "}{e.userAgent}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && entries.length > 0 && (
        <div className="text-center">
          <Btn variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</Btn>
        </div>
      )}
    </div>
  );
}

function SettingsScreen({ onLogout }: { onLogout: () => void }) {
  const user = useCurrentUser();
  const isAdmin = user?.access === "administrator";
  const [tab, setTab] = useState<"profile"|"subscription"|"billing"|"security"|"org"|"notifications"|"audit">("profile");
  const [channels, setChannels] = useState<string[]>(["Email"]);
  const [timing, setTiming] = useState<string[]>(["1 day before","Day of"]);
  const toggle = (arr: string[], val: string, set: (a:string[])=>void) =>
    set(arr.includes(val)?arr.filter(v=>v!==val):[...arr,val]);
  // Subscription and Audit Log are both administrator-only surfaces —
  // one is platform billing, the other is the org's own compliance
  // record, neither is a regular staff member's concern.
  const TABS: [string,string][] = [
    ["profile","Profile"],
    ...(isAdmin ? [["subscription","Subscription"] as [string,string]] : []),
    ["billing","Billing"],
    ["security","Security"],
    ["org","Organization"],
    ["notifications","Notifications"],
    ...(isAdmin ? [["audit","Audit Log"] as [string,string]] : []),
  ];
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Settings" sub={`${user?.org ?? ""} · Account settings`}/>
      <div className="flex-1 flex min-h-0">
        <div className="w-44 shrink-0 border-r glass px-2 py-4 space-y-0.5">
          {TABS.map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id as typeof tab)}
              className={cx("w-full text-left px-3 py-2 text-sm rounded-md cursor-pointer transition-colors",
                tab===id?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}>{label}</button>
          ))}
          <div className="pt-4 border-t border-border mt-4">
            <button onClick={onLogout} className="w-full text-left px-3 py-2 text-sm rounded-md cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center gap-2">
              <LogOut size={13}/> Sign out
            </button>
            <div className="px-3 pt-3 text-[10px] text-muted-foreground leading-relaxed">
              Need help? <span className="text-foreground font-medium">support@dvure.com</span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-8">
          <div className={tab === "audit" ? "max-w-4xl" : "max-w-xl"}>
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
                    <div className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm">{user?.name}</div>
                  </div>
                  <div>
                    <FieldLabel>Title</FieldLabel>
                    {isAdmin
                      ? <TextInput placeholder="Title" defaultValue={user?.title}/>
                      : <div className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-muted-foreground">{user?.title}</div>}
                  </div>
                  <div>
                    <FieldLabel>Organization</FieldLabel>
                    <div className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-muted-foreground">{user?.org}</div>
                  </div>
                  <TextInput label="Email" type="email" placeholder="you@company.com" defaultValue={user?.email}/>
                  <TextInput label="Phone" type="tel" placeholder="+1 000 000 0000" defaultValue={user?.phone}/>
                  <div className="flex justify-end pt-2"><Btn variant="primary">Save Changes</Btn></div>
                </div>
              </div>
            )}
            {tab === "subscription" && (
              <div className="space-y-5">
                <div><h2 className="text-heading text-base mb-0.5">Subscription</h2><p className="text-sm text-muted-foreground">Manage your <DvureWordmark size={11}/> Brand subscription.</p></div>
                <SubscriptionPanel/>
              </div>
            )}
            {tab === "billing" && (
              <div className="space-y-5">
                <div><h2 className="text-heading text-base mb-0.5">Billing</h2><p className="text-sm text-muted-foreground">Payment methods and billing history.</p></div>
                <div className="bg-secondary border border-border rounded-md px-4 py-3 text-xs text-muted-foreground">Billing is processed securely by Stripe — wired in Milestone C.</div>
              </div>
            )}
            {tab === "security" && (
              <div className="space-y-5">
                <div><h2 className="text-heading text-base mb-0.5">Security</h2><p className="text-sm text-muted-foreground">Manage access and authentication settings.</p></div>
                {[{label:"Change password",action:"Update"},{label:"Two-factor authentication",action:"Enable"}].map(item=>(
                  <div key={item.label} className="glass-subtle border rounded-md px-4 py-3 flex items-center justify-between">
                    <div className="text-sm font-medium">{item.label}</div>
                    <Btn variant="outline" size="sm">{item.action}</Btn>
                  </div>
                ))}
              </div>
            )}
            {tab === "org" && (
              <div className="space-y-5">
                <div><h2 className="text-heading text-base mb-0.5">Organization</h2><p className="text-sm text-muted-foreground">Manage your brand profile.</p></div>
                <div className="bg-secondary border border-border rounded-md px-4 py-3 text-xs text-muted-foreground">
                  Organization names can't be changed here once set — contact <span className="text-foreground font-medium">support@dvure.com</span> for a rename.
                </div>
                <div className="space-y-3">
                  <div>
                    <FieldLabel>Organization Name</FieldLabel>
                    <div className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-muted-foreground">{user?.org}</div>
                  </div>
                </div>
              </div>
            )}
            {tab === "notifications" && (
              <div className="space-y-6">
                <div><h2 className="text-heading text-base mb-0.5">Notifications</h2><p className="text-sm text-muted-foreground">Choose how and when you're notified about upcoming payment due dates. Check as many as you'd like.</p></div>
                <div className="space-y-2">
                  <FieldLabel>Delivery method</FieldLabel>
                  <div className="space-y-1.5">
                    {NOTIFICATION_CHANNELS.map(c=>(
                      <CheckRow key={c} checked={channels.includes(c)} onClick={()=>toggle(channels,c,setChannels)}>{c}</CheckRow>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Remind me</FieldLabel>
                  <div className="space-y-1.5">
                    {NOTIFICATION_TIMING.map(t=>(
                      <CheckRow key={t} checked={timing.includes(t)} onClick={()=>toggle(timing,t,setTiming)}>{t}</CheckRow>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end pt-2"><Btn variant="primary">Save Changes</Btn></div>
              </div>
            )}
            {tab === "audit" && <AuditLogPanel/>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function BrandApp({ onLogout }: { onLogout: () => void }) {
  const { profile, org } = useAuth();
  const navigate = useNavigate();
  const { id: campaignIdParam } = useParams<{ id?: string }>();
  const activeCampaignId = campaignIdParam ? Number(campaignIdParam) : null;
  const [view, setView] = useState<AppView>("campaigns");
  const [globalNav, setGlobalNav] = useState<GlobalView>("campaigns");
  const [campaignSection, setCampaignSection] = useState<CampaignSection>("moodboard");
  const [activityOpen, setActivityOpen] = useState(false);
  const activityRef = useRef<HTMLDivElement>(null);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const attentionRef = useRef<HTMLDivElement>(null);

  const [realCampaigns, setRealCampaigns] = useState<Campaign[]>([]);
  const [realIdShim, setRealIdShim] = useState<Map<number, string>>(new Map());
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [leadsNeededRaw, setLeadsNeededRaw] = useState<CampaignNeedingLeads[]>([]);
  const [campaignsUpdatedAt, setCampaignsUpdatedAt] = useState<number>(Date.now());
  // A real signed-in brand only ever sees its own real campaigns — the 5
  // legacy placeholder campaigns (CAMPAIGNS) used to be merged in
  // unconditionally, which meant every real account saw fake campaigns
  // mixed into their real list, including name collisions with their
  // own real campaigns (confirmed directly: a real "AW25 Womenswear
  // Campaign" and the placeholder one of the same name, side by side).
  // Direct decision to drop the merge now that real campaign creation
  // exists and this account has real campaigns of its own.
  const allCampaigns = realCampaigns;

  async function refetchCampaigns() {
    if (!org) return null;
    const { campaigns: fetched, realIdShim: shim } = await fetchBrandCampaigns(org.id);
    setRealCampaigns(fetched);
    setRealIdShim(shim);
    setCampaignsLoading(false);
    setCampaignsUpdatedAt(Date.now());
    fetchCampaignsNeedingLeads(org.id).then(setLeadsNeededRaw);
    return shim;
  }

  useEffect(() => {
    if (org) refetchCampaigns();
  }, [org?.id]);

  // Quiet background refresh — stands in for the removed header Refresh
  // button. Silent (no loading flash), just keeps the list and the
  // "Updated Xm ago" indicator honest without the user doing anything.
  useEffect(() => {
    if (!org) return;
    const id = setInterval(() => { refetchCampaigns(); }, 90_000);
    return () => clearInterval(id);
  }, [org?.id]);

  // Real campaign UUIDs mapped to the synthetic shim id routing already
  // uses everywhere else — a campaign not yet reflected in the shim
  // (freshly created, refetch still in flight) is dropped rather than
  // shown with a dead link.
  const leadsNeeded = leadsNeededRaw
    .map(l => ({ ...l, shimId: [...realIdShim.entries()].find(([, v]) => v === l.campaignId)?.[0] }))
    .filter((l): l is CampaignNeedingLeads & { shimId: number } => l.shimId != null);

  useEffect(() => {
    if (!activityOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (activityRef.current && !activityRef.current.contains(e.target as Node)) setActivityOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [activityOpen]);

  // Hoisted above the campaigns-list/workspace split (not owned by
  // CampaignsList) so it stays visible everywhere in the brand app,
  // including inside a campaign — attention items are cross-campaign by
  // nature, so the widget shouldn't disappear just because you opened one.
  useEffect(() => {
    if (!attentionOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (attentionRef.current && !attentionRef.current.contains(e.target as Node)) setAttentionOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [attentionOpen]);

  function openCampaign(id: number) {
    // Casting Board is now just one tab among several for every type —
    // always land on Submissions first, same as everyone else.
    setCampaignSection("moodboard");
    navigate(`/brand/campaigns/${id}`);
  }
  function openCampaignCallSheet(id: number) {
    // Jumps here from an attention reminder about unfilled roles —
    // that's assignment work, which now lives on Crew, not the
    // read-only Call Sheet tab.
    setCampaignSection("crew");
    navigate(`/brand/campaigns/${id}`);
  }
  function backToCampaigns() { setGlobalNav("campaigns"); navigate("/brand"); if (org) fetchCampaignsNeedingLeads(org.id).then(setLeadsNeededRaw); }
  function handleGlobalNav(v: GlobalView) { setGlobalNav(v); setView(v); navigate("/brand"); }

  async function handleCampaignCreated(realId: string) {
    const shim = await refetchCampaigns();
    const shimId = shim ? [...shim.entries()].find(([, v]) => v === realId)?.[0] : undefined;
    setView("campaigns");
    navigate(shimId != null ? `/brand/campaigns/${shimId}` : "/brand");
  }

  if (activeCampaignId != null && campaignsLoading) {
    return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <CurrentUserProvider user={{ name:profile?.fullName ?? "", title:org?.title ?? "", org:org?.name ?? "", email:profile?.email ?? "", phone:profile?.phone ?? "", access:org?.accessLevel ?? "basic", onSettings:()=>handleGlobalNav("settings") }}>
      <div className="h-screen flex bg-background overflow-hidden">
        {activeCampaignId != null ? (
          <CampaignWorkspace campaigns={allCampaigns} realIdShim={realIdShim} campaignId={activeCampaignId} section={campaignSection} onSection={setCampaignSection} onBack={backToCampaigns} onNewCampaign={()=>{ setView("create-campaign"); navigate("/brand"); }} onHome={()=>handleGlobalNav("campaigns")} onArchived={async()=>{ await refetchCampaigns(); backToCampaigns(); }}/>
        ) : (
          <>
            <BrandSidebar active={globalNav} onNav={handleGlobalNav} onLogout={onLogout}/>
            <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {view==="campaigns"        && <CampaignsList campaigns={allCampaigns} openCampaign={openCampaign} onNewCampaign={()=>{ setView("create-campaign"); navigate("/brand"); }} updatedAt={campaignsUpdatedAt}/>}
              {view==="schedule"         && <ScheduleScreen campaigns={allCampaigns} realIdShim={realIdShim} openCampaign={openCampaign}/>}
              {view==="create-campaign"  && <CreateCampaign onBack={()=>setView("campaigns")} onCreated={handleCampaignCreated}/>}
              {view==="contracts-global" && <GlobalContracts/>}
              {view==="payments-global"  && <GlobalPayments/>}
              {view==="messaging"        && <MessagingScreen/>}
              {view==="directory"        && <DirectoryScreen/>}
              {view==="reports"          && <Reports/>}
              {view==="settings"         && <SettingsScreen onLogout={onLogout}/>}
              {view==="network"          && <Network/>}
            </main>
          </>
        )}

        {/* Button stays put and persists when its panel is open — click
            toggles rather than the button being swapped out for the
            panel — and the panel opens to the button's side (flex-row,
            panel first) so it never covers the button, or the Needs
            Attention button stacked above it. */}
        <div ref={activityRef} className="fixed bottom-6 right-6 z-40 flex items-end gap-3">
          {activityOpen && <ActivityFeedPanel onClose={()=>setActivityOpen(false)}/>}
          <button onClick={()=>setActivityOpen(o=>!o)} className="w-10 h-10 bg-foreground text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:bg-foreground/90 transition-colors cursor-pointer shrink-0">
            <List size={16}/>
          </button>
        </div>

        {/* Needs Attention — stacked directly above the Activity widget in
            the same bottom-right corner. Lives here (not in CampaignsList)
            so it stays visible inside a campaign too. Absorbed the real,
            DB-derived "leads needed" alert when the standalone Pending
            Review nav page was removed — this floating widget was already
            the one place surfacing this class of alert everywhere, so it's
            the natural home rather than a page of its own. */}
        <div ref={attentionRef} className="fixed bottom-20 right-6 z-40 flex items-end gap-3">
          {attentionOpen && (
            <div className="w-80 glass-strong border rounded-md shadow-xl overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle size={13} className="text-foreground shrink-0"/>
                  <span className="text-xs font-semibold">Needs Attention</span>
                  <span className="text-[10px] font-mono bg-foreground text-primary-foreground px-1.5 py-0.5 rounded-sm">{CAMPAIGNS_ATTENTION.length + leadsNeeded.length}</span>
                </div>
                <button onClick={()=>setAttentionOpen(false)} className="text-muted-foreground hover:text-foreground w-5 h-5 flex items-center justify-center rounded hover:bg-secondary transition-colors cursor-pointer">
                  <X size={13}/>
                </button>
              </div>
              <div className="divide-y divide-border">
                {leadsNeeded.map(l=>(
                  <div key={`leads-${l.campaignId}`} className="px-4 py-3 flex items-center gap-3 bg-muted/30">
                    <Star size={14} className="text-foreground shrink-0"/>
                    <span className="flex-1 text-sm">{l.campaignName} — {l.filledCount} filled role{l.filledCount===1?"":"s"}, no department lead assigned yet.</span>
                    <button onClick={()=>{ openCampaignCallSheet(l.shimId); setAttentionOpen(false); }}
                      className="text-xs font-medium px-3 py-1.5 rounded-md border shrink-0 transition-colors cursor-pointer bg-foreground text-primary-foreground border-foreground hover:bg-foreground/90">
                      Pick leads
                    </button>
                  </div>
                ))}
                {CAMPAIGNS_ATTENTION.map((a,i)=>(
                  <div key={i} className={cx("px-4 py-3 flex items-center gap-3", a.urgent&&"bg-muted/30")}>
                    <a.Icon size={14} className="text-foreground shrink-0"/>
                    <span className="flex-1 text-sm">{a.msg}</span>
                    <button onClick={()=>{ openCampaign(a.campaignId); setAttentionOpen(false); }}
                      className={cx("text-xs font-medium px-3 py-1.5 rounded-md border shrink-0 transition-colors cursor-pointer",
                        a.urgent?"bg-foreground text-primary-foreground border-foreground hover:bg-foreground/90":"border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                      )}>{a.action}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={()=>setAttentionOpen(o=>!o)}
            className="relative w-10 h-10 bg-foreground text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:bg-foreground/90 transition-colors cursor-pointer shrink-0">
            <AlertCircle size={16}/>
            {(CAMPAIGNS_ATTENTION.length + leadsNeeded.length) > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#C0392B] text-white text-[9px] font-mono font-semibold flex items-center justify-center">
                {CAMPAIGNS_ATTENTION.length + leadsNeeded.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </CurrentUserProvider>
  );
}
