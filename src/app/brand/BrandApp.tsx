import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Plus, ChevronRight, ChevronDown, ChevronLeft,
  X, Check, Star, Search, Briefcase,
  AlertCircle, Camera,
  MessageSquare, Download, CreditCard, MapPin,
  Settings, Building2,
  Calendar, FileText, Activity, List, BookOpen,
  BarChart2, FileCheck, Send, Edit3, Eye, ChevronUp,
  User, LogOut, Pin, Lock, Globe, Shirt, Home, Radio
} from "lucide-react";
import type { SubmissionStage, Talent, IconFn, CardComment, Campaign, CastingStageId, CastingEntry, Look } from "../shared/types";
import { cx, XBox, UserAvatar, PolaroidIcon, Badge, Btn, Stat, FieldLabel, TextInput, FSelect, Textarea, Chip, SidebarBadge, TopBar, ActivityFeedPanel, CurrentUserProvider, useCurrentUser } from "../shared/ui";
import { SAMPLE_TALENT, PIPELINE_STAGES, DECLINE_REASONS, BOOKINGS, bookingBreakdown, ORG_USERS, ACCESS_BADGE, ACTIVITY_EVENTS, CARD_COMMENTS, CAMPAIGNS, RUNWAY_SHOWS, RUNWAY_SHOW_OTHER_BRANDS, CASTING_STAGES, CASTING_ENTRIES, CREW, LOOKS } from "../shared/mockData";
import RelayConsole from "./relay/RelayConsole";

type GlobalView = "campaigns" | "urgent" | "contracts-global" | "payments-global" | "messaging" | "reports" | "network" | "directory" | "settings";
type AppView = GlobalView | "campaign" | "create-campaign" | "relay";
type CampaignSection = "overview" | "moodboard" | "casting" | "looks" | "requirements" | "deliverables" | "contracts" | "bookings" | "activity" | "collaboration" | "users";

// ─── CONTRACT MODAL ────────────────────────────────────────────────────────

function ContractModal({ talent, onSend, onLater }: { talent: Talent; onSend: () => void; onLater: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-strong border rounded-md w-full max-w-md mx-4 overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">Contract Generated</div>
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
  { id:"urgent",           label:"Urgent/Overdue", Icon:ExclamationIcon    },
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
  return (
    <aside className="w-52 shrink-0 glass border-r flex flex-col h-full">
      <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
        <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center shrink-0">
          <span className="text-primary-foreground text-xs font-bold">A</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">Acne Studios</div>
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
              {item.badge && <SidebarBadge count={item.badge}/>}
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

function CampaignSidebar({ campaign, section, onSection, onBack, onNewCampaign, onHome, onOpenRelay, counts }: {
  campaign: Campaign; section: CampaignSection; onSection: (s: CampaignSection) => void;
  onBack: () => void; onNewCampaign: () => void; onHome: () => void; onOpenRelay: () => void; counts: Record<string,number>;
}) {
  const nav = campaignNavFor(campaign.type);
  return (
    <aside className="w-52 shrink-0 glass border-r flex flex-col h-full">
      <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
        <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center shrink-0">
          <span className="text-primary-foreground text-xs font-bold">A</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">Acne Studios</div>
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

function Moodboard({ talent, setTalent, onContractPrompt }: {
  talent: Talent[]; setTalent: (fn: (prev: Talent[]) => Talent[]) => void; onContractPrompt: (t: Talent) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [dragging, setDragging] = useState<number|null>(null);
  const [dragOver, setDragOver] = useState<SubmissionStage|null>(null);
  const [toast, setToast] = useState<{ msg: string; undo: () => void }|null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const [drawer, setDrawer] = useState<Talent|null>(null);
  const [declineModal, setDeclineModal] = useState<Talent|null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [comments, setComments] = useState<CardComment[]>(CARD_COMMENTS);
  const [commentDraft, setCommentDraft] = useState("");

  const commentsFor = (talentId: number) => comments.filter(c => c.talentId === talentId);

  function postComment(talentId: number) {
    if (!commentDraft.trim()) return;
    setComments(prev => [...prev, { id: Date.now(), talentId, author: "Marcus Webb", org: "Acne Studios", text: commentDraft, ts: "Now" }]);
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
                            <div className="text-xs font-semibold leading-tight truncate">{t.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{t.agency}</div>
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
              <div className="text-sm font-semibold truncate">{drawer.name}</div>
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
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Agency</div>
                <div className="bg-secondary rounded-md p-3 space-y-1">
                  <div className="text-xs font-semibold">{drawer.agency}</div>
                  <div className="text-[10px] text-muted-foreground">Sophie Chen · sophie@elitemodels.com</div>
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
              <div className="text-sm font-semibold">Reject — {declineModal.name}</div>
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
              <div className="text-sm font-semibold">Look {drawer.number}</div>
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

function CampaignWorkspace({ campaignId, section, onSection, onBack, onNewCampaign, onHome, onOpenRelay }: {
  campaignId: number; section: CampaignSection; onSection: (s: CampaignSection) => void; onBack: () => void; onNewCampaign: () => void; onHome: () => void; onOpenRelay: () => void;
}) {
  const [talent, setTalent] = useState<Talent[]>(SAMPLE_TALENT);
  const [contractModal, setContractModal] = useState<Talent|null>(null);

  const campaign = CAMPAIGNS.find(c=>c.id===campaignId) ?? CAMPAIGNS[0];

  const counts: Record<string,number> = {
    submitted: talent.filter(t=>t.stage==="submitted").length,
    approved:  talent.filter(t=>t.stage==="approved").length,
    booked:    talent.filter(t=>t.stage==="booked").length,
    rejected:  talent.filter(t=>t.stage==="rejected").length,
  };

  const sectionLabel = campaignNavFor(campaign.type).find(n=>n.id===section)?.label ?? "";

  return (
    <>
      <CampaignSidebar campaign={campaign} section={section} onSection={onSection} onBack={onBack} onNewCampaign={onNewCampaign} onHome={onHome} onOpenRelay={onOpenRelay} counts={counts}/>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TopBar title={sectionLabel} sub={campaign.name}/>
        <div className="flex-1 min-h-0 overflow-hidden">

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
              </div>
            </div>
          )}

          {section==="moodboard" && <Moodboard talent={talent} setTalent={setTalent} onContractPrompt={t=>setContractModal(t)}/>}

          {section==="casting" && <CastingBoard campaign={campaign}/>}

          {section==="looks" && <LooksScreen campaignId={campaign.id}/>}

          {section==="requirements" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold">Requirements</h2>
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
                  <h2 className="text-sm font-semibold">Deliverables</h2>
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
                  <h2 className="text-sm font-semibold">Contracts</h2>
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

          {section==="collaboration" && <CollaborationTab/>}

          {section==="users" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold">Campaign Users</h2>
                  <Btn variant="outline" size="sm" icon={<Plus size={12}/>}>Add / Remove</Btn>
                </div>
                <div className="space-y-2 mb-5">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Brand</div>
                  {ORG_USERS.filter(u=>u.org==="Acne Studios").slice(0,4).map(u=>(
                    <div key={u.id} className="glass-subtle border rounded-md px-4 py-3 flex items-center gap-3">
                      <UserAvatar name={u.name} className="w-7 h-7 text-[10px]"/>
                      <div className="flex-1 min-w-0"><div className="text-sm font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.title}</div></div>
                      <Badge label={u.access} variant={ACCESS_BADGE[u.access]}/>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Agency</div>
                  {ORG_USERS.filter(u=>u.org!=="Acne Studios").map(u=>(
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
        </div>
      </div>

      {contractModal && <ContractModal talent={contractModal} onSend={()=>setContractModal(null)} onLater={()=>setContractModal(null)}/>}
    </>
  );
}

// ─── COLLABORATION ───────────────────────────────────────────────────────────

type CollabScope = "internal" | "crossorg";

function CollaborationTab() {
  const brandUsers = ORG_USERS.filter(u=>u.org==="Acne Studios");
  const crossOrgUsers = ORG_USERS; // brand + agency, everyone on the campaign
  const ME = 1;

  const [scope, setScope] = useState<CollabScope>("crossorg");
  const [internalMsgs, setInternalMsgs] = useState([
    { id:1, from:3, text:"Mood board direction is locked — sharing the deck before we brief the agencies.", ts:"Jun 18, 4:10 PM" },
    { id:2, from:1, text:"Nice. Let's hold final budget sign-off until Priya confirms the number.", ts:"Jun 18, 4:22 PM" },
    { id:3, from:4, text:"Confirmed — $18,000 total, $5,150 committed so far.", ts:"Jun 18, 4:30 PM" },
  ]);
  const [crossOrgMsgs, setCrossOrgMsgs] = useState([
    { id:1, from:2, text:"Just finished reviewing the submissions. Zara and Amara are strong leads.", ts:"Jun 19, 9:14 AM"  },
    { id:2, from:1, text:"Agreed. I'd like to schedule a quick call to align before EOD.", ts:"Jun 19, 9:32 AM" },
    { id:3, from:7, text:"Hi team — we can confirm Amara is available the full window.", ts:"Jun 19, 10:05 AM" },
  ]);
  const [input, setInput] = useState("");

  const isInternal = scope === "internal";
  const msgs = isInternal ? internalMsgs : crossOrgMsgs;
  const setMsgs = isInternal ? setInternalMsgs : setCrossOrgMsgs;
  const users = isInternal ? brandUsers : crossOrgUsers;

  function send() {
    if (!input.trim()) return;
    setMsgs(p=>[...p,{ id:Date.now(), from:ME, text:input, ts:"Now" }]);
    setInput("");
  }

  const SCOPES: { id: CollabScope; label: string; Icon: typeof Lock }[] = [
    { id:"internal", label:"Brand Team", Icon:Lock  },
    { id:"crossorg", label:"Cross-Org",  Icon:Globe },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Scope switcher — one big cross-org groupchat, one internal to this org */}
      <div className="glass border-b px-6 pt-2.5 shrink-0">
        <div className="flex items-center gap-1">
          {SCOPES.map(s=>{
            const SIcon = s.Icon;
            return (
              <button key={s.id} onClick={()=>setScope(s.id)}
                className={cx("flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                  scope===s.id?"border-foreground text-foreground":"border-transparent text-muted-foreground hover:text-foreground"
                )}>
                <SIcon size={11}/>{s.label}
              </button>
            );
          })}
        </div>
      </div>
      {/* Scope banner — always visible so it's unambiguous who can see this thread */}
      <div className="px-6 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <div className="text-xs font-semibold">{isInternal ? "Acne Studios — Internal" : "AW25 Womenswear — Campaign Chat"}</div>
          <div className="text-[10px] text-muted-foreground">
            {isInternal ? `${users.length} people · Visible only to Acne Studios` : `${users.length} participants · Acne Studios + Elite Model Mgmt.`}
          </div>
        </div>
        <Badge label={isInternal ? "Internal" : "Shared with agency"} variant={isInternal ? "draft" : "info"}/>
      </div>
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
        {msgs.map(m => {
          const isMe = m.from === ME;
          const user = users.find(u=>u.id===m.from);
          return (
            <div key={m.id} className={cx("flex flex-col gap-1", isMe && "items-end")}>
              <div className={cx("rounded-xl px-4 py-2.5 text-sm max-w-md leading-relaxed", isMe ? "bg-foreground text-primary-foreground" : "bg-secondary text-foreground")}>{m.text}</div>
              <div className={cx("flex items-center gap-2 text-[10px] text-muted-foreground", isMe && "flex-row-reverse")}>
                <span className="font-medium">{isMe ? "Me" : user?.name ?? "Unknown"}</span>
                {!isMe && user && <span>· {user.org}</span>}
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
            placeholder={isInternal ? "Message your team…" : "Message the campaign group…"} rows={2}
            className="flex-1 bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none placeholder:text-muted-foreground"/>
          <button onClick={send} className="p-2.5 bg-foreground hover:bg-foreground/90 text-primary-foreground rounded-md transition-colors cursor-pointer shrink-0">
            <Send size={15}/>
          </button>
        </div>
      </div>
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

function CampaignsList({ openCampaign }: { openCampaign: (id: number) => void }) {
  const [tab, setTab] = useState("active");
  const [attentionOpen, setAttentionOpen] = useState(false);
  const attentionRef = useRef<HTMLDivElement>(null);
  const filtered = tab==="active"?CAMPAIGNS.filter(c=>c.status==="active"):tab==="drafts"?[]:CAMPAIGNS.filter(c=>c.status==="archived");
  const urgentCount = CAMPAIGNS_ATTENTION.filter(a=>a.urgent).length;

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
      <TopBar title="Campaigns" sub="Acne Studios · Brand"/>
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
            {urgentCount>0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-urgent text-urgent-foreground border-2 border-background text-[9px] font-bold rounded-full flex items-center justify-center">{urgentCount}</span>
            )}
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
  const byType = (t: string) => OVERDUE_ACTIONS.filter(a=>a.type===t).length;
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Urgent/Overdue" sub={`Acne Studios · ${OVERDUE_ACTIONS.length} actions past due`}/>
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-10">
          <div className="flex-1 min-w-0 max-w-2xl space-y-3">
            {OVERDUE_ACTIONS.map(a=>(
              <div key={a.id} className="glass-subtle border rounded-md p-4 flex items-start gap-3">
                <ExclamationIcon size={15} className="text-foreground mt-0.5 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge label={a.type} variant="draft"/>
                    <span className="text-[10px] font-mono text-muted-foreground">Due {a.due}</span>
                  </div>
                  <div className="text-sm">{a.msg}</div>
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
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] mt-2 text-primary-foreground/70">Urgent Tasks</div>
            </div>
            <div className="flex-1 flex flex-col">
              {[
                { label:"Payments",  value:byType("Payment") },
                { label:"Contracts", value:byType("Contract") },
                { label:"Reviews",   value:byType("Review") },
              ].map((s,i)=>(
                <div key={i} className={cx("flex-1 flex flex-col justify-center py-2", i>0 && "border-t border-border")}>
                  <div className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{s.value}</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-2">{s.label}</div>
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

const PARTNERED_AGENCIES = ["Elite Model Management","IMG Models","Wilhelmina","DNA Models"];
const CAMPAIGN_TYPES = ["Runway","Editorial","Advertising","E-commerce","TV Commercial","Beauty","Other"];

function CreateCampaign({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [genders, setGenders] = useState(["Female"]);
  const [cats, setCats] = useState(["Editorial"]);
  const [campaignType, setCampaignType] = useState("Editorial");
  const [customType, setCustomType] = useState("");
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>(PARTNERED_AGENCIES);
  const toggle = (arr: string[], val: string, set: (a:string[])=>void) =>
    set(arr.includes(val)?arr.filter(v=>v!==val):[...arr,val]);
  const allAgenciesSelected = selectedAgencies.length === PARTNERED_AGENCIES.length;
  const STEPS = [{n:1,label:"Basics"},{n:2,label:"Talent"},{n:3,label:"Brief"},{n:4,label:"Publish"}];
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
          {step===1&&(<><div><h2 className="text-base font-semibold mb-0.5">Campaign Basics</h2><p className="text-sm text-muted-foreground">Define the campaign and its timeline.</p></div>
            <div className="border-t border-border"/>
            <TextInput label="Campaign Name" placeholder="e.g. AW25 Womenswear Campaign"/>
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
              <TextInput label="Brand" placeholder="e.g. Acne Studios"/>
              <TextInput label="Shoot Start" placeholder="MM/DD/YYYY" type="date"/>
              <TextInput label="Shoot End" placeholder="MM/DD/YYYY" type="date"/>
            </div>
            <TextInput label="Location" placeholder="City, state, or studio address"/>
          </>)}
          {step===2&&(<><div><h2 className="text-base font-semibold mb-0.5">Talent Requirements</h2><p className="text-sm text-muted-foreground">Agencies match their roster to these requirements.</p></div>
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
          {step===3&&(<><div><h2 className="text-base font-semibold mb-0.5">Creative Brief</h2><p className="text-sm text-muted-foreground">Shared with agencies and their talent.</p></div>
            <div className="border-t border-border"/>
            <Textarea label="Campaign Brief" placeholder="Describe the creative concept, mood, and aesthetic direction…" rows={5}/>
            <div className="grid grid-cols-2 gap-4">
              <FSelect label="Usage Territory" options={["United States","North America","Worldwide"]}/>
              <FSelect label="Duration" options={["6 months","1 year","2 years","Unlimited"]}/>
            </div>
          </>)}
          {step===4&&(<><div><h2 className="text-base font-semibold mb-0.5">Review & Publish</h2><p className="text-sm text-muted-foreground">Distribute to agencies and open for submissions.</p></div>
            <div className="border-t border-border"/>
            <div className="bg-secondary border border-border rounded-md p-4">
              <div className="flex items-center justify-between mb-1">
                <FieldLabel>Distribute to partnered agencies</FieldLabel>
                <button onClick={()=>setSelectedAgencies(allAgenciesSelected?[]:PARTNERED_AGENCIES)}
                  className="text-[10px] font-mono text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer">
                  {allAgenciesSelected?"Clear all":"Select all"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {PARTNERED_AGENCIES.map(a=>(
                  <Chip key={a} active={selectedAgencies.includes(a)} onClick={()=>toggle(selectedAgencies,a,setSelectedAgencies)}>{a}</Chip>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mt-2">{selectedAgencies.length} of {PARTNERED_AGENCIES.length} selected</div>
            </div>
            <div className="glass-subtle border rounded-md p-4 flex items-start gap-2.5">
              <AlertCircle size={13} className="text-muted-foreground mt-0.5 shrink-0"/>
              <div className="text-xs text-muted-foreground leading-relaxed">No payment is due until talent is booked.</div>
            </div>
          </>)}
          <div className="flex items-center justify-between pt-6 border-t border-border">
            <div className="flex gap-2">
              {step>1&&<Btn variant="outline" onClick={()=>setStep(step-1)}><ChevronLeft size={13}/> Back</Btn>}
              <Btn variant="ghost" size="sm">Save draft</Btn>
            </div>
            {step<4?<Btn variant="primary" onClick={()=>setStep(step+1)}>Continue <ChevronRight size={13}/></Btn>
              :<Btn variant="primary" icon={<Check size={13}/>} disabled={selectedAgencies.length===0} onClick={onBack}>Publish Campaign</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GLOBAL CONTRACTS ─────────────────────────────────────────────────────────

function GlobalContracts() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Contracts" sub="All contracts · Acne Studios" actions={<Btn variant="primary" size="sm" icon={<Plus size={13}/>}>Generate Contract</Btn>}/>
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
        <div className="text-base font-semibold text-foreground">Processing payment…</div>
        <div className="text-xs text-muted-foreground font-mono">{campaign}</div>
      </>)}
      {(phase === "stamp" || phase === "done") && (<>
        <div className={cx("transition-all duration-500", phase === "stamp" ? "scale-150 opacity-0" : "scale-100 opacity-100")}><PaidStamp size={140}/></div>
        <div className="text-center space-y-1">
          <div className="text-base font-semibold text-foreground">Payment Authorized</div>
          <div className="text-sm text-[#16a34a] font-semibold">{amount} — Paid in Full</div>
          <div className="text-xs text-muted-foreground font-mono">{campaign}</div>
        </div>
        {phase === "done" && <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer">Close</button>}
      </>)}
    </div>
  );
}

function GlobalPayments() {
  const [showPayModal, setShowPayModal] = useState(false);
  const [payState, setPayState] = useState<"idle"|"processing">("idle");
  const [selectedBooking, setSelectedBooking] = useState<string>("");

  const outstanding = BOOKINGS.filter(b=>b.paymentStatus!=="paid");
  const selected = BOOKINGS.find(b=>b.id===selectedBooking);
  const bd = selected ? bookingBreakdown(selected) : null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Payments" sub="Acne Studios · Outstanding booking payments"/>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Outstanding" value={outstanding.length} sub="Bookings awaiting payment"/>
          <Stat label="Processing" value={BOOKINGS.filter(b=>b.paymentStatus==="processing").length}/>
          <Stat label="Paid this month" value={BOOKINGS.filter(b=>b.paymentStatus==="paid").length}/>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {outstanding.map(b=>{
            const breakdown = bookingBreakdown(b);
            return (
              <div key={b.id} onClick={()=>{setSelectedBooking(b.id);setShowPayModal(true);}}
                className="glass-subtle border rounded-xl p-5 cursor-pointer hover:border-foreground/40 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-mono text-muted-foreground">{b.id}</span>
                  <Badge label={b.paymentStatus==="processing"?"Processing":"Pending"} variant={b.paymentStatus==="processing"?"pending":"draft"}/>
                </div>
                <div className="mb-4">
                  <div className="text-sm font-semibold leading-snug mb-0.5">{b.campaign}</div>
                  <div className="text-xs text-muted-foreground">{b.agency} · {b.model}</div>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="text-[10px] text-muted-foreground font-mono">Gross Booking Value</div>
                  <div className="text-xl font-semibold font-mono">${breakdown.grossBookingValue.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showPayModal && selected && bd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-strong border rounded-xl w-full max-w-xl shadow-2xl overflow-hidden relative">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{selected.id}</div>
                <div className="text-xs text-muted-foreground">{selected.campaign} · {selected.agency}</div>
              </div>
              <button onClick={()=>setShowPayModal(false)} className="text-muted-foreground hover:text-foreground"><X size={16}/></button>
            </div>
            <div className="px-6 py-5">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Fee Breakdown</div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between py-2.5 border-b border-border">
                  <div><div className="text-sm">Model Fee — {selected.model}</div><div className="text-[10px] text-muted-foreground font-mono">{selected.days} day{selected.days>1?"s":""} × ${selected.dayRate.toLocaleString()}/day</div></div>
                  <div className="font-mono text-sm font-medium">${bd.modelFee.toLocaleString()}</div>
                </div>
                <div className="flex items-baseline justify-between py-2.5 border-b border-border">
                  <div><div className="text-sm">Agency Commission — {selected.agency}</div><div className="text-[10px] text-muted-foreground font-mono">{selected.agencyPct}% of model fee</div></div>
                  <div className="font-mono text-sm font-medium">${bd.agencyFee.toLocaleString()}</div>
                </div>
                <div className="flex items-baseline justify-between py-2.5 border-b border-border">
                  <div><div className="text-sm">Platform Fee</div><div className="text-[10px] text-muted-foreground font-mono">{selected.platformPct}% of model + agency fee</div></div>
                  <div className="font-mono text-sm font-medium">${bd.platformFee.toLocaleString()}</div>
                </div>
                <div className="flex items-center justify-between pt-4 mt-1 border-t-2 border-foreground">
                  <div className="text-sm font-semibold">Gross Booking Value</div>
                  <div className="text-2xl font-semibold font-mono">${bd.grossBookingValue.toLocaleString()}</div>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button onClick={()=>{ setPayState("processing"); setTimeout(()=>setShowPayModal(false), 3200); }}
                className="w-full py-3.5 rounded-md text-sm font-semibold tracking-widest uppercase bg-foreground hover:bg-foreground/90 text-primary-foreground transition-all cursor-pointer">
                Authorize Payment
              </button>
            </div>
            {payState==="processing" && <PaymentSuccessOverlay campaign={selected.campaign} amount={`$${bd.grossBookingValue.toLocaleString()}`} onClose={()=>{setPayState("idle");setShowPayModal(false);}}/>}
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
// on the right. Defaults straight into a blank New Message so there's zero
// clicks between landing on Messaging and starting to type, per the ask.
// Send/Reply are mocked (no recipients, no delivery) until there's a real
// backend to send through — that's expected at this stage.
type MessagingMode = "compose" | "view";

function MessagingScreen() {
  const [messages, setMessages] = useState(INBOX_MSGS);
  const [mode, setMode] = useState<MessagingMode>("compose");
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
    if (selectedId!==null && checked.includes(selectedId)) { setSelectedId(null); setMode("compose"); }
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
                    <span className={cx("text-xs truncate", !m.read&&"font-semibold")}>{m.sender}</span>
                    <span className="text-[9px] font-mono text-muted-foreground shrink-0">{m.date}</span>
                  </div>
                  <div className={cx("text-sm truncate mb-1", !m.read&&"font-semibold")}>{m.subject}</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground truncate">{m.org}</span>
                    {m.urgent && <span className="text-[8px] font-mono border border-urgent text-urgent px-1 py-0.5 rounded-sm tracking-wider shrink-0">URGENT</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          {mode==="compose"
            ? <ComposePane replyTo={selectedMsg}/>
            : selectedMsg && <MessageDetailPane msg={selectedMsg} onReply={()=>setMode("compose")} onToggleRead={()=>toggleRead(selectedMsg.id)}/>}
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
        <div className="text-sm font-semibold">New Message</div>
      </div>
      <div key={`${formKey}-${replyTo?.id ?? "new"}`} className="flex-1 overflow-auto p-6 space-y-4 max-w-xl">
        <TextInput label="To" placeholder="Search agencies or team members…" defaultValue={replyTo ? `${replyTo.sender} (${replyTo.org})` : undefined}/>
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

function MessageDetailPane({ msg, onReply, onToggleRead }: { msg: typeof INBOX_MSGS[number]; onReply: () => void; onToggleRead: () => void }) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-1">
          {msg.urgent && <span className="text-[8px] font-mono border border-urgent text-urgent px-1.5 py-0.5 rounded-sm tracking-wider">URGENT</span>}
          <div className="text-sm font-semibold">{msg.subject}</div>
        </div>
        <div className="text-xs text-muted-foreground">{msg.sender} · {msg.org} · {msg.title} · {msg.date}</div>
      </div>
      <div className="flex-1 overflow-auto p-6 max-w-xl">
        <p className="text-sm leading-relaxed">{msg.body}</p>
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
  const q = search.trim().toLowerCase();
  const filtered = ORG_USERS
    .filter(u=>filterAccess==="all" || u.access===filterAccess)
    .filter(u=> !q || [u.name,u.title,u.org,u.email].some(f=>f.toLowerCase().includes(q)));
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Directory" sub="Organization members and agency contacts"/>
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h2 className="text-sm font-semibold shrink-0">Members</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-border rounded-md bg-input-background overflow-hidden w-56">
              <Search size={13} className="text-muted-foreground ml-2.5 shrink-0"/>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search members…"
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
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(u=>(
              <div key={u.id} className="glass-subtle border rounded-md p-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={u.name} className="w-9 h-9 text-xs"/>
                    <div><div className="text-sm font-semibold">{u.name}</div><div className="text-xs text-muted-foreground">{u.title} · {u.org}</div></div>
                  </div>
                  <Badge label={u.access} variant={ACCESS_BADGE[u.access]}/>
                </div>
                <div className="text-xs text-muted-foreground">{u.email} · {u.phone}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────

function Reports() {
  const [running, setRunning] = useState<string|null>(null);
  const reportTypes = [
    { id:"ytd-finance",  label:"YTD Finance Report",       desc:"Total spend, payments, and budget utilization for the current fiscal year.", icon:BarChart2  },
    { id:"bookings",     label:"Booking Report",            desc:"All bookings by campaign, talent, agency, and date range.", icon:Briefcase     },
    { id:"campaigns",    label:"Campaign Report",           desc:"Per-campaign breakdown: submissions, approvals, bookings, and costs.", icon:Camera },
    { id:"agencies",     label:"Agency Performance Report", desc:"Submission volume, approval rate, and booking history by agency.", icon:Building2 },
  ];
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Reports" sub="Generate reports from available data"/>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl">
          <p className="text-sm text-muted-foreground mb-6">Generate reports from any data available in DVURE.</p>
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
                    <FSelect options={["Last 30 days","This quarter","YTD 2025"]}/>
                    <Btn variant={isRunning?"secondary":"primary"} size="sm" onClick={()=>setRunning(isRunning?null:r.id)}>{isRunning?"Close":"Run Report"}</Btn>
                  </div>
                  {isRunning&&(
                    <div className="mt-3 bg-secondary border border-border rounded-md p-3">
                      <div className="text-xs font-mono text-muted-foreground mb-2">Preview — {r.label}</div>
                      <div className="text-xs text-muted-foreground">Report data will appear here once wired to Supabase.</div>
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
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  <div className="text-center hidden md:block"><div className="text-sm font-semibold">{a.bookings}</div><div className="text-xs text-muted-foreground">Bookings</div></div>
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
      <TopBar title="Settings" sub="Acne Studios · Account settings"/>
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
                <div><h2 className="text-base font-semibold mb-0.5">Profile</h2><p className="text-sm text-muted-foreground">Your personal account details.</p></div>
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
                <div><h2 className="text-base font-semibold mb-0.5">Subscription</h2><p className="text-sm text-muted-foreground">Manage your DVURE Brand subscription.</p></div>
                <div className="glass-subtle border rounded-md overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div><div className="text-sm font-semibold">DVURE Brand</div><div className="text-xs text-muted-foreground">Professional plan · Billed monthly</div></div>
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
                <div><h2 className="text-base font-semibold mb-0.5">Billing</h2><p className="text-sm text-muted-foreground">Payment methods and billing history.</p></div>
                <div className="bg-secondary border border-border rounded-md px-4 py-3 text-xs text-muted-foreground">Billing is processed securely by Stripe — wired in Milestone C.</div>
              </div>
            )}
            {tab === "security" && (
              <div className="space-y-5">
                <div><h2 className="text-base font-semibold mb-0.5">Security</h2><p className="text-sm text-muted-foreground">Manage access and authentication settings.</p></div>
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
                <div><h2 className="text-base font-semibold mb-0.5">Organization</h2><p className="text-sm text-muted-foreground">Manage your brand profile.</p></div>
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
                <div><h2 className="text-base font-semibold mb-0.5">Notifications</h2><p className="text-sm text-muted-foreground">Choose how and when you're notified about upcoming payment due dates. Check as many as you'd like.</p></div>
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
  const [view, setView] = useState<AppView>("campaigns");
  const [globalNav, setGlobalNav] = useState<GlobalView>("campaigns");
  const [activeCampaignId, setActiveCampaignId] = useState<number>(1);
  const [campaignSection, setCampaignSection] = useState<CampaignSection>("moodboard");
  const [activityOpen, setActivityOpen] = useState(false);
  const activityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activityOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (activityRef.current && !activityRef.current.contains(e.target as Node)) setActivityOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [activityOpen]);

  function openCampaign(id: number) {
    const campaign = CAMPAIGNS.find(c=>c.id===id);
    setActiveCampaignId(id);
    setView("campaign");
    setCampaignSection(campaign?.type==="Runway" ? "casting" : "moodboard");
  }
  function backToCampaigns() { setView("campaigns"); setGlobalNav("campaigns"); }
  function handleGlobalNav(v: GlobalView) { setGlobalNav(v); setView(v); }

  const inCampaign = view === "campaign";

  // Relay is a hard context switch, not another campaign tab — its own
  // full-bleed console (own sidebar, dark-mode scoped), not nested inside
  // the normal light-mode chrome.
  if (view === "relay") return <RelayConsole onExit={()=>setView("campaign")}/>;

  return (
    <CurrentUserProvider user={{ name:ORG_USERS[0].name, title:ORG_USERS[0].title, org:ORG_USERS[0].org, email:ORG_USERS[0].email, phone:ORG_USERS[0].phone, access:ORG_USERS[0].access as "administrator"|"enhanced"|"basic", onSettings:()=>handleGlobalNav("settings") }}>
      <div className="h-screen flex bg-background overflow-hidden">
        {inCampaign ? (
          <CampaignWorkspace campaignId={activeCampaignId} section={campaignSection} onSection={setCampaignSection} onBack={backToCampaigns} onNewCampaign={()=>setView("create-campaign")} onHome={()=>handleGlobalNav("campaigns")} onOpenRelay={()=>setView("relay")}/>
        ) : (
          <>
            <BrandSidebar active={globalNav} onNav={handleGlobalNav} onOpenCampaign={openCampaign} onLogout={onLogout}/>
            <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {view==="campaigns"        && <CampaignsList openCampaign={openCampaign}/>}
              {view==="urgent"           && <UrgentOverdueScreen openCampaign={openCampaign}/>}
              {view==="create-campaign"  && <CreateCampaign onBack={()=>setView("campaigns")}/>}
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
