import { useState } from "react";
import {
  LayoutDashboard, Plus, ChevronRight, ChevronDown, ChevronLeft,
  X, Check, Star, Search, Briefcase,
  AlertCircle, Camera,
  MessageSquare, Download, CreditCard, MapPin,
  Settings, Building2,
  Calendar, FileText, Activity, BookOpen,
  BarChart2, FileCheck, Send, Edit3, Eye, ChevronUp,
  User, LogOut, Pin, Lock, Globe
} from "lucide-react";
import type { SubmissionStage, Talent, IconFn, CardComment } from "../shared/types";
import { cx, XBox, PolaroidIcon, Badge, Btn, Stat, FieldLabel, TextInput, FSelect, Textarea, Chip, SidebarBadge, TopBar, ActivityFeedPanel } from "../shared/ui";
import { SAMPLE_TALENT, PIPELINE_STAGES, DECLINE_REASONS, BOOKINGS, bookingBreakdown, ORG_USERS, ACCESS_BADGE, ACTIVITY_EVENTS, CARD_COMMENTS } from "../shared/mockData";

type GlobalView = "dashboard" | "campaigns" | "contracts-global" | "payments-global" | "messaging" | "reports" | "network" | "directory" | "settings";
type AppView = GlobalView | "campaign" | "create-campaign";
type CampaignSection = "overview" | "moodboard" | "requirements" | "deliverables" | "contracts" | "bookings" | "payments" | "activity" | "collaboration" | "users";

// ─── CONTRACT MODAL ────────────────────────────────────────────────────────

function ContractModal({ talent, onSend, onLater }: { talent: Talent; onSend: () => void; onLater: () => void }) {
  return (
    <div className="fixed inset-0 bg-foreground/25 backdrop-blur-sm flex items-center justify-center z-50">
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

const GLOBAL_NAV: { id: GlobalView; label: string; Icon: IconFn; badge?: number }[] = [
  { id:"dashboard",        label:"Dashboard",  Icon:LayoutDashboard        },
  { id:"campaigns",        label:"Campaigns",  Icon:Camera,        badge:3 },
  { id:"contracts-global", label:"Contracts",  Icon:FileCheck              },
  { id:"payments-global",  label:"Payments",   Icon:CreditCard             },
  { id:"messaging",        label:"Messaging",  Icon:MessageSquare          },
  { id:"reports",          label:"Reports",    Icon:BarChart2              },
  { id:"network",          label:"Network",    Icon:Building2              },
  { id:"directory",        label:"Directory",  Icon:User                   },
];

function BrandSidebar({ active, onNav, onOpenCampaign, onLogout }: {
  active: GlobalView; onNav: (v: GlobalView) => void; onOpenCampaign: () => void; onLogout: () => void;
}) {
  return (
    <aside className="w-52 shrink-0 glass border-r flex flex-col h-full">
      <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
        <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center shrink-0">
          <span className="text-primary-foreground text-xs font-bold">A</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">Acne Studios</div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Brand</div>
        </div>
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
        {["AW25 Womenswear","SS25 Fragrance","Resort Lookbook"].map(name => (
          <button key={name} onClick={onOpenCampaign}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-left">
            <Camera size={11}/><span className="truncate">{name}</span>
          </button>
        ))}
      </div>
      <div className="px-3 pb-3 border-t border-border pt-3 space-y-0.5">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer" onClick={() => onNav("settings")}>
          <XBox className="w-6 h-6 rounded-full"/>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">Marcus Webb</div>
            <div className="text-xs text-muted-foreground">Brand Director</div>
          </div>
          <Settings size={13} className="text-muted-foreground"/>
        </div>
        <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary">
          <LogOut size={13}/> Sign out
        </button>
      </div>
    </aside>
  );
}

const CAMPAIGN_NAV: { id: CampaignSection; label: string; Icon: IconFn }[] = [
  { id:"overview",      label:"Overview",      Icon:LayoutDashboard },
  { id:"moodboard",     label:"Submissions",   Icon:PolaroidIcon    },
  { id:"requirements",  label:"Requirements",  Icon:BookOpen        },
  { id:"deliverables",  label:"Deliverables",  Icon:Calendar        },
  { id:"contracts",     label:"Contracts",     Icon:FileCheck       },
  { id:"bookings",      label:"Bookings",      Icon:Briefcase       },
  { id:"payments",      label:"Payments",      Icon:CreditCard      },
  { id:"activity",      label:"Activity",      Icon:Activity        },
  { id:"collaboration", label:"Collaboration", Icon:MessageSquare   },
  { id:"users",         label:"Users",         Icon:User            },
];

function CampaignSidebar({ section, onSection, onBack, onNewCampaign, counts }: {
  section: CampaignSection; onSection: (s: CampaignSection) => void;
  onBack: () => void; onNewCampaign: () => void; counts: Record<string,number>;
}) {
  return (
    <aside className="w-52 shrink-0 glass border-r flex flex-col h-full">
      <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
        <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center shrink-0">
          <span className="text-primary-foreground text-xs font-bold">A</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">Acne Studios</div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Brand</div>
        </div>
      </div>
      <div className="px-3 pt-3 pb-2">
        <button onClick={onBack} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors text-left">
          <ChevronLeft size={13}/> All Campaigns
        </button>
      </div>
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-1"><Badge label="Active" variant="active"/></div>
        <div className="text-xs font-semibold leading-snug">AW25 Womenswear Campaign</div>
        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Editorial · Due 06/20/2025</div>
      </div>
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {CAMPAIGN_NAV.map(item => {
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
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-foreground text-primary-foreground text-xs font-medium rounded-md hover:bg-[#2a2a2a] transition-colors">
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
                      <span className={cx("text-xs font-mono px-1.5 py-0.5 rounded-sm font-semibold",stage.id==="booked"?"bg-white/20 text-primary-foreground":"bg-secondary text-foreground")}>{cards.length}</span>
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
                                      :a.label==="Book"||a.label==="Approve"?"bg-foreground text-primary-foreground hover:bg-[#2a2a2a]"
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
                    className="shrink-0 px-3 rounded-md bg-foreground text-primary-foreground text-xs font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-30 disabled:pointer-events-none">
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
                className="w-full py-2 text-xs font-medium bg-foreground text-primary-foreground rounded-md hover:bg-[#2a2a2a] transition-colors">
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
              return <button key={label} onClick={()=>bulkMove(selected,m[label],label)} className="text-xs font-medium bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md">{label}</button>;
            })}
            <button onClick={()=>bulkMove(selected,"rejected","Rejected")} className="text-xs text-white/60 hover:text-white hover:bg-white/10 px-2 py-1.5 rounded-md">Reject</button>
            <button onClick={()=>setSelected([])} className="ml-1 text-white/60 hover:text-white"><X size={15}/></button>
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
        <div className="fixed inset-0 bg-foreground/25 backdrop-blur-sm flex items-center justify-center z-50">
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

// ─── CAMPAIGN WORKSPACE ─────────────────────────────────────────────────────

function CampaignWorkspace({ section, onSection, onBack, onNewCampaign }: {
  section: CampaignSection; onSection: (s: CampaignSection) => void; onBack: () => void; onNewCampaign: () => void;
}) {
  const [talent, setTalent] = useState<Talent[]>(SAMPLE_TALENT);
  const [contractModal, setContractModal] = useState<Talent|null>(null);

  const counts: Record<string,number> = {
    submitted: talent.filter(t=>t.stage==="submitted").length,
    approved:  talent.filter(t=>t.stage==="approved").length,
    booked:    talent.filter(t=>t.stage==="booked").length,
    rejected:  talent.filter(t=>t.stage==="rejected").length,
  };

  const sectionLabel = CAMPAIGN_NAV.find(n=>n.id===section)?.label ?? "";
  const campaignBookings = BOOKINGS.filter(b=>b.campaign==="AW25 Womenswear Campaign");

  return (
    <>
      <CampaignSidebar section={section} onSection={onSection} onBack={onBack} onNewCampaign={onNewCampaign} counts={counts}/>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TopBar title={sectionLabel} sub="AW25 Womenswear Campaign"/>
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
                    <button className="w-full text-xs text-muted-foreground hover:text-foreground mt-3 text-left" onClick={()=>onSection("payments")}>View payments →</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section==="moodboard" && <Moodboard talent={talent} setTalent={setTalent} onContractPrompt={t=>setContractModal(t)}/>}

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

          {section==="payments" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Campaign Budget" value="$18,000"/>
                  <Stat label="Committed" value={`$${campaignBookings.reduce((s,b)=>s+bookingBreakdown(b).grossBookingValue,0).toLocaleString()}`}/>
                  <Stat label="Remaining" value="$12,850"/>
                </div>
                <div className="space-y-2">
                  {campaignBookings.map(b=>{
                    const bd = bookingBreakdown(b);
                    return (
                      <div key={b.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{b.model}</div>
                          <div className="text-xs text-muted-foreground">{b.agency} · Shoot {b.shootDate}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm">${bd.grossBookingValue.toLocaleString()}</span>
                          <Badge label={b.paymentStatus==="paid"?"Paid":b.paymentStatus==="processing"?"Processing":"Pending"} variant={b.paymentStatus==="paid"?"active":b.paymentStatus==="processing"?"pending":"draft"}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                      <XBox className="w-7 h-7 rounded-full shrink-0"/>
                      <div className="flex-1 min-w-0"><div className="text-sm font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.title}</div></div>
                      <Badge label={u.access} variant={ACCESS_BADGE[u.access]}/>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Agency</div>
                  {ORG_USERS.filter(u=>u.org!=="Acne Studios").map(u=>(
                    <div key={u.id} className="glass-subtle border rounded-md px-4 py-3 flex items-center gap-3">
                      <XBox className="w-7 h-7 rounded-full shrink-0"/>
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
          <button onClick={send} className="p-2.5 bg-foreground hover:bg-[#2a2a2a] text-primary-foreground rounded-md transition-colors cursor-pointer shrink-0">
            <Send size={15}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function Dashboard({ openCampaign }: { openCampaign: () => void }) {
  const campaigns = [
    { name:"AW25 Womenswear Campaign", type:"Editorial",  submitted:14, approved:6, booked:2, dueLabel:"Due tomorrow",    dueUrgency:"high",   budget:18000, committed:5150, remaining:12850, talentNeeded:4 },
    { name:"SS25 Fragrance Launch",    type:"Commercial", submitted:9,  approved:4, booked:0, dueLabel:"5 days remaining", dueUrgency:"medium", budget:10000, committed:0,    remaining:10000, talentNeeded:2 },
    { name:"Resort Lookbook 2025",     type:"E-commerce", submitted:21, approved:7, booked:0, dueLabel:"14 days",          dueUrgency:"low",    budget:7000,  committed:0,    remaining:7000,  talentNeeded:3 },
  ];
  const attention = [
    { icon:"⚡", msg:"AW25 Womenswear — due tomorrow. 14 submissions need review.", action:"Review now", urgent:true  },
    { icon:"✉",  msg:"1 unsent contract for Zara Okafor pending signature.",        action:"Send",       urgent:true  },
    { icon:"👤", msg:"SS25 Fragrance — 9 submissions awaiting first review.",       action:"Review",     urgent:false },
  ];
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Dashboard" sub="Acne Studios · Brand"/>
      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="glass-subtle border rounded-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <AlertCircle size={13} className="text-foreground shrink-0"/>
            <span className="text-xs font-semibold">Needs Attention</span>
            <span className="ml-1 text-[10px] font-mono bg-foreground text-primary-foreground px-1.5 py-0.5 rounded-sm">{attention.length}</span>
          </div>
          <div className="divide-y divide-border">
            {attention.map((a,i)=>(
              <div key={i} className={cx("px-4 py-3 flex items-center gap-3", a.urgent&&"bg-muted/30")}>
                <span className="text-sm shrink-0">{a.icon}</span>
                <span className="flex-1 text-sm">{a.msg}</span>
                <button onClick={openCampaign}
                  className={cx("text-xs font-medium px-3 py-1.5 rounded-md border shrink-0 transition-colors",
                    a.urgent?"bg-foreground text-primary-foreground border-foreground hover:bg-[#2a2a2a]":"border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  )}>{a.action}</button>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold mb-3">Active Campaigns</h2>
            <div className="space-y-3">
              {campaigns.map(c=>{
                const conv = c.submitted > 0 ? Math.round((c.booked/c.submitted)*100) : 0;
                return (
                  <div key={c.name} className="glass-subtle border rounded-md p-4 cursor-pointer hover:border-foreground/30 transition-colors" onClick={openCampaign}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="text-sm font-semibold">{c.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground font-mono">{c.type}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className={cx("text-xs font-semibold", c.dueUrgency==="high"?"text-foreground":"text-muted-foreground")}>
                            {c.dueUrgency==="high"&&"⚡ "}{c.dueLabel}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-muted-foreground">{c.submitted}→{c.booked} ({conv}%)</span>
                        <Badge label="Active" variant="active"/>
                      </div>
                    </div>
                    <div className="flex items-stretch gap-0 border border-border rounded-md overflow-hidden text-center text-xs mb-2">
                      {[{ l:"Submitted", v:c.submitted },{ l:"Approved", v:c.approved },{ l:"Booked", v:c.booked, note:`of ${c.talentNeeded}` }].map((s,i,arr)=>(
                        <div key={s.l} className={cx("flex-1 py-2 border-r border-border last:border-0", i===arr.length-1&&s.v>0?"bg-foreground":"")}>
                          <div className={cx("font-semibold tabular-nums", i===arr.length-1&&s.v>0?"text-primary-foreground":"")}>{s.v}</div>
                          <div className={cx("text-[9px] font-mono leading-tight", i===arr.length-1&&s.v>0?"text-primary-foreground/70":"text-muted-foreground")}>
                            {s.l}{s.note&&<span className="block opacity-70">{s.note}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Budget <span className="font-mono font-medium text-foreground">${c.budget.toLocaleString()}</span></span>
                      <span>Committed <span className="font-mono font-medium text-foreground">${c.committed.toLocaleString()}</span></span>
                      <span>Remaining <span className="font-mono font-medium text-foreground">${c.remaining.toLocaleString()}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              {[
                { label:"Unsent Contracts",      value:"1",  action:"Send now", urgent:true  },
                { label:"Submissions to Review", value:"44", action:"Review",   urgent:false },
                { label:"Active Campaigns",      value:"3",  action:"View all", urgent:false },
              ].map(s=>(
                <div key={s.label} className={cx("glass-subtle border rounded-md px-4 py-3 flex items-center justify-between gap-3",s.urgent?"border-foreground":"border-border")}>
                  <div>
                    <div className="text-xl font-semibold tabular-nums">{s.value}</div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">{s.label}</div>
                  </div>
                  <button onClick={openCampaign}
                    className={cx("text-xs font-medium px-3 py-1.5 rounded-md border shrink-0 transition-colors",
                      s.urgent?"bg-foreground text-primary-foreground border-foreground hover:bg-[#2a2a2a]":"border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    )}>{s.action}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CAMPAIGNS LIST ───────────────────────────────────────────────────────────

function CampaignsList({ openCampaign }: { openCampaign: () => void }) {
  const [tab, setTab] = useState("active");
  const all = [
    { name:"AW25 Womenswear Campaign", type:"Editorial",  status:"active",   due:"06/20", submitted:14, approved:6, booked:2 },
    { name:"SS25 Fragrance Launch",    type:"Commercial", status:"active",   due:"06/24", submitted:9,  approved:4, booked:0 },
    { name:"Resort Lookbook 2025",     type:"E-commerce", status:"active",   due:"07/03", submitted:21, approved:7, booked:0 },
    { name:"FW24 Campaign",            type:"Editorial",  status:"archived", due:"01/15", submitted:41, approved:11, booked:3 },
  ];
  const filtered = tab==="active"?all.filter(c=>c.status==="active"):tab==="drafts"?[]:all.filter(c=>c.status==="archived");
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Campaigns" sub="All campaigns · Acne Studios"/>
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-4 border-b border-border">
              {["active","drafts","archived"].map(t=>(
                <button key={t} onClick={()=>setTab(t)}
                  className={cx("px-4 py-2.5 text-sm capitalize border-b-2 -mb-px transition-colors",
                    tab===t?"border-foreground text-foreground font-medium":"border-transparent text-muted-foreground hover:text-foreground"
                  )}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
              ))}
            </div>
            {filtered.length===0 ? (
              <div className="glass-subtle border border-dashed rounded-md p-10 text-center">
                <div className="text-sm text-muted-foreground mb-3">No {tab} campaigns</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filtered.map(c=>(
                  <div key={c.name} className="glass-subtle border rounded-md p-4 cursor-pointer hover:border-foreground/40 hover:shadow-md transition-all flex gap-3" onClick={openCampaign}>
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
                        <div key={l} className={cx("text-center rounded-sm py-1", i===arr.length-1&&v>0?"bg-foreground":"")}>
                          <div className={cx("text-sm font-semibold tabular-nums", i===arr.length-1&&v>0?"text-primary-foreground":"")}>{v}</div>
                          <div className={cx("text-[8px] font-mono uppercase tracking-wide leading-tight", i===arr.length-1&&v>0?"text-primary-foreground/70":"text-muted-foreground")}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Standing summary column — flat and architectural rather than
              boxed: a single hairline rule, no fill, no rounded corners.
              Large light-weight serif numerals do the work instead of
              chrome. Rows stretch to fill the full column height so the
              column commands real presence instead of trailing into
              empty page beneath a short stack. */}
          <div className="w-80 shrink-0 border-l border-border pl-10 flex flex-col">
            {[
              { label:"Total",       value:"4",  sub:"3 active"       },
              { label:"Submissions", value:"44", sub:"Across active"  },
              { label:"Approved",    value:"17", sub:"Pending booking"},
              { label:"Booked",      value:"5",  sub:"This quarter"   },
            ].map((s,i)=>(
              <div key={s.label} className={cx("flex-1 flex flex-col justify-center py-2", i>0 && "border-t border-border")}>
                <div className="font-display text-6xl font-light tabular-nums tracking-tight">{s.value}</div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.25em] mt-3">{s.label}</div>
                <div className="text-xs text-muted-foreground/70 mt-1">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CREATE CAMPAIGN ──────────────────────────────────────────────────────────

const PARTNERED_AGENCIES = ["Elite Model Management","IMG Models","Wilhelmina","DNA Models"];

function CreateCampaign({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [genders, setGenders] = useState(["Female"]);
  const [cats, setCats] = useState(["Editorial"]);
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
              <FSelect label="Type" options={["Select…","Editorial","Commercial","Runway","Beauty","E-commerce"]}/>
              <TextInput label="Brand" placeholder="e.g. Acne Studios"/>
              <TextInput label="Shoot Start" placeholder="MM/DD/YYYY" type="date"/>
              <TextInput label="Shoot End" placeholder="MM/DD/YYYY" type="date"/>
            </div>
            <TextInput label="Location" placeholder="City, state, or studio address"/>
          </>)}
          {step===2&&(<><div><h2 className="text-base font-semibold mb-0.5">Talent Requirements</h2><p className="text-sm text-muted-foreground">Agencies match their roster to these requirements.</p></div>
            <div className="border-t border-border"/>
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
        <div className="fixed inset-0 bg-foreground/25 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
                className="w-full py-3.5 rounded-md text-sm font-semibold tracking-widest uppercase bg-foreground hover:bg-[#2a2a2a] text-primary-foreground transition-all cursor-pointer">
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
  { id:1, urgent:true,  date:"Jun 19, 2:14 PM", subject:"Payout requested — Booking #0841",              sender:"Sophie Chen",  org:"Elite Model Mgmt.", title:"Senior Agent",    campaign:"AW25 Womenswear", read:false, body:"Please review and authorize payment for the AW25 Womenswear booking. Let us know if you have any questions." },
  { id:2, urgent:false, date:"Jun 18, 10:30 AM",subject:"Talent availability confirmed — Amara Diallo",  sender:"James Kirk",   org:"Elite Model Mgmt.", title:"Booking Agent",   campaign:"AW25 Womenswear", read:false, body:"Amara has confirmed availability for the full window, 07/14–07/15. Please proceed with the contract." },
  { id:3, urgent:false, date:"Jun 17, 4:05 PM", subject:"Rate question — SS25 Fragrance",                sender:"Diana Park",   org:"IMG Models",        title:"Agent",           campaign:"SS25 Fragrance",  read:true,  body:"Following up on rates for Mila's booking. Please advise." },
];

function MessagingScreen() {
  const [openMsg, setOpenMsg] = useState<typeof INBOX_MSGS[number]|null>(null);
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Messaging" sub="Organization and agency communications"/>
      <div className="bg-muted/30 border-b border-border px-4 py-2 flex items-center shrink-0 gap-2">
        <div className="w-16 shrink-0 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Urgent</div>
        <div className="w-36 shrink-0 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Date / Time</div>
        <div className="flex-1 min-w-0 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Subject</div>
        <div className="w-28 shrink-0 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Sender</div>
        <div className="w-36 shrink-0 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Organization</div>
      </div>
      <div className="flex-1 overflow-auto divide-y divide-border">
        {INBOX_MSGS.map(m=>(
          <div key={m.id} onClick={()=>setOpenMsg(m)} className={cx("flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-secondary transition-colors", !m.read&&"bg-muted/20")}>
            <div className="w-16 shrink-0">{m.urgent&&<span className="text-[8px] font-mono border border-[#C0392B] text-[#C0392B] px-1.5 py-0.5 rounded-sm tracking-wider">URGENT</span>}</div>
            <div className="w-36 shrink-0 text-[10px] font-mono text-muted-foreground leading-tight">{m.date}</div>
            <div className={cx("flex-1 min-w-0 text-sm truncate", !m.read&&"font-semibold")}>{m.subject}</div>
            <div className="w-28 shrink-0 text-xs truncate">{m.sender}</div>
            <div className="w-36 shrink-0 text-xs text-muted-foreground truncate">{m.org}</div>
          </div>
        ))}
      </div>
      {openMsg && (
        <div className="fixed inset-0 bg-foreground/25 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-strong border rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4 shrink-0">
              <div>
                <div className="text-sm font-semibold mt-1">{openMsg.subject}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{openMsg.sender} · {openMsg.org} · {openMsg.title}</div>
              </div>
              <button onClick={()=>setOpenMsg(null)} className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"><X size={16}/></button>
            </div>
            <div className="px-6 py-5 flex-1 overflow-auto"><p className="text-sm leading-relaxed">{openMsg.body}</p></div>
            <div className="border-t border-border px-6 py-3 flex items-center gap-2 shrink-0">
              <Btn variant="primary" size="sm">Reply</Btn>
              <Btn variant="ghost" size="sm" onClick={()=>setOpenMsg(null)}>Close</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DIRECTORY ───────────────────────────────────────────────────────────────

function DirectoryScreen() {
  const [filterAccess, setFilterAccess] = useState("all");
  const filtered = filterAccess==="all" ? ORG_USERS : ORG_USERS.filter(u=>u.access===filterAccess);
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Directory" sub="Organization members and agency contacts"/>
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Members</h2>
          <div className="flex items-center gap-1">
            {["all","administrator","enhanced","basic"].map(a=>(
              <button key={a} onClick={()=>setFilterAccess(a)}
                className={cx("text-[9px] font-mono px-2 py-1 rounded-sm border cursor-pointer capitalize transition-colors",
                  filterAccess===a?"bg-foreground text-primary-foreground border-foreground":"border-border text-muted-foreground hover:border-foreground"
                )}>{a}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(u=>(
            <div key={u.id} className="glass-subtle border rounded-md p-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-secondary border border-border rounded-full flex items-center justify-center text-xs font-semibold shrink-0">
                    {u.name.split(" ").map((n:string)=>n[0]).join("").slice(0,2)}
                  </div>
                  <div><div className="text-sm font-semibold">{u.name}</div><div className="text-xs text-muted-foreground">{u.title} · {u.org}</div></div>
                </div>
                <Badge label={u.access} variant={ACCESS_BADGE[u.access]}/>
              </div>
              <div className="text-xs text-muted-foreground">{u.email} · {u.phone}</div>
            </div>
          ))}
        </div>
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

function SettingsScreen({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"subscription"|"billing"|"security"|"org">("subscription");
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Settings" sub="Acne Studios · Account and billing"/>
      <div className="flex-1 flex min-h-0">
        <div className="w-44 shrink-0 border-r glass px-2 py-4 space-y-0.5">
          {[["subscription","Subscription"],["billing","Billing"],["security","Security"],["org","Organization"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id as typeof tab)}
              className={cx("w-full text-left px-3 py-2 text-sm rounded-md cursor-pointer transition-colors",
                tab===id?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}>{label}</button>
          ))}
          <div className="pt-4 border-t border-border mt-4">
            <button onClick={onLogout} className="w-full text-left px-3 py-2 text-sm rounded-md cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center gap-2">
              <LogOut size={13}/> Sign out
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-xl">
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
                <div className="space-y-3">
                  <TextInput label="Organization Name" placeholder="e.g. Acne Studios" defaultValue="Acne Studios"/>
                  <FSelect label="Industry" options={["Fashion & Luxury","Beauty","Sportswear","Commercial"]}/>
                  <div className="flex justify-end pt-2"><Btn variant="primary">Save Changes</Btn></div>
                </div>
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
  const [view, setView] = useState<AppView>("dashboard");
  const [globalNav, setGlobalNav] = useState<GlobalView>("dashboard");
  const [campaignSection, setCampaignSection] = useState<CampaignSection>("moodboard");
  const [activityOpen, setActivityOpen] = useState(false);

  function openCampaign() { setView("campaign"); setCampaignSection("moodboard"); }
  function backToCampaigns() { setView("campaigns"); setGlobalNav("campaigns"); }
  function handleGlobalNav(v: GlobalView) { setGlobalNav(v); setView(v); }

  const inCampaign = view === "campaign";

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {inCampaign ? (
        <CampaignWorkspace section={campaignSection} onSection={setCampaignSection} onBack={backToCampaigns} onNewCampaign={()=>setView("create-campaign")}/>
      ) : (
        <>
          <BrandSidebar active={globalNav} onNav={handleGlobalNav} onOpenCampaign={openCampaign} onLogout={onLogout}/>
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {view==="dashboard"        && <Dashboard openCampaign={openCampaign}/>}
            {view==="campaigns"        && <CampaignsList openCampaign={openCampaign}/>}
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

      <div className="fixed bottom-6 right-6 z-40 group">
        {activityOpen ? (
          <div className="w-72 glass-subtle border rounded-md shadow-xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
              <div className="text-xs font-semibold">Activity</div>
              <button onClick={()=>setActivityOpen(false)} className="text-muted-foreground hover:text-foreground w-5 h-5 flex items-center justify-center rounded hover:bg-secondary transition-colors">
                <span className="text-sm font-bold leading-none">−</span>
              </button>
            </div>
            <ActivityFeedPanel permanent/>
          </div>
        ) : (
          <button onClick={()=>setActivityOpen(true)} className="w-10 h-10 bg-foreground text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:bg-[#2a2a2a] transition-colors">
            <Activity size={16}/>
          </button>
        )}
      </div>
    </div>
  );
}
