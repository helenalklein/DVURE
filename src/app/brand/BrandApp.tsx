import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LayoutDashboard, Plus, ChevronRight, ChevronDown, ChevronLeft,
  X, Check, Star, Search, Briefcase,
  AlertCircle, Camera,
  MessageSquare, Download, CreditCard, MapPin,
  Settings, Building2, Shield,
  Calendar, FileText, Activity, List, BookOpen,
  BarChart2, FileCheck, Send, Edit3, Eye, ChevronUp,
  User, LogOut, Pin, Lock, Globe, Shirt, Home, Radio
} from "lucide-react";
import type { SubmissionStage, Talent, IconFn, CardComment, Campaign, CastingStageId, CastingEntry, Look, CampaignThreadMessage } from "../shared/types";
import { cx, XBox, UserAvatar, PolaroidIcon, Badge, Btn, Stat, FieldLabel, TextInput, FSelect, Textarea, Chip, SidebarBadge, TopBar, ActivityFeedPanel, CurrentUserProvider, useCurrentUser, Modal, CountryFlag, DvureSignature, DvureWordmark, DvureMark } from "../shared/ui";
import { SAMPLE_TALENT, PIPELINE_STAGES, DECLINE_REASONS, ORG_USERS, ACCESS_BADGE, ACTIVITY_EVENTS, CARD_COMMENTS, CAMPAIGNS, RUNWAY_SHOWS, RUNWAY_SHOW_OTHER_BRANDS, CASTING_STAGES, CASTING_ENTRIES, CREW, LOOKS, MOCK_NOW, CAMPAIGN_AGENCIES, CAMPAIGN_AGENCY_THREADS, ORG_COUNTRY } from "../shared/mockData";
import { useAuth } from "../shared/auth";
import { fetchPartneredAgencies, fetchBrandCampaigns, createCampaign, distributeCampaignToAgencies } from "../../lib/queries/campaigns";
import { fetchCampaignSubmissions, updateSubmissionStage, type SubmissionShim } from "../../lib/queries/submissions";
import { fetchSubmissionComments, insertSubmissionComment } from "../../lib/queries/comments";
import RelayConsole from "./relay/RelayConsole";

type GlobalView = "campaigns" | "urgent" | "contracts-global" | "payments-global" | "messaging" | "reports" | "network" | "directory" | "settings";
type AppView = GlobalView | "campaign" | "create-campaign" | "relay";
type CampaignSection = "overview" | "moodboard" | "casting" | "looks" | "requirements" | "deliverables" | "contracts" | "bookings" | "activity" | "collaboration" | "users";

const PARTNERED_AGENCIES = ["Elite Model Management","IMG Models","Wilhelmina","DNA Models"];

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
            {[["Day Rate", talent.rate],["Agency Commission","20%"],["Territory","United States"],["Duration","1 year"]].map(([k,v])=>(
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
  { id:"campaigns",        label:"Campaigns",  Icon:Camera                },
  { id:"urgent",           label:"Tasks",      Icon:ExclamationIcon        },
  { id:"contracts-global", label:"Contracts",  Icon:FileCheck              },
  { id:"payments-global",  label:"Payments",   Icon:CreditCard             },
  { id:"messaging",        label:"Messaging",  Icon:MessageSquare          },
  { id:"reports",          label:"Reports",    Icon:BarChart2              },
  { id:"network",          label:"Network",    Icon:Building2              },
  { id:"directory",        label:"Directory",  Icon:User                   },
];

function BrandSidebar({ active, onNav, onOpenCampaign, onLogout }: {
  active: GlobalView; onNav: (v: GlobalView) => void; onOpenCampaign: (id: number) => void; onLogout: () => void;
}) {
  const currentUser = useCurrentUser();
  const orgName = currentUser?.org ?? "";
  const urgentCount = CAMPAIGNS_ATTENTION.filter(a=>a.urgent).length;
  return (
    <aside className="w-52 shrink-0 glass border-r flex flex-col h-full">
      <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
        <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center shrink-0">
          <span className="text-primary-foreground text-xs font-bold">{orgName.trim()[0]?.toUpperCase() ?? "?"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate flex items-center gap-1.5">{orgName} <CountryFlag country={ORG_COUNTRY[orgName]} className="text-xs"/></div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Brand</div>
        </div>
        <button onClick={()=>onNav("campaigns")} title="Campaigns"
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
          <Home size={15}/>
        </button>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {GLOBAL_NAV.map(item => {
          const NavIcon = item.Icon;
          return (
            <button key={item.id} onClick={() => onNav(item.id)}
              className={cx("w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left",
                active===item.id?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}>
              <NavIcon size={15}/>{item.label}
              {item.id==="urgent" && urgentCount>0 && <SidebarBadge count={urgentCount}/>}
            </button>
          );
        })}
      </nav>
      <div className="px-3 pb-3 border-t border-border pt-3">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2 px-2">Recent</div>
        {[{id:1,name:"AW25 Womenswear"},{id:2,name:"SS25 Fragrance"},{id:3,name:"Resort Lookbook"},{id:5,name:"AW26 Runway"}].map(c => (
          <button key={c.id} onClick={()=>onOpenCampaign(c.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-left">
            <Camera size={11}/><span className="truncate">{c.name}</span>
          </button>
        ))}
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
  { id:"moodboard",     label:"Submissions",   Icon:PolaroidIcon    },
  { id:"requirements",  label:"Requirements",  Icon:BookOpen        },
  { id:"deliverables",  label:"Deliverables",  Icon:Calendar        },
  { id:"contracts",     label:"Contracts",     Icon:FileCheck       },
  { id:"bookings",      label:"Bookings",      Icon:Briefcase       },
  { id:"activity",      label:"Activity",      Icon:Activity        },
  { id:"collaboration", label:"Collaboration", Icon:MessageSquare   },
  { id:"users",         label:"Users",         Icon:User            },
];

// Runway campaigns swap the generic Submissions board for a day-of
// Casting Board and gain a Looks tab — everything else (Requirements,
// Deliverables, Contracts, ...) stays the same for now.
function campaignNavFor(type: Campaign["type"]): { id: CampaignSection; label: string; Icon: IconFn }[] {
  if (type !== "Runway") return CAMPAIGN_NAV_BASE;
  return CAMPAIGN_NAV_BASE.map(item => item.id==="moodboard" ? { id:"casting" as CampaignSection, label:"Casting Board", Icon:Check } : item)
    .flatMap(item => item.id==="requirements" ? [{ id:"looks" as CampaignSection, label:"Looks", Icon:Shirt }, item] : [item]);
}

function CampaignSidebar({ campaign, section, onSection, onBack, onNewCampaign, onHome, onOpenRelay, counts, fullExtensionUntil }: {
  campaign: Campaign; section: CampaignSection; onSection: (s: CampaignSection) => void;
  onBack: () => void; onNewCampaign: () => void; onHome: () => void; onOpenRelay: () => void; counts: Record<string,number>; fullExtensionUntil?: string;
}) {
  const currentUser = useCurrentUser();
  const orgName = currentUser?.org ?? "";
  const nav = campaignNavFor(campaign.type);
  const effectiveClose = fullExtensionUntil && new Date(fullExtensionUntil) > new Date(campaign.submissionClose) ? fullExtensionUntil : campaign.submissionClose;
  return (
    <aside className="w-52 shrink-0 glass border-r flex flex-col h-full">
      <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
        <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center shrink-0">
          <span className="text-primary-foreground text-xs font-bold">{orgName.trim()[0]?.toUpperCase() ?? "?"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate flex items-center gap-1.5">{orgName} <CountryFlag country={ORG_COUNTRY[orgName]} className="text-xs"/></div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Brand</div>
        </div>
        <button onClick={onHome} title="Campaigns"
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
          <Home size={15}/>
        </button>
      </div>
      <div className="px-3 pt-3 pb-2">
        <button onClick={onBack} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors text-left">
          <ChevronLeft size={13}/> All Campaigns
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
      {campaign.type==="Runway" && (
        <div className="px-3 pt-3 border-t border-border">
          <button onClick={onOpenRelay}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-foreground text-primary-foreground text-xs font-medium rounded-md hover:bg-foreground/90 transition-colors cursor-pointer">
            <Radio size={13}/> Open Relay
          </button>
          <div className="text-[9px] text-muted-foreground text-center mt-1.5">Live show-day operations</div>
        </div>
      )}
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

function Moodboard({ talent, setTalent, comments, onPostComment, onContractPrompt, onViewAgency }: {
  talent: Talent[]; setTalent: (fn: (prev: Talent[]) => Talent[]) => void; comments: CardComment[]; onPostComment: (talentId: number, text: string) => void; onContractPrompt: (t: Talent) => void; onViewAgency: (agency: string) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
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
    const prev = talent.find(t => t.id === id);
    if (!prev) return;
    const prevStage = prev.stage;
    moveTo(id, newStage);
    if (newStage === "approved") onContractPrompt({ ...prev, stage: newStage });
    showToast(`${prev.name} moved to ${label}`, () => moveTo(id, prevStage));
  }

  function bulkMove(ids: number[], newStage: SubmissionStage, label: string) {
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
                            <XBox className="w-full h-32"/>
                            <div className={cx("absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",isSel?"bg-foreground border-foreground":"bg-card/80 border-border")}>
                              {isSel&&<Check size={11} className="text-primary-foreground"/>}
                            </div>
                          </div>
                          <div className="p-2.5 space-y-0.5">
                            <div className="text-xs font-semibold leading-tight truncate flex items-center gap-1">
                              {t.name} <CountryFlag location={t.location} className="text-[11px] shrink-0"/>
                            </div>
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
                <XBox className="w-full h-36 rounded-md"/>
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
    </div>
  );
}

// ─── RUNWAY: CASTING BOARD ──────────────────────────────────────────────────
// Day-of checklist, not a drag pipeline — a model can be fitting-complete
// before another is even optioned, so every stage is independently
// toggleable per model rather than columns you move cards between.

function CastingBoard({ campaign }: { campaign: Campaign }) {
  const [entries, setEntries] = useState<CastingEntry[]>(() => CASTING_ENTRIES.filter(e=>e.campaignId===campaign.id));
  const show = RUNWAY_SHOWS.find(s=>s.id===campaign.runwayShowId);
  const otherBrands = campaign.runwayShowId ? RUNWAY_SHOW_OTHER_BRANDS[campaign.runwayShowId] ?? [] : [];

  function toggleStage(modelId: number, stageId: CastingStageId) {
    setEntries(prev => prev.map(e => e.modelId===modelId ? { ...e, stages: { ...e.stages, [stageId]: !e.stages[stageId] } } : e));
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl space-y-4">
        {show && (
          <div className="glass-subtle border rounded-md p-4 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">{show.season} · {show.name}</div>
              <div className="text-sm font-semibold">{show.venue}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{show.date} · {show.time} {show.timeZone}</div>
            </div>
            {otherBrands.length>0 && (
              <div className="text-right">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Also on this show</div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {otherBrands.map(b=><Badge key={b} label={b} variant="default"/>)}
                </div>
              </div>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground">Day-of casting checklist — toggle each stage as models move through it. Stages don't have to complete in order.</p>
        <div className="glass-subtle border rounded-md overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-mono text-muted-foreground whitespace-nowrap">Model</th>
                {CASTING_STAGES.map(s=>(
                  <th key={s.id} className="px-2 py-2.5 text-center text-[9px] font-mono text-muted-foreground uppercase leading-tight w-16">{s.label}</th>
                ))}
                <th className="px-4 py-2.5 text-right text-xs font-mono text-muted-foreground whitespace-nowrap">Progress</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e=>{
                const model = SAMPLE_TALENT.find(t=>t.id===e.modelId);
                const doneCount = CASTING_STAGES.filter(s=>e.stages[s.id]).length;
                return (
                  <tr key={e.modelId} className="border-b border-border last:border-0 hover:bg-secondary/60">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{model?.name ?? `Model #${e.modelId}`}</td>
                    {CASTING_STAGES.map(s=>(
                      <td key={s.id} className="px-2 py-3 text-center">
                        <button onClick={()=>toggleStage(e.modelId, s.id)} title={s.label}
                          className={cx("w-5 h-5 rounded-sm border flex items-center justify-center mx-auto transition-colors cursor-pointer",
                            e.stages[s.id] ? "bg-foreground border-foreground text-primary-foreground" : "border-border text-transparent hover:border-foreground/50"
                          )}>
                          <Check size={11}/>
                        </button>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-xs font-mono whitespace-nowrap">{doneCount}/{CASTING_STAGES.length}</td>
                  </tr>
                );
              })}
              {entries.length===0 && (
                <tr><td colSpan={CASTING_STAGES.length+2} className="px-4 py-10 text-center text-sm text-muted-foreground">No models cast yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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

function CampaignWorkspace({ campaigns, realIdShim, campaignId, section, onSection, onBack, onNewCampaign, onHome, onOpenRelay }: {
  campaigns: Campaign[]; realIdShim: Map<number, string>; campaignId: number; section: CampaignSection; onSection: (s: CampaignSection) => void; onBack: () => void; onNewCampaign: () => void; onHome: () => void; onOpenRelay: () => void;
}) {
  const { profile, org } = useAuth();
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

  const campaign = campaigns.find(c=>c.id===campaignId);

  useEffect(() => {
    let active = true;
    const realId = realIdShim.get(campaignId) ?? null;
    setRealCampaignId(realId);
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

  if (!campaign) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground gap-2">
        Campaign not found.
        <button onClick={onHome} className="underline cursor-pointer">Back to campaigns</button>
      </div>
    );
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

  return (
    <>
      <CampaignSidebar campaign={campaign} section={section} onSection={onSection} onBack={onBack} onNewCampaign={onNewCampaign} onHome={onHome} onOpenRelay={onOpenRelay} counts={counts} fullExtensionUntil={fullExtensionUntil||undefined}/>
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
                  {[["Submitted",counts.submitted],["Approved",counts.approved],["Booked",counts.booked]].map(([l,v])=>(
                    <div key={String(l)} className={cx("border rounded-md p-3 text-center cursor-pointer hover:border-foreground/40", String(l)==="Booked"&&Number(v)>0?"bg-foreground border-foreground":"glass-subtle")} onClick={()=>onSection("moodboard")}>
                      <div className={cx("text-xl font-semibold tabular-nums", String(l)==="Booked"&&Number(v)>0?"text-primary-foreground":"")}>{String(v)}</div>
                      <div className={cx("text-[10px] font-mono mt-0.5", String(l)==="Booked"&&Number(v)>0?"text-primary-foreground/70":"text-muted-foreground")}>{String(l)}</div>
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

          {section==="moodboard" && <Moodboard talent={talent} setTalent={persistingSetTalent} comments={comments} onPostComment={handlePostComment} onContractPrompt={t=>setContractModal(t)} onViewAgency={setViewingAgency}/>}

          {section==="casting" && <CastingBoard campaign={campaign}/>}

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

          {section==="deliverables" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-heading text-sm">Deliverables</h2>
                  <Badge label="Editable" variant="info"/>
                </div>
                <div className="glass-subtle border rounded-md p-5 space-y-4">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Shoot Schedule</div>
                  {[["Mon 07/14","08:00–18:00","James Whitfield + Amara Diallo","Hero shots — Studio 9, NYC"],
                    ["Tue 07/15","09:00–17:00","Amara Diallo","Close-up editorial"]].map((d,i)=>(
                    <div key={i} className="border border-border rounded-md p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <TextInput placeholder="Date" defaultValue={d[0]}/>
                        <TextInput placeholder="Hours" defaultValue={d[1]}/>
                      </div>
                      <TextInput placeholder="Talent" defaultValue={d[2]}/>
                      <TextInput placeholder="Description" defaultValue={d[3]}/>
                    </div>
                  ))}
                  <button className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-4 py-2 w-full flex items-center justify-center gap-1 hover:border-foreground">
                    <Plus size={12}/> Add shoot day
                  </button>
                </div>
                <div className="flex justify-end"><Btn variant="primary" icon={<Check size={13}/>}>Save Deliverables</Btn></div>
              </div>
            </div>
          )}

          {section==="contracts" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-heading text-sm">Contracts</h2>
                  <Btn variant="primary" size="sm" icon={<Plus size={13}/>}>Generate Contract</Btn>
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
                      <div className="flex gap-1">
                        <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md" title="View"><Eye size={13}/></button>
                        <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md" title="Open PDF"><Download size={13}/></button>
                        {c[2]==="Draft — Not Sent"&&<button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md" title="Edit & Send"><Send size={13}/></button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section==="bookings" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl space-y-3">
                <p className="text-xs text-muted-foreground mb-4">Bookings originate from this campaign's approved submissions.</p>
                {talent.filter(t=>t.stage==="booked").map(t=>(
                  <div key={t.id} className="glass-subtle border border-foreground/20 rounded-md p-4 flex items-center gap-4">
                    <XBox className="w-14 h-[72px] rounded-sm shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="text-sm font-semibold">{t.name}</div>
                        <Badge label="Booked" variant="active"/>
                      </div>
                      <div className="text-xs text-muted-foreground">{t.agency} · {t.rate}</div>
                      {t.note&&<div className="text-xs text-muted-foreground italic mt-1">{t.note}</div>}
                    </div>
                    <div className="flex gap-2">
                      <Btn variant="outline" size="sm" icon={<FileText size={11}/>}>Contract</Btn>
                      <Btn variant="ghost" size="sm" icon={<MessageSquare size={11}/>}>Message</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {section==="users" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-heading text-sm">Campaign Users</h2>
                  <Btn variant="outline" size="sm" icon={<Plus size={12}/>}>Add / Remove</Btn>
                </div>
                <div className="space-y-2 mb-5">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Brand</div>
                  {ORG_USERS.filter(u=>u.org===(org?.name ?? "")).slice(0,4).map(u=>(
                    <div key={u.id} className="glass-subtle border rounded-md px-4 py-3 flex items-center gap-3">
                      <UserAvatar name={u.name} className="w-7 h-7 text-[10px]"/>
                      <div className="flex-1 min-w-0"><div className="text-sm font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.title}</div></div>
                      <Badge label={u.access} variant={ACCESS_BADGE[u.access]}/>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Agency</div>
                  {ORG_USERS.filter(u=>u.org!==(org?.name ?? "")).map(u=>(
                    <div key={u.id} className="glass-subtle border rounded-md px-4 py-3 flex items-center gap-3">
                      <UserAvatar name={u.name} className="w-7 h-7 text-[10px]"/>
                      <div className="flex-1 min-w-0"><div className="text-sm font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.title} · {u.org}</div></div>
                      <Badge label={u.access} variant={ACCESS_BADGE[u.access]}/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          </>)}
        </div>
      </div>

      {contractModal && <ContractModal talent={contractModal} onSend={()=>setContractModal(null)} onLater={()=>setContractModal(null)}/>}
      {showExtendModal && (
        <ExtendSubmissionModal campaign={campaign} onClose={()=>setShowExtendModal(false)}
          onGrant={ext=>{ setExtensions(prev=>[...prev, ext]); setShowExtendModal(false); }}/>
      )}
    </>
  );
}

// ─── COLLABORATION ───────────────────────────────────────────────────────────

type CollabScope = "internal" | "agency";

// Every agency distributed on a campaign gets its own private thread with
// the brand — two agencies never see each other's messages. Models get
// read-only access to their own agency's thread elsewhere in the app.
// The one exception: a "Send Update to All Agencies" broadcast, which
// posts the same message into every agency's thread at once, for
// logistics changes (call time, location) that need to reach everyone
// without opening up cross-agency visibility for normal conversation.
function CollaborationTab({ campaign, focusAgency, onFocusAgencyHandled }: {
  campaign: Campaign; focusAgency: string | null; onFocusAgencyHandled: () => void;
}) {
  const currentUser = useCurrentUser();
  const meName = currentUser?.name ?? "";
  const meOrg = currentUser?.org ?? "";
  const agencies = CAMPAIGN_AGENCIES[campaign.id] ?? [];
  const [scope, setScope] = useState<CollabScope>("internal");
  const [selectedAgency, setSelectedAgency] = useState(agencies[0] ?? "");
  const [threads, setThreads] = useState<Record<string, CampaignThreadMessage[]>>(
    () => CAMPAIGN_AGENCY_THREADS[campaign.id] ?? {}
  );
  const [internalMsgs, setInternalMsgs] = useState([
    { id:1, from:"Priya Anand", text:"Mood board direction is locked — sharing the deck before we brief the agencies.", ts:"Jun 18, 4:10 PM" },
    { id:2, from:"Marcus Webb", text:"Nice. Let's hold final budget sign-off until Priya confirms the number.", ts:"Jun 18, 4:22 PM" },
    { id:3, from:"Priya Anand", text:"Confirmed — $18,000 total, $5,150 committed so far.", ts:"Jun 18, 4:30 PM" },
  ]);
  const [input, setInput] = useState("");
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");

  useEffect(() => {
    if (focusAgency) {
      setScope("agency");
      setSelectedAgency(focusAgency);
      onFocusAgencyHandled();
    }
  }, [focusAgency]);

  const isInternal = scope === "internal";
  const agencyMsgs = threads[selectedAgency] ?? [];

  function send() {
    if (!input.trim()) return;
    if (isInternal) {
      setInternalMsgs(p=>[...p,{ id:Date.now(), from:meName, text:input, ts:"Now" }]);
    } else {
      setThreads(p=>({ ...p, [selectedAgency]: [...(p[selectedAgency]??[]), { id:Date.now(), from:meName, fromOrg:meOrg, text:input, ts:"Now" }] }));
    }
    setInput("");
  }

  function sendBroadcast() {
    if (!broadcastText.trim()) return;
    setThreads(prev => {
      const next = { ...prev };
      for (const a of agencies) {
        const msg: CampaignThreadMessage = { id:Date.now()+Math.random(), from:meName, fromOrg:meOrg, text:broadcastText, ts:"Now", broadcast:true };
        next[a] = [...(next[a]??[]), msg];
      }
      return next;
    });
    setBroadcastText("");
    setShowBroadcast(false);
  }

  return (
    <div className="flex-1 flex min-h-0">
      <div className="w-48 shrink-0 border-r border-border overflow-y-auto">
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
              !isInternal && selectedAgency===a?"bg-secondary text-foreground":"text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}>
            <Globe size={11} className="shrink-0"/> <span className="truncate">{a}</span> <CountryFlag country={ORG_COUNTRY[a]} className="text-[11px] shrink-0"/>
          </button>
        ))}
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-2.5 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <div className="text-xs font-semibold">{isInternal ? `${meOrg} — Internal` : `${campaign.name} — ${selectedAgency}`}</div>
            <div className="text-[10px] text-muted-foreground">
              {isInternal ? `Visible only to ${meOrg}` : `Private to ${meOrg} + ${selectedAgency} — no other agency can see this`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isInternal && <Btn variant="outline" size="sm" onClick={()=>setShowBroadcast(true)}>Send Update to All Agencies</Btn>}
            <Badge label={isInternal ? "Internal" : "Private thread"} variant={isInternal ? "draft" : "info"}/>
          </div>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {(isInternal ? internalMsgs : agencyMsgs).length===0 && (
            <div className="text-xs text-muted-foreground italic">No messages yet.</div>
          )}
          {(isInternal ? internalMsgs : agencyMsgs).map(m => {
            const isMe = m.from === meName;
            return (
              <div key={m.id} className={cx("flex flex-col gap-1", isMe && "items-end")}>
                {"broadcast" in m && m.broadcast && (
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
          <div className="flex gap-3 items-end">
            <textarea value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); }}}
              placeholder={isInternal ? "Message your team…" : `Message ${selectedAgency}…`} rows={2}
              className="flex-1 bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none placeholder:text-muted-foreground"/>
            <button onClick={send} className="p-2.5 bg-foreground hover:bg-foreground/90 text-primary-foreground rounded-md transition-colors cursor-pointer shrink-0">
              <Send size={15}/>
            </button>
          </div>
        </div>
      </div>

      {showBroadcast && (
        <Modal onClose={()=>setShowBroadcast(false)} maxWidth="max-w-md">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="text-heading text-sm">Send Update to All Agencies</div>
            <button onClick={()=>setShowBroadcast(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
          </div>
          <div className="p-5 space-y-3">
            <div className="text-xs text-muted-foreground">
              Sent once, delivered into every agency's private thread on this campaign ({agencies.length} agenc{agencies.length===1?"y":"ies"}). Their models will see it too.
            </div>
            <Textarea label="Message" placeholder="e.g. Call time moved to 8am — please notify your talent." value={broadcastText} onChange={e=>setBroadcastText(e.target.value)} rows={4}/>
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <Btn variant="primary" disabled={!broadcastText.trim()} onClick={sendBroadcast}>Send to All</Btn>
            <Btn variant="outline" onClick={()=>setShowBroadcast(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
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
// their deadline. Feeds both the standing-column metric and the
// Urgent/Overdue nav page. Mock only; real due-date tracking comes later.
const OVERDUE_ACTIONS = [
  { id:1, type:"Payment",  msg:"Payment due for Zara Okafor booking — 3 days overdue.",             campaignId:1, due:"Jul 12, 2026" },
  { id:2, type:"Contract", msg:"Unsent contract for Zara Okafor pending signature.",                 campaignId:1, due:"Jul 10, 2026" },
  { id:3, type:"Review",   msg:"AW25 Womenswear — 14 submissions need review before due date.",      campaignId:1, due:"Jul 16, 2026" },
  { id:4, type:"Payment",  msg:"Payment due for Ines Ferreira booking — 1 day overdue.",              campaignId:2, due:"Jul 14, 2026" },
];

// Quiet history column for Tasks — same idea as Payments' Recent
// Activity: real completed items, not another queue to act on.
const RECENTLY_COMPLETED = [
  { type:"Payment",  label:"Payment sent — James Whitfield booking",      resolvedDate:"Jul 08" },
  { type:"Contract", label:"Contract signed — Amara Diallo",              resolvedDate:"Jul 06" },
  { type:"Review",   label:"SS25 Fragrance — 9 submissions reviewed",     resolvedDate:"Jul 04" },
  { type:"Payment",  label:"Payment sent — Sofia Brandt booking",         resolvedDate:"Jun 30" },
  { type:"Contract", label:"Contract signed — James Whitfield",          resolvedDate:"Jun 27" },
];

function CampaignsList({ campaigns, openCampaign }: { campaigns: Campaign[]; openCampaign: (id: number) => void }) {
  const currentUser = useCurrentUser();
  const [tab, setTab] = useState("active");
  const [attentionOpen, setAttentionOpen] = useState(false);
  const attentionRef = useRef<HTMLDivElement>(null);
  const filtered = campaigns.filter(c=>c.status===(tab==="active"?"active":tab==="drafts"?"drafts":"archived"));

  // Document listener, not a fixed-position click-catcher — a fixed overlay
  // gets clipped to the nearest backdrop-filter ancestor's box (TopBar's
  // .glass) instead of covering the viewport, which is what silently broke
  // the bell popover's outside-click before it was fixed the same way.
  useEffect(() => {
    if (!attentionOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (attentionRef.current && !attentionRef.current.contains(e.target as Node)) setAttentionOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [attentionOpen]);
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Campaigns" sub={`${currentUser?.org ?? ""} · Brand`}/>
      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="flex items-center gap-1 mb-4 border-b border-border">
          {["active","drafts","archived"].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={cx("px-4 py-2.5 text-sm capitalize border-b-2 -mb-px transition-colors cursor-pointer",
                tab===t?"border-foreground text-foreground font-medium":"border-transparent text-muted-foreground hover:text-foreground"
              )}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
          ))}
        </div>
        {filtered.length===0 ? (
          <div className="glass-subtle border border-dashed rounded-md p-10 text-center">
            <div className="text-sm text-muted-foreground mb-3">No {tab} campaigns</div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map(c=>(
              <div key={c.id} className="glass-subtle border rounded-md p-4 cursor-pointer hover:border-foreground/40 hover:shadow-md transition-all flex gap-3" onClick={()=>openCampaign(c.id)}>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <Badge label={c.status==="archived"?"Archived":"Active"} variant={c.status==="archived"?"draft":"active"}/>
                    <div className="text-sm font-semibold leading-snug mt-2">{c.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{c.type}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-3">Due {c.due}</div>
                </div>
                <div className="w-16 shrink-0 flex flex-col justify-center gap-2 border-l border-border pl-3">
                  {([["Submitted",c.submitted],["Approved",c.approved],["Booked",c.booked]] as [string,number][]).map(([l,v],i,arr)=>(
                    <div key={l} className={cx("text-center rounded-sm py-1", i===arr.length-1&&v>0?"bg-offwhite":"")}>
                      <div className={cx("text-sm font-semibold tabular-nums", i===arr.length-1&&v>0?"text-offwhite-foreground":"")}>{v}</div>
                      <div className={cx("text-[8px] font-mono uppercase tracking-wide leading-tight", i===arr.length-1&&v>0?"text-offwhite-foreground/70":"text-muted-foreground")}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Needs Attention — stacked directly above the Activity widget in
          the same bottom-right corner rather than the opposite corner. */}
      <div ref={attentionRef} className="fixed bottom-20 right-6 z-40">
        {attentionOpen ? (
          <div className="w-80 glass-strong border rounded-md shadow-xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle size={13} className="text-foreground shrink-0"/>
                <span className="text-xs font-semibold">Needs Attention</span>
                <span className="text-[10px] font-mono bg-foreground text-primary-foreground px-1.5 py-0.5 rounded-sm">{CAMPAIGNS_ATTENTION.length}</span>
              </div>
              <button onClick={()=>setAttentionOpen(false)} className="text-muted-foreground hover:text-foreground w-5 h-5 flex items-center justify-center rounded hover:bg-secondary transition-colors cursor-pointer">
                <span className="text-sm font-bold leading-none">−</span>
              </button>
            </div>
            <div className="divide-y divide-border">
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
        ) : (
          <button onClick={()=>setAttentionOpen(true)}
            className="relative w-10 h-10 bg-foreground text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:bg-foreground/90 transition-colors cursor-pointer">
            <AlertCircle size={16}/>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── URGENT / OVERDUE ─────────────────────────────────────────────────────────
// Minimal first pass per spec — this is the landing spot for the "Overdue
// Actions" metric on the Campaigns screen. Deeper filtering/sorting/snooze
// behavior can be layered on later; today it just needs to exist and show
// the same items the metric is counting.

function UrgentOverdueScreen({ openCampaign }: { openCampaign: (id: number) => void }) {
  const currentUser = useCurrentUser();
  const byType = (t: string) => OVERDUE_ACTIONS.filter(a=>a.type===t).length;
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Tasks" sub={`${currentUser?.org ?? ""} · ${OVERDUE_ACTIONS.length} actions past due`}/>
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-10">
          <div className="flex-1 min-w-0 max-w-3xl space-y-3">
            {OVERDUE_ACTIONS.map(a=>(
              <div key={a.id} className="glass-subtle border rounded-md p-4 flex items-start gap-3">
                <ExclamationIcon size={15} className="text-foreground mt-0.5 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge label={a.type} variant="info"/>
                    <span className="text-[11px] font-mono font-semibold text-foreground">Due {a.due}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{a.msg}</div>
                </div>
                <Btn variant="primary" size="sm" onClick={()=>openCampaign(a.campaignId)}>Review</Btn>
              </div>
            ))}
          </div>
          {/* The only place an overdue/urgent count lives now — Campaigns
              dropped its own copy of this metric entirely. */}
          <div className="w-48 shrink-0 min-h-[24rem] border-l border-border pl-6 flex flex-col">
            <div className="bg-foreground text-primary-foreground rounded-md px-4 py-4 mb-3">
              <div className="text-3xl font-semibold tabular-nums tracking-tight">{OVERDUE_ACTIONS.length}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] mt-2 text-primary-foreground/70">Tasks</div>
            </div>
            <div className="flex-1 flex flex-col">
              {[
                { label:"Payments",  value:byType("Payment") },
                { label:"Contracts", value:byType("Contract") },
                { label:"Talent Review", value:byType("Review") },
              ].map((s,i)=>(
                <div key={i} className={cx("flex-1 flex flex-col justify-center py-2", i>0 && "border-t border-border")}>
                  <div className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{s.value}</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-2">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Recently Completed — quiet history column, same idea as
              Payments' Recent Activity: real completed items, not
              another queue demanding action. */}
          <div className="w-64 shrink-0 border-l border-border pl-6">
            <h2 className="text-heading text-base mb-3">Recently Completed</h2>
            <div className="space-y-3">
              {RECENTLY_COMPLETED.map((r,i)=>(
                <div key={i} className="text-xs">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#27AE60] inline-block shrink-0"/>
                    <span className="text-[10px] font-mono text-muted-foreground">{r.resolvedDate}</span>
                    <Badge label={r.type} variant="info"/>
                  </div>
                  <div className="leading-snug">{r.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CREATE CAMPAIGN ──────────────────────────────────────────────────────────

const CAMPAIGN_TYPES = ["Runway","Editorial","Advertising","E-commerce","TV Commercial","Beauty","Other"];

function CreateCampaign({ onBack, onCreated }: { onBack: () => void; onCreated: (realId: string) => void }) {
  const { profile, org } = useAuth();
  const [step, setStep] = useState(1);
  const [genders, setGenders] = useState(["Female"]);
  const [cats, setCats] = useState(["Editorial"]);
  const [campaignType, setCampaignType] = useState("Editorial");
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
              {[["CF-2025-0841","James Whitfield","Elite Model Mgmt.","AW25 Womenswear","$2,850","Fully Executed"],
                ["CF-2025-0842","Amara Diallo","Elite Model Mgmt.","AW25 Womenswear","$2,300","Awaiting Signature"],
                ["CF-2025-0843","Zara Okafor","Elite Model Mgmt.","AW25 Womenswear","$1,960","Draft — Not Sent"],
                ["CF-2025-0791","Mila Tran","IMG Models","SS25 Fragrance","$1,100","Fully Executed"]].map((r,i)=>(
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

function PaidStamp({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-bounce">
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

function PaymentSuccessOverlay({ campaign, amount, onClose }: { campaign: string; amount: string; onClose: () => void }) {
  const [phase, setPhase] = useState<"processing"|"stamp"|"done">("processing");
  useState(() => {
    setTimeout(() => setPhase("stamp"), 800);
    setTimeout(() => setPhase("done"), 2000);
    setTimeout(() => onClose(), 5000);
  });
  return (
    <div className="absolute inset-0 bg-card/85 backdrop-blur-xl flex flex-col items-center justify-center gap-6 rounded-xl z-50">
      {phase === "processing" && (<>
        <div className="w-14 h-14 border-2 border-border border-t-foreground rounded-full animate-spin"/>
        <div className="text-heading text-base text-foreground">Processing payment…</div>
        <div className="text-xs text-muted-foreground font-mono">{campaign}</div>
      </>)}
      {(phase === "stamp" || phase === "done") && (<>
        <div className={cx("transition-all duration-500", phase === "stamp" ? "scale-150 opacity-0" : "scale-100 opacity-100")}><PaidStamp size={140}/></div>
        <div className="text-center space-y-1">
          <div className="text-heading text-base text-foreground">Payment Authorized</div>
          <div className="text-sm text-[#16a34a] font-semibold">{amount} — Paid in Full</div>
          <div className="text-xs text-muted-foreground font-mono">{campaign}</div>
        </div>
        {phase === "done" && <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer">Close</button>}
      </>)}
    </div>
  );
}

type PaymentState = "idle" | "processing" | "complete";

function GlobalPayments() {
  const currentUser = useCurrentUser();
  const org = currentUser?.org ?? "";
  const meName = currentUser?.name ?? "";
  const [paymentsTab, setPaymentsTab] = useState<"payments"|"invoices">("payments");
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSigModal, setShowSigModal] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [signature, setSignature] = useState<string|null>(null);
  const [sigInput, setSigInput] = useState("");
  const [payState, setPayState] = useState<PaymentState>("idle");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [payAmount, setPayAmount] = useState("");

  // Sorted: red (overdue) first, yellow (≤3 days) second, green last
  const invoices = [
    { campaign:"FW24 Campaign — Balance",  amount:"$980",   due:"06/10/2025", urgency:"red"    },
    { campaign:"AW25 Womenswear Campaign", amount:"$2,850", due:"06/20/2025", urgency:"yellow" },
    { campaign:"SS25 Fragrance Launch",    amount:"$2,300", due:"06/24/2025", urgency:"green"  },
    { campaign:"Resort Lookbook 2025",     amount:"$1,100", due:"07/03/2025", urgency:"green"  },
    { campaign:"Beauty Campaign Q1",       amount:"$1,450", due:"07/10/2025", urgency:"green"  },
  ];

  // Quiet history column, not another call to action — most recent first.
  const recentActivity = [
    { campaign:"AW26 Runway Presentation", amount:"$3,200", paidDate:"Jun 18" },
    { campaign:"Holiday 2026 Lookbook",    amount:"$1,850", paidDate:"Jun 14" },
    { campaign:"AW25 Womenswear Campaign", amount:"$2,300", paidDate:"Jun 09" },
    { campaign:"SS25 Fragrance Launch",    amount:"$1,100", paidDate:"Jun 02" },
    { campaign:"Resort Lookbook 2025",     amount:"$980",   paidDate:"May 27" },
  ];

  const urgencyDot = (u: string) => {
    if (u === "red")    return "w-2.5 h-2.5 rounded-full bg-[#C0392B] shrink-0";
    if (u === "yellow") return "w-2.5 h-2.5 rounded-full bg-[#D4A017] shrink-0";
    return "w-2.5 h-2.5 rounded-full bg-[#27AE60] shrink-0";
  };

  const hasCard = true;
  const amountDue = selectedCampaign ? "2850" : "";

  function handleComplete() {
    setPayState("processing");
    setTimeout(()=>setPayState("complete"), 2500);
    setTimeout(()=>{ setPayState("idle"); setShowPayModal(false); }, 5000);
  }

  function attemptClose() {
    if (payAmount || selectedCampaign) { setShowDiscardConfirm(true); } else { setShowPayModal(false); }
  }

  const canAuthorize = !!(selectedCampaign && payAmount && signature);

  // Gold button style for Authorize Payment + Authorize
  const goldBtn = "bg-gold hover:bg-gold/90 text-gold-foreground font-semibold tracking-widest uppercase transition-all shadow-md hover:shadow-lg";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Payments" sub={`${org} · Payment methods and invoices`}/>
      {/* Tab bar: Payments | Invoices */}
      <div className="bg-card border-b border-border px-6 flex items-center shrink-0">
        {(["payments","invoices"] as const).map(t=>(
          <button key={t} onClick={()=>setPaymentsTab(t)}
            className={cx("px-5 py-3 text-sm capitalize border-b-2 -mb-px transition-colors cursor-pointer",
              paymentsTab===t?"border-foreground text-foreground font-medium":"border-transparent text-muted-foreground hover:text-foreground"
            )}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>
      {paymentsTab==="invoices" && <InvoicesPanel/>}
      {paymentsTab==="payments" && <div className="flex-1 flex min-h-0">
      {/* Full-height layout — button pinned to bottom */}
      <div className="flex-1 flex min-h-0 p-6 gap-5">

        {/* LEFT 1/3 — Cards + Bank Accounts */}
        <div className="w-72 shrink-0 flex flex-col gap-4 overflow-y-auto">
          <div>
            <h2 className="text-heading text-base mb-3">Payment Cards</h2>
            {hasCard ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden h-44 bg-gradient-to-br from-[#B8A36A] via-[#CBB989] to-[#8C7A4C] p-5 flex flex-col justify-between select-none cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between">
                    <div><div className="text-[10px] font-mono text-white/80 uppercase tracking-widest">Primary</div><div className="text-base font-bold text-white tracking-widest mt-1">AMEX</div></div>
                    <div className="text-right"><div className="text-[10px] text-white/70">American Express</div><div className="text-xs text-white/90 mt-1">Gold</div></div>
                  </div>
                  <div>
                    <div className="text-white font-mono text-lg tracking-widest mb-2">•••• •••• •••• 4242</div>
                    <div className="flex items-end justify-between">
                      <div><div className="text-[9px] text-white/60 uppercase">Card Holder</div><div className="text-xs text-white font-medium">{meName.toUpperCase()}</div></div>
                      <div className="text-right"><div className="text-[9px] text-white/60 uppercase">Expires</div><div className="text-xs text-white font-mono">09/27</div></div>
                    </div>
                  </div>
                </div>
                <div className="relative rounded-xl overflow-hidden h-28 bg-gradient-to-br from-[#2a2a2a] to-[#444] p-4 flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow opacity-70">
                  <div className="text-xs text-white/60 font-mono">VISA</div>
                  <div><div className="text-white font-mono text-sm tracking-widest mb-1">•••• •••• •••• 8891</div><div className="text-xs text-white/60">{meName.toUpperCase()} · 03/26</div></div>
                </div>
                <button onClick={()=>setShowAddCard(true)} className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-4 py-2 flex items-center justify-center gap-1 hover:border-foreground transition-colors w-full">
                  <Plus size={12}/> Add card
                </button>
              </div>
            ) : (
              <div className="h-44 border-2 border-dashed border-border rounded-xl flex items-center justify-center cursor-pointer hover:border-foreground transition-colors" onClick={()=>setShowAddCard(true)}>
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
              <button className="text-xs text-muted-foreground hover:text-foreground w-full text-center border border-dashed border-border rounded-md px-4 py-2 hover:border-foreground transition-colors">See all accounts</button>
              <button onClick={()=>setShowAddBank(true)} className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-4 py-2 flex items-center justify-center gap-1 hover:border-foreground w-full transition-colors"><Plus size={12}/> Add account</button>
            </div>
          </div>
        </div>

        {/* MIDDLE — Invoices, flex-1 */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header row: legend left, actions right */}
          <div className="flex items-center justify-between mb-3 shrink-0 gap-3">
            <div className="flex items-center gap-1 min-w-0">
              <h2 className="text-heading text-base mr-3 shrink-0">Outstanding Invoices</h2>
              <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C0392B] inline-block"/>Overdue</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#D4A017] inline-block"/>Due soon</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#27AE60] inline-block"/>On track</span>
              </div>
            </div>
            <button className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer shrink-0" onClick={() => setPaymentsTab("invoices")}>
              See all invoices →
            </button>
          </div>
          {/* 2-wide grid — unpaid invoices only */}
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-2 gap-3">
              {invoices.slice(0,9).map((inv,i)=>(
                <div key={i} className={cx("glass-subtle border rounded-md p-4 cursor-pointer hover:border-foreground/40 transition-all flex flex-col gap-3", inv.urgency==="red"&&"border-[#C0392B]/30 bg-[#C0392B]/5")}>
                  <div className="flex items-center justify-between">
                    <span className={urgencyDot(inv.urgency)}/>
                    <div className="text-[10px] font-mono text-muted-foreground">{inv.due}</div>
                  </div>
                  <div className="text-xs font-medium leading-snug flex-1">{inv.campaign}</div>
                  <div className="text-base font-semibold font-mono">{inv.amount}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Authorize Payment — gold with white text, back to its original weight */}
          <button
            onClick={()=>setShowPayModal(true)}
            className={`w-full py-10 mt-4 rounded-md ${goldBtn} text-lg`}
          >
            Authorize Payment
          </button>
        </div>

        {/* RIGHT — Recent Activity, small quiet column */}
        <div className="w-56 shrink-0 flex flex-col min-h-0 border-l border-border pl-5">
          <h2 className="text-heading text-base mb-3 shrink-0">Recent Activity</h2>
          <div className="flex-1 overflow-y-auto space-y-3">
            {recentActivity.map((a,i)=>(
              <div key={i} className="text-xs">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#27AE60] inline-block shrink-0"/>
                  <span className="text-[10px] font-mono text-muted-foreground">{a.paidDate}</span>
                </div>
                <div className="leading-snug">{a.campaign}</div>
                <div className="font-mono text-muted-foreground">{a.amount} paid</div>
              </div>
            ))}
          </div>
        </div>
      </div>{/* end payments flex */}
      </div>}{/* end paymentsTab==="payments" */}

      {/* ── AUTHORIZE PAYMENT MODAL ── */}
      {showPayModal && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden relative">
            {/* Header row */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                {/* Campaign selector */}
                <div className="flex-1 relative">
                  <select value={selectedCampaign} onChange={e=>setSelectedCampaign(e.target.value)}
                    className="w-full appearance-none bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground pr-8">
                    <option value="">Select campaign…</option>
                    <option>AW25 Womenswear Campaign</option>
                    <option>SS25 Fragrance Launch</option>
                    <option>Resort Lookbook 2025</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"/>
                </div>
                {/* Due date — same row as date picker */}
                <div className="bg-secondary border border-border rounded-md px-3 py-2 text-xs font-mono text-muted-foreground shrink-0 whitespace-nowrap">
                  Due: {selectedCampaign ? "06/20/2025" : "—"}
                </div>
                {/* Payment Date — labeled, defaults to today */}
                <div className="flex flex-col gap-1 shrink-0">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Payment Date</div>
                  <input type="date" defaultValue="2026-06-19" className="bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground"/>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground hover:bg-secondary" title="Contact support">?</button>
                  <button onClick={attemptClose} className="text-muted-foreground hover:text-foreground"><X size={16}/></button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Amount row */}
              <div className="flex items-stretch gap-4">
                <div className="flex-1">
                  <FieldLabel>Payment Amount</FieldLabel>
                  <div className="flex items-center border border-border rounded-md bg-input-background overflow-hidden">
                    <span className="px-3 py-2 text-sm text-muted-foreground border-r border-border">$</span>
                    <input value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="0.00"
                      className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none"/>
                    {amountDue && (
                      <button onClick={()=>setPayAmount(amountDue)}
                        className="px-3 py-2 text-xs font-medium text-muted-foreground border-l border-border hover:bg-secondary hover:text-foreground transition-colors shrink-0 whitespace-nowrap">
                        Pay in full
                      </button>
                    )}
                  </div>
                </div>
                {/* Amount Due — hero */}
                <div className="bg-foreground rounded-md px-6 py-3 flex flex-col items-center justify-center text-primary-foreground shrink-0 min-w-[150px]">
                  <div className="text-[10px] font-mono uppercase tracking-widest opacity-60 mb-1">Amount Due</div>
                  <div className="text-2xl font-semibold font-mono">{selectedCampaign ? "$2,850" : "—"}</div>
                </div>
              </div>

              {/* Payer + timestamp */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <FieldLabel>Payment Submitted By</FieldLabel>
                  <input readOnly value={meName} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"/>
                </div>
                <div className="flex-1">
                  <FieldLabel>Processing Timestamp</FieldLabel>
                  <input readOnly value="Jun 19, 2026 · 2:34 PM EST" className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs text-muted-foreground cursor-not-allowed font-mono"/>
                </div>
              </div>

              {/* E-Signature */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <FieldLabel>Authorized Representative E-Signature</FieldLabel>
                  <div className="text-xs text-muted-foreground">By signing, you authorize this payment on behalf of {org}.</div>
                </div>
                <div className="shrink-0">
                  {signature ? (
                    <div className="border border-border rounded-md px-4 py-3 min-w-[140px] flex items-center justify-center bg-secondary cursor-pointer hover:border-foreground">
                      <span className="font-serif italic text-lg">{signature}</span>
                    </div>
                  ) : (
                    <button onClick={()=>setShowSigModal(true)} className="border border-dashed border-border rounded-md px-4 py-3 min-w-[140px] text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">
                      <Plus size={12}/> Add signature
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t-2 border-border bg-muted/20">
              {/* Row 1: i button · Discard · Save Draft */}
              <div className="px-6 py-3 flex items-center gap-2 border-b border-border">
                <button className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground hover:bg-secondary" title="Open invoice">i</button>
                <div className="flex-1"/>
                <button onClick={()=>setShowDiscardConfirm(true)} className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-2 hover:bg-muted transition-colors">Discard</button>
                <button onClick={()=>setShowPayModal(false)} className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-2 hover:bg-secondary transition-colors">Save Draft</button>
              </div>
              {/* Row 2: Authorize — always visible, gold when ready */}
              <div className="px-6 py-4">
                <button
                  onClick={canAuthorize ? handleComplete : undefined}
                  className={cx("w-full py-3.5 rounded-md text-sm tracking-widest uppercase transition-all",
                    canAuthorize
                      ? `${goldBtn} cursor-pointer`
                      : "bg-[#C4A84A]/30 text-white/40 cursor-not-allowed"
                  )}
                >
                  Authorize
                </button>
                {!canAuthorize && (
                  <div className="text-center text-[10px] text-muted-foreground mt-2">
                    {!selectedCampaign ? "Select a campaign to continue" : !payAmount ? "Enter payment amount" : "Add e-signature to authorize"}
                  </div>
                )}
              </div>
            </div>

            {/* Processing overlay */}
            {payState !== "idle" && (
              <PaymentSuccessOverlay
                campaign={selectedCampaign || "AW25 Womenswear Campaign"}
                amount={payAmount ? `$${Number(payAmount).toLocaleString()}` : "$2,850"}
                onClose={()=>{ setPayState("idle"); setShowPayModal(false); }}
              />
            )}
          </div>
        </div>
      )}

      {/* Discard Confirm */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[60]">
          <div className="bg-card border border-border rounded-md w-80 p-6 shadow-xl">
            <div className="text-sm font-semibold mb-2">Discard payment draft?</div>
            <div className="text-xs text-muted-foreground mb-5">This payment draft will be lost. This action cannot be undone.</div>
            <div className="flex gap-2">
              <Btn variant="primary" fullWidth onClick={()=>{ setShowDiscardConfirm(false); setShowPayModal(false); setSelectedCampaign(""); setPayAmount(""); }}>Discard</Btn>
              <Btn variant="outline" fullWidth onClick={()=>setShowDiscardConfirm(false)}>Keep editing</Btn>
            </div>
          </div>
        </div>
      )}

      {/* E-Signature Modal */}
      {showSigModal && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[60]">
          <div className="bg-card border border-border rounded-md w-96 overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="text-heading text-sm">Create E-Signature</div>
              <button onClick={()=>setShowSigModal(false)} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-xs text-muted-foreground">Type your full name to create your authorized e-signature.</div>
              <div><FieldLabel>Full Name</FieldLabel><input value={sigInput} onChange={e=>setSigInput(e.target.value)} placeholder={`e.g. ${meName || "Jordan Smith"}`} className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground"/></div>
              {sigInput && (<div className="border border-border rounded-md p-4 bg-secondary text-center"><div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-mono">Preview</div><div className="font-serif italic text-2xl">{sigInput}</div></div>)}
              <div className="text-[10px] text-muted-foreground leading-relaxed">By creating this e-signature, you agree it is legally equivalent to your handwritten signature within <DvureWordmark size={9}/>.</div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <Btn variant="primary" disabled={!sigInput} onClick={()=>{ setSignature(sigInput); setShowSigModal(false); setSigInput(""); }}>Create Signature</Btn>
              <Btn variant="outline" onClick={()=>setShowSigModal(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      {showAddCard && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[60]">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="text-heading text-sm">Add Payment Card</div>
              <button onClick={()=>setShowAddCard(false)} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
            </div>
            <div className="p-6 space-y-4">
              <TextInput label="Name on Card" placeholder={`e.g. ${meName || "Jordan Smith"}`}/>
              <div>
                <FieldLabel>Card Number</FieldLabel>
                <input placeholder="•••• •••• •••• ••••" maxLength={19}
                  className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:border-foreground tracking-widest"/>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1"><TextInput label="Expiry" placeholder="MM/YY"/></div>
                <div className="col-span-1"><TextInput label="CVV" placeholder="•••"/></div>
                <div className="col-span-1"><TextInput label="ZIP Code" placeholder="10001"/></div>
              </div>
              <div className="bg-secondary border border-border rounded-md px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
                <Lock size={13} className="shrink-0 mt-0.5"/>
                <span>Your card information is encrypted and processed securely via Stripe. We never store your full card number.</span>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button className={`flex-1 py-3 rounded-md text-sm ${goldBtn}`} onClick={()=>setShowAddCard(false)}>Save Card</button>
              <Btn variant="outline" onClick={()=>setShowAddCard(false)}>Cancel</Btn>
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
              <button className={`flex-1 py-3 rounded-md text-sm ${goldBtn}`} onClick={()=>setShowAddBank(false)}>Save Account</button>
              <Btn variant="outline" onClick={()=>setShowAddBank(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── INVOICES PANEL ─────────────────────────────────────────────────────────

const INVOICE_DATA = [
  { id:"INV-0841", campaign:"AW25 Womenswear Campaign", agency:"Elite Model Mgmt.", talent:"James Whitfield", dayRate:950,  days:3, amount:2850,  due:"06/20/2025", urgency:"yellow", agencyPct:20, dvurePct:3, taxPct:8.25 },
  { id:"INV-0842", campaign:"AW25 Womenswear Campaign", agency:"Elite Model Mgmt.", talent:"Amara Diallo",    dayRate:1150, days:2, amount:2300,  due:"06/24/2025", urgency:"green",  agencyPct:20, dvurePct:3, taxPct:8.25 },
  { id:"INV-0791", campaign:"SS25 Fragrance Launch",    agency:"IMG Models",        talent:"Mila Tran",       dayRate:1100, days:1, amount:1100,  due:"07/03/2025", urgency:"green",  agencyPct:20, dvurePct:3, taxPct:8.25 },
  { id:"INV-0768", campaign:"FW24 Campaign",            agency:"DNA Models",        talent:"Sofia Brandt",    dayRate:1200, days:3, amount:3600,  due:"06/10/2025", urgency:"red",    agencyPct:20, dvurePct:3, taxPct:8.25 },
  { id:"INV-0804", campaign:"Resort Lookbook 2025",     agency:"Storm Models",      talent:"Ines Ferreira",   dayRate:1340, days:2, amount:2680,  due:"07/03/2025", urgency:"green",  agencyPct:20, dvurePct:3, taxPct:8.25 },
  { id:"INV-0815", campaign:"Beauty Campaign Q1",       agency:"Next Models",       talent:"Chiara Russo",    dayRate:860,  days:2, amount:1720,  due:"07/10/2025", urgency:"green",  agencyPct:20, dvurePct:3, taxPct:8.25 },
];

function InvoicesPanel() {
  const currentUser = useCurrentUser();
  const org = currentUser?.org ?? "";
  const [selected, setSelected] = useState<typeof INVOICE_DATA[number]|null>(null);

  const urgencyDot = (u: string) => {
    if (u === "red")    return "w-2 h-2 rounded-full bg-[#C0392B] shrink-0";
    if (u === "yellow") return "w-2 h-2 rounded-full bg-[#D4A017] shrink-0";
    return "w-2 h-2 rounded-full bg-[#27AE60] shrink-0";
  };

  function calcBreakdown(inv: typeof INVOICE_DATA[number]) {
    const modelFee      = inv.dayRate * inv.days;
    const agencyFee     = Math.round(modelFee * (inv.agencyPct / 100));
    const base          = modelFee + agencyFee;
    const dvureFee      = Math.round(base * (inv.dvurePct / 100));          // 3%
    const processingFee = Math.round(base * 0.029) + 30;                    // 2.9% + $0.30
    const totalFees     = dvureFee + processingFee;
    const tax           = Math.round(base * (inv.taxPct / 100));
    const total         = base + dvureFee + processingFee + tax;
    return { modelFee, agencyFee, dvureFee, processingFee, totalFees, tax, total };
  }

  const urgencyOrder: Record<string,number> = { red:0, yellow:1, green:2 };
  const sorted = [...INVOICE_DATA].sort((a,b)=>(urgencyOrder[a.urgency]??2)-(urgencyOrder[b.urgency]??2));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Invoices" sub={`All invoices · ${org}`}/>
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center gap-4 mb-4 text-[10px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#C0392B] inline-block"/>Overdue</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#D4A017] inline-block"/>Due within 3 days</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#27AE60] inline-block"/>On track</span>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map(inv => {
            const bd = calcBreakdown(inv);
            return (
              <div key={inv.id}
                onClick={() => setSelected(inv)}
                className="glass-subtle border rounded-xl p-5 cursor-pointer hover:border-foreground/40 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={urgencyDot(inv.urgency)}/>
                    <span className="text-[10px] font-mono text-muted-foreground">{inv.id}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{inv.due}</span>
                </div>
                <div className="mb-4">
                  <div className="text-sm font-semibold leading-snug mb-0.5">{inv.campaign}</div>
                  <div className="text-xs text-muted-foreground">{inv.agency}</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{inv.talent}</div>
                </div>
                <div className="border-t border-border pt-3 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] text-muted-foreground font-mono">Total Due</div>
                    <div className="text-xl font-semibold font-mono">${bd.total.toLocaleString()}</div>
                  </div>
                  <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity font-mono">View →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={urgencyDot(selected.urgency)}/>
                  <div className="text-sm font-semibold">{selected.id}</div>
                </div>
                <div className="text-xs text-muted-foreground">{selected.campaign} · {selected.agency}</div>
              </div>
              <button onClick={()=>setSelected(null)} className="text-muted-foreground hover:text-foreground"><X size={16}/></button>
            </div>
            <div className="px-6 py-5">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Fee Breakdown</div>
              {(() => {
                const bd = calcBreakdown(selected);
                return (
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between py-2.5 border-b border-border">
                      <div>
                        <div className="text-sm">Model Fee — {selected.talent}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{selected.days} day{selected.days>1?"s":""} × ${selected.dayRate.toLocaleString()}/day</div>
                      </div>
                      <div className="font-mono text-sm font-medium">${bd.modelFee.toLocaleString()}</div>
                    </div>
                    <div className="flex items-baseline justify-between py-2.5 border-b border-border">
                      <div>
                        <div className="text-sm">Agency Fee — {selected.agency}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{selected.agencyPct}% of model fee</div>
                      </div>
                      <div className="font-mono text-sm font-medium">${bd.agencyFee.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center justify-between py-2.5 border-b border-border">
                      <div className="flex items-center gap-2">
                        <div className="text-sm">Fees &amp; Taxes</div>
                        <div className="relative group/tooltip">
                          <span className="w-4 h-4 rounded-full border border-border bg-secondary text-[9px] font-mono text-muted-foreground flex items-center justify-center cursor-default select-none">i</span>
                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover/tooltip:block z-20 w-56 bg-foreground text-primary-foreground rounded-md shadow-lg p-3 text-[10px] font-mono space-y-1.5">
                            <div className="flex justify-between gap-4"><span><DvureWordmark size={9}/> transaction (3%)</span><span>${bd.dvureFee.toLocaleString()}</span></div>
                            <div className="flex justify-between gap-4"><span>Processing (2.9% + $0.30)</span><span>${bd.processingFee.toLocaleString()}</span></div>
                            <div className="border-t border-primary-foreground/20 pt-1.5 flex justify-between gap-4 font-semibold"><span>Total fees</span><span>${bd.totalFees.toLocaleString()}</span></div>
                          </div>
                        </div>
                      </div>
                      <div className="font-mono text-sm font-medium">${(bd.dvureFee+bd.processingFee+bd.tax).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center justify-between pt-4 mt-1 border-t-2 border-foreground">
                      <div className="text-sm font-semibold">Invoice Total</div>
                      <div className="text-2xl font-semibold font-mono">${bd.total.toLocaleString()}</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono text-right">Due {selected.due}</div>
                  </div>
                );
              })()}
            </div>
            <div className="px-6 pb-5 flex gap-2">
              <button
                onClick={()=>setSelected(null)}
                className="flex-1 py-3 rounded-md text-sm font-semibold tracking-widest uppercase bg-[#C4A84A] hover:bg-[#B8962E] text-white transition-all cursor-pointer">
                Authorize Payment
              </button>
              <Btn variant="outline" onClick={()=>setSelected(null)}>Message Agency →</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MESSAGING ─────────────────────────────────────────────────────────────

const INBOX_MSGS = [
  { id:1,  urgent:true,  date:"Jun 19, 2:14 PM", subject:"Payout requested — Booking #0841",              sender:"Sophie Chen",   org:"Elite Model Mgmt.", title:"Senior Agent",      campaign:"AW25 Womenswear",     read:false, body:"Please review and authorize payment for the AW25 Womenswear booking. Let us know if you have any questions." },
  { id:2,  urgent:false, date:"Jun 18, 10:30 AM",subject:"Talent availability confirmed — Amara Diallo",  sender:"James Kirk",    org:"Elite Model Mgmt.", title:"Booking Agent",    campaign:"AW25 Womenswear",     read:false, body:"Amara has confirmed availability for the full window, 07/14–07/15. Please proceed with the contract." },
  { id:3,  urgent:false, date:"Jun 17, 4:05 PM", subject:"Rate question — SS25 Fragrance",                sender:"Diana Park",    org:"IMG Models",        title:"Agent",             campaign:"SS25 Fragrance",      read:true,  body:"Following up on rates for Mila's booking. Please advise." },
  { id:4,  urgent:true,  date:"Jun 17, 11:52 AM",subject:"Fitting rescheduled — need sign-off today",      sender:"Priya Anand",   org:"Wilhelmina",        title:"Booking Coordinator",campaign:"AW26 Runway Presentation", read:false, body:"The 2pm fitting slot moved to 4pm due to a venue conflict. Need your sign-off on the new call sheet before we notify talent." },
  { id:5,  urgent:false, date:"Jun 16, 5:40 PM", subject:"Usage terms question — Resort Lookbook",         sender:"Marcus Reyes",  org:"DNA Models",        title:"Agent",             campaign:"Resort Lookbook 2025",read:true,  body:"Client is asking whether the lookbook usage extends to paid social. Can you confirm before we sign?" },
  { id:6,  urgent:false, date:"Jun 16, 9:15 AM", subject:"Comp cards attached — 3 new submissions",        sender:"Sophie Chen",   org:"Elite Model Mgmt.", title:"Senior Agent",      campaign:"SS25 Fragrance",      read:true,  body:"Sending over three additional comp cards for consideration ahead of Friday's deadline." },
  { id:7,  urgent:false, date:"Jun 15, 3:22 PM", subject:"Contract executed — Ines Ferreira",              sender:"James Kirk",    org:"Elite Model Mgmt.", title:"Booking Agent",    campaign:"AW26 Runway Presentation", read:true,  body:"Signed contract attached. Let us know if wardrobe needs measurements ahead of the fitting." },
  { id:8,  urgent:true,  date:"Jun 15, 8:03 AM", subject:"Overdue invoice — please advise",                sender:"Diana Park",    org:"IMG Models",        title:"Agent",             campaign:"SS25 Fragrance",      read:false, body:"Invoice #4471 is now five days past due. Can you let us know the status on your end?" },
  { id:9,  urgent:false, date:"Jun 14, 6:48 PM", subject:"Travel confirmation needed",                     sender:"Marcus Reyes",  org:"DNA Models",        title:"Agent",             campaign:"Resort Lookbook 2025",read:true,  body:"Can you confirm flight details for the location shoot are finalized on your side?" },
  { id:10, urgent:false, date:"Jun 14, 1:10 PM", subject:"New talent for consideration — Runway",          sender:"Priya Anand",   org:"Wilhelmina",        title:"Booking Coordinator",campaign:"AW26 Runway Presentation", read:true,  body:"Adding two new faces to the roster ahead of casting. Comp cards to follow shortly." },
  { id:11, urgent:false, date:"Jun 13, 4:30 PM", subject:"Re: Rate question — SS25 Fragrance",             sender:"Diana Park",    org:"IMG Models",        title:"Agent",             campaign:"SS25 Fragrance",      read:true,  body:"Thanks for confirming — we'll move forward at the quoted rate." },
  { id:12, urgent:false, date:"Jun 12, 9:55 AM", subject:"Deliverables received — Womenswear",             sender:"James Kirk",    org:"Elite Model Mgmt.", title:"Booking Agent",    campaign:"AW25 Womenswear",     read:true,  body:"All deliverables for the shoot have been received and logged on our end. Thank you." },
];

// Split view — an inbox list on the left, a persistent compose/detail pane
// on the right. Lands blank (no compose, no message) until the user picks
// something, then remembers that exact selection — even across sign-out/
// sign-in — the same way Gmail/Slack drop you back where you left off.
// There's no real messages backend yet, so this can't sync across devices;
// it's a per-browser localStorage entry keyed to the signed-in profile id,
// which is the honest version of "remembered" available at this stage.
// Send/Reply are mocked (no recipients, no delivery) until there's a real
// backend to send through — that's expected at this stage.
type MessagingMode = "empty" | "compose" | "view";
type MessagingSelection = { mode: "compose" } | { mode: "view"; messageId: number };

function messagingSelectionKey(profileId: string) {
  return `dvure:messaging:lastSelection:${profileId}`;
}

function MessagingScreen() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState(INBOX_MSGS);
  const [mode, setMode] = useState<MessagingMode>("empty");
  const [selectedId, setSelectedId] = useState<number|null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const allChecked = messages.length>0 && checked.length===messages.length;
  // Derived from messages rather than its own snapshot, so the detail pane
  // always reflects the latest read state instead of going stale the
  // moment openMessage flips it.
  const selectedMsg = messages.find(m=>m.id===selectedId) ?? null;

  // Restore whatever this profile last had open — including across a
  // sign-out/sign-in, since it reads from localStorage rather than
  // component state.
  useEffect(() => {
    if (!profile?.id) return;
    const raw = localStorage.getItem(messagingSelectionKey(profile.id));
    if (!raw) return;
    try {
      const saved: MessagingSelection = JSON.parse(raw);
      if (saved.mode === "compose") {
        setMode("compose");
      } else if (saved.mode === "view" && INBOX_MSGS.some(m=>m.id===saved.messageId)) {
        setSelectedId(saved.messageId);
        setMode("view");
      }
    } catch {
      // Corrupt/old-shape entry — ignore and stay on the blank default.
    }
  }, [profile?.id]);

  function persistSelection(selection: MessagingSelection | null) {
    if (!profile?.id) return;
    const key = messagingSelectionKey(profile.id);
    if (selection) localStorage.setItem(key, JSON.stringify(selection));
    else localStorage.removeItem(key);
  }

  function openMessage(m: typeof INBOX_MSGS[number]) {
    setSelectedId(m.id);
    setMode("view");
    setMessages(prev => prev.map(x => x.id===m.id ? { ...x, read:true } : x));
    persistSelection({ mode:"view", messageId: m.id });
  }
  function startNewMessage() {
    setSelectedId(null);
    setMode("compose");
    persistSelection({ mode:"compose" });
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
      persistSelection(null);
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
                className={cx("px-4 py-3 cursor-pointer hover:bg-secondary transition-colors flex items-start gap-2.5",
                  mode==="view" && selectedId===m.id ? "bg-secondary" : !m.read && "bg-muted/20"
                )}>
                <button onClick={(e)=>{ e.stopPropagation(); toggleChecked(m.id); }}
                  className={cx("w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors",
                    checked.includes(m.id) ? "bg-foreground border-foreground" : "border-border hover:border-foreground/40"
                  )}>
                  {checked.includes(m.id) && <Check size={10} strokeWidth={3} className="text-primary-foreground"/>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={cx("text-xs truncate", !m.read&&"font-semibold")}>
                      {m.sender} <span className="text-muted-foreground font-normal">· {m.org}</span>
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground shrink-0">{m.date}</span>
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
              onReply={()=>{ setMode("compose"); persistSelection({ mode:"compose" }); }}
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

  function handleSend() {
    setSent(true);
    setFormKey(k=>k+1);
    setTimeout(()=>setSent(false), 2500);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
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
      <div className="border-t border-border px-6 py-3 flex items-center gap-3 shrink-0">
        <Btn variant="primary" size="sm" icon={<Send size={13}/>} onClick={handleSend}>Send</Btn>
        {sent && <span className="text-xs text-muted-foreground">Message sent</span>}
      </div>
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
        <div className="border border-border rounded-md divide-y divide-border font-mono text-[11px] overflow-hidden">
          <div className="flex"><span className="w-16 shrink-0 px-2.5 py-1 text-muted-foreground uppercase tracking-wider bg-muted/30 border-r border-border">From</span><span className="px-2.5 py-1">{msg.sender} — {msg.title}, {msg.org}</span></div>
          <div className="flex"><span className="w-16 shrink-0 px-2.5 py-1 text-muted-foreground uppercase tracking-wider bg-muted/30 border-r border-border">To</span><span className="px-2.5 py-1">{currentUser?.name ?? ""} — {currentUser?.org ?? ""}</span></div>
          <div className="flex"><span className="w-16 shrink-0 px-2.5 py-1 text-muted-foreground uppercase tracking-wider bg-muted/30 border-r border-border">Date</span><span className="px-2.5 py-1">{msg.date}</span></div>
          <div className="flex"><span className="w-16 shrink-0 px-2.5 py-1 text-muted-foreground uppercase tracking-wider bg-muted/30 border-r border-border">Campaign</span><span className="px-2.5 py-1">{msg.campaign}</span></div>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <p className="text-sm leading-relaxed">{msg.body}</p>
        </div>
        {related.length>0 && (
          <div className="border-t border-border">
            <div className="px-6 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted/20">
              Related — {msg.campaign} ({related.length})
            </div>
            <div className="divide-y divide-border">
              {related.map(m=>(
                <button key={m.id} onClick={()=>onOpenRelated(m)}
                  className="w-full text-left px-6 py-2.5 hover:bg-secondary transition-colors flex items-center justify-between gap-3 cursor-pointer">
                  <div className="min-w-0">
                    <div className={cx("text-xs truncate", !m.read&&"font-semibold")}>{m.subject}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{m.sender} · {m.org}</div>
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground shrink-0">{m.date}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-border px-6 py-3 flex items-center gap-2 shrink-0">
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
  const [added, setAdded] = useState(["Elite Model Management","IMG Models"]);
  const agencies = [
    { name:"Elite Model Management", loc:"New York · London · Paris", talent:420, bookings:8, spend:"$24,500", lastSub:"2 days ago",  responseRate:"94%", preferred:true  },
    { name:"IMG Models",             loc:"New York · London · Milan",  talent:380, bookings:5, spend:"$11,100", lastSub:"5 days ago",  responseRate:"87%", preferred:false },
    { name:"Wilhelmina",             loc:"New York · Los Angeles",     talent:210, bookings:2, spend:"$4,400",  lastSub:"12 days ago", responseRate:"76%", preferred:false },
    { name:"DNA Models",             loc:"New York",                   talent:180, bookings:1, spend:"$3,600",  lastSub:"3 days ago",  responseRate:"91%", preferred:false },
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

function SettingsScreen({ onLogout }: { onLogout: () => void }) {
  const user = useCurrentUser();
  const isAdmin = user?.access === "administrator";
  const [tab, setTab] = useState<"profile"|"subscription"|"billing"|"security"|"org"|"notifications">("profile");
  const [channels, setChannels] = useState<string[]>(["Email"]);
  const [timing, setTiming] = useState<string[]>(["1 day before","Day of"]);
  const toggle = (arr: string[], val: string, set: (a:string[])=>void) =>
    set(arr.includes(val)?arr.filter(v=>v!==val):[...arr,val]);
  // Subscription is a platform-billing surface — only administrators see it.
  const TABS: [string,string][] = [
    ["profile","Profile"],
    ...(isAdmin ? [["subscription","Subscription"] as [string,string]] : []),
    ["billing","Billing"],
    ["security","Security"],
    ["org","Organization"],
    ["notifications","Notifications"],
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
                <div className="glass-subtle border rounded-md overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div><div className="text-sm font-semibold"><DvureWordmark size={11}/> Brand</div><div className="text-xs text-muted-foreground">Professional plan · Billed monthly</div></div>
                    <Badge label="Active Trial" variant="success"/>
                  </div>
                  <div className="px-5 py-4 space-y-3 text-sm">
                    {[["Plan","Brand Professional"],["Monthly price","$99 / month"],["Trial ends","July 3, 2026"]].map(([k,v])=>(
                      <div key={k} className="flex justify-between border-b border-border last:border-0 pb-3 last:pb-0"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
                    ))}
                  </div>
                </div>
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

  const [realCampaigns, setRealCampaigns] = useState<Campaign[]>([]);
  const [realIdShim, setRealIdShim] = useState<Map<number, string>>(new Map());
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const allCampaigns = [...CAMPAIGNS, ...realCampaigns];

  async function refetchCampaigns() {
    if (!org) return null;
    const { campaigns: fetched, realIdShim: shim } = await fetchBrandCampaigns(org.id);
    setRealCampaigns(fetched);
    setRealIdShim(shim);
    setCampaignsLoading(false);
    return shim;
  }

  useEffect(() => {
    if (org) refetchCampaigns();
  }, [org?.id]);

  useEffect(() => {
    if (!activityOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (activityRef.current && !activityRef.current.contains(e.target as Node)) setActivityOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [activityOpen]);

  function openCampaign(id: number) {
    const campaign = allCampaigns.find(c=>c.id===id);
    setCampaignSection(campaign?.type==="Runway" ? "casting" : "moodboard");
    navigate(`/brand/campaigns/${id}`);
  }
  function backToCampaigns() { setGlobalNav("campaigns"); navigate("/brand"); }
  function handleGlobalNav(v: GlobalView) { setGlobalNav(v); setView(v); navigate("/brand"); }

  async function handleCampaignCreated(realId: string) {
    const shim = await refetchCampaigns();
    const shimId = shim ? [...shim.entries()].find(([, v]) => v === realId)?.[0] : undefined;
    setView("campaigns");
    navigate(shimId != null ? `/brand/campaigns/${shimId}` : "/brand");
  }

  // Relay is a hard context switch, not another campaign tab — its own
  // full-bleed console (own sidebar, dark-mode scoped), not nested inside
  // the normal light-mode chrome. Exiting it lands back on the same
  // campaign, since the URL never changed while relay was open.
  if (view === "relay") return <RelayConsole onExit={()=>setView("campaigns")}/>;

  if (activeCampaignId != null && campaignsLoading) {
    return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <CurrentUserProvider user={{ name:profile?.fullName ?? "", title:org?.title ?? "", org:org?.name ?? "", email:profile?.email ?? "", phone:profile?.phone ?? "", access:org?.accessLevel ?? "basic", onSettings:()=>handleGlobalNav("settings") }}>
      <div className="h-screen flex bg-background overflow-hidden">
        {activeCampaignId != null ? (
          <CampaignWorkspace campaigns={allCampaigns} realIdShim={realIdShim} campaignId={activeCampaignId} section={campaignSection} onSection={setCampaignSection} onBack={backToCampaigns} onNewCampaign={()=>{ setView("create-campaign"); navigate("/brand"); }} onHome={()=>handleGlobalNav("campaigns")} onOpenRelay={()=>setView("relay")}/>
        ) : (
          <>
            <BrandSidebar active={globalNav} onNav={handleGlobalNav} onOpenCampaign={openCampaign} onLogout={onLogout}/>
            <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {view==="campaigns"        && <CampaignsList campaigns={allCampaigns} openCampaign={openCampaign}/>}
              {view==="urgent"           && <UrgentOverdueScreen openCampaign={openCampaign}/>}
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

        <div ref={activityRef} className="fixed bottom-6 right-6 z-40 group">
          {activityOpen ? (
            <ActivityFeedPanel onClose={()=>setActivityOpen(false)}/>
          ) : (
            <button onClick={()=>setActivityOpen(true)} className="w-10 h-10 bg-foreground text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:bg-foreground/90 transition-colors cursor-pointer">
              <List size={16}/>
            </button>
          )}
        </div>
      </div>
    </CurrentUserProvider>
  );
}
