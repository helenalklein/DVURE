import { useState } from "react";
import {
  LayoutDashboard, Plus, ChevronRight, ChevronDown, ChevronLeft,
  X, Check, Star, Upload, Search, Bell, Briefcase,
  AlertCircle, CheckCircle, Circle, Camera,
  MessageSquare, Download, CreditCard, MapPin,
  Settings, DollarSign, Building2, Filter,
  Calendar, FileText, Grip, Activity, Layers, BookOpen,
  BarChart2, FileCheck, Send, Edit3, Eye, Paperclip, ChevronUp,
  User, Users, LogOut, Lock, Mail, Building, Phone,
  Globe, ArrowRight, Shield
} from "lucide-react";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type AuthStep = "login" | "signup" | "os-select" | "app";
type OSType = "brand" | "agency" | "model";
type GlobalView = "dashboard" | "campaigns" | "contracts-global" | "payments-global" | "messaging" | "reports" | "network" | "directory" | "settings";
type AppView = GlobalView | "campaign" | "create-campaign";
type CampaignSection = "overview" | "moodboard" | "requirements" | "deliverables" | "contracts" | "bookings" | "payments" | "activity" | "collaboration" | "users";
type TalentStage = "submitted" | "shortlisted" | "selected" | "booked" | "rejected";
type Availability = "available" | "pending" | "unavailable";
type PayTab = "pending" | "awaiting" | "paid";

interface Talent {
  id: number; name: string; agency: string; location: string; rate: string;
  stage: TalentStage; avail: Availability; group: string; note: string;
  height: string; bust: string; waist: string; dress: string; exp: string; score: number;
}

type IconFn = (props: { size?: number; className?: string }) => JSX.Element | null;

// ─── DATA ─────────────────────────────────────────────────────────────────────

const SAMPLE_TALENT: Talent[] = [
  { id:1,  name:"Zara Okafor",     agency:"Elite Model Mgmt.", location:"New York, NY",    rate:"$980/day",   stage:"shortlisted", avail:"available",   group:"Campaign Leads",    note:"Strong editorial presence.", height:`5'10"`, bust:`34"`, waist:`24"`, dress:"US 4",  exp:"8 yrs",  score:5 },
  { id:2,  name:"Amara Diallo",    agency:"Elite Model Mgmt.", location:"Paris, FR",       rate:"$1,150/day", stage:"selected",    avail:"available",   group:"",                  note:"Selected. Initiating booking.", height:`5'11"`, bust:`34"`, waist:`25"`, dress:"US 4",  exp:"10 yrs", score:5 },
  { id:3,  name:"Mila Tran",       agency:"IMG Models",        location:"Los Angeles, CA", rate:"$1,100/day", stage:"submitted",   avail:"pending",     group:"",                  note:"", height:`5'9"`,  bust:`33"`, waist:`24"`, dress:"US 2",  exp:"6 yrs",  score:4 },
  { id:4,  name:"Petra Novak",     agency:"IMG Models",        location:"Milan, IT",       rate:"$920/day",   stage:"submitted",   avail:"available",   group:"",                  note:"", height:`5'9"`,  bust:`33"`, waist:`23"`, dress:"US 4",  exp:"5 yrs",  score:4 },
  { id:5,  name:"Ines Ferreira",   agency:"Storm Models",      location:"London, UK",      rate:"$1,340/day", stage:"shortlisted", avail:"available",   group:"Supporting Talent", note:"Versatile.", height:`6'0"`,  bust:`35"`, waist:`25"`, dress:"US 6",  exp:"9 yrs",  score:5 },
  { id:6,  name:"Nadia Petrov",    agency:"Next Models",       location:"New York, NY",    rate:"$1,070/day", stage:"shortlisted", avail:"pending",     group:"Supporting Talent", note:"", height:`5'10"`, bust:`34"`, waist:`24"`, dress:"US 4",  exp:"7 yrs",  score:4 },
  { id:7,  name:"Caleb Stone",     agency:"Wilhelmina",        location:"Chicago, IL",     rate:"$890/day",   stage:"submitted",   avail:"available",   group:"",                  note:"", height:`6'1"`,  bust:`38"`, waist:`30"`, dress:"US M",  exp:"4 yrs",  score:4 },
  { id:8,  name:"Sofia Brandt",    agency:"DNA Models",        location:"Miami, FL",       rate:"$1,200/day", stage:"booked",      avail:"available",   group:"",                  note:"Contract executed. Shoot 07/22.", height:`5'10"`, bust:`34"`, waist:`24"`, dress:"US 4",  exp:"11 yrs", score:5 },
  { id:9,  name:"James Whitfield", agency:"Elite Model Mgmt.", location:"New York, NY",    rate:"$950/day",   stage:"booked",      avail:"available",   group:"",                  note:"Contract executed. Shoot 07/14.", height:`6'0"`,  bust:`38"`, waist:`30"`, dress:"US M",  exp:"6 yrs",  score:5 },
  { id:10, name:"Lena Vogel",      agency:"IMG Models",        location:"Berlin, DE",      rate:"$780/day",   stage:"submitted",   avail:"available",   group:"",                  note:"", height:`5'9"`,  bust:`33"`, waist:`23"`, dress:"US 2",  exp:"3 yrs",  score:3 },
  { id:11, name:"Amir Hassan",     agency:"Storm Models",      location:"London, UK",      rate:"$1,050/day", stage:"rejected",    avail:"unavailable", group:"",                  note:"Does not meet brief requirements.", height:`6'0"`,  bust:`37"`, waist:`29"`, dress:"US L",  exp:"5 yrs",  score:3 },
  { id:12, name:"Chiara Russo",    agency:"Next Models",       location:"Rome, IT",        rate:"$860/day",   stage:"shortlisted", avail:"available",   group:"Backup Options",    note:"Hold as backup.", height:`5'8"`,  bust:`33"`, waist:`23"`, dress:"US 2",  exp:"4 yrs",  score:4 },
  { id:13, name:"Maya Chen",       agency:"Elite Model Mgmt.", location:"Los Angeles, CA", rate:"$1,080/day", stage:"submitted",   avail:"available",   group:"",                  note:"", height:`5'9"`,  bust:`33"`, waist:`24"`, dress:"US 4",  exp:"7 yrs",  score:4 },
  { id:14, name:"Priya Sharma",    agency:"DNA Models",        location:"New York, NY",    rate:"$920/day",   stage:"submitted",   avail:"pending",     group:"",                  note:"", height:`5'10"`, bust:`34"`, waist:`24"`, dress:"US 4",  exp:"5 yrs",  score:4 },
];

const PIPELINE_STAGES: { id: TalentStage; label: string }[] = [
  { id:"submitted",  label:"Submitted"   },
  { id:"shortlisted",label:"Shortlisted" },
  { id:"selected",   label:"Selected"    },
  { id:"booked",     label:"Booked"      },
];

const ACTIVITY_EVENTS = [
  { id:1,  ts:"Jun 15, 2:05 PM", actor:"Acne Studios",      type:"Talent moved to Selected",    detail:"Amara Diallo moved from Shortlisted to Selected.",     system:false },
  { id:2,  ts:"Jun 15, 11:20 AM",actor:"Elite Model Mgmt.", type:"Submission received",         detail:"4 talent submitted to AW25 Womenswear.",               system:false },
  { id:3,  ts:"Jun 14, 4:01 PM", actor:"System",            type:"Contract generated",          detail:"CF-2025-0841 generated for James Whitfield.",           system:true  },
  { id:4,  ts:"Jun 14, 3:14 PM", actor:"Acne Studios",      type:"Contract signed",             detail:"CF-2025-0841 countersigned by brand.",                  system:false },
  { id:5,  ts:"Jun 14, 11:30 AM",actor:"Elite Model Mgmt.", type:"Contract signed by agency",   detail:"Sophie Chen signed CF-2025-0841.",                      system:false },
  { id:6,  ts:"Jun 13, 1:22 PM", actor:"Acne Studios",      type:"Talent shortlisted",          detail:"Zara Okafor and Ines Ferreira shortlisted.",            system:false },
  { id:7,  ts:"Jun 12, 9:00 AM", actor:"System",            type:"Invoice submitted",           detail:"Elite Model Mgmt. submitted invoice $2,940.",           system:true  },
  { id:8,  ts:"Jun 10, 11:02 AM",actor:"Elite Model Mgmt.", type:"Talent submitted",            detail:"4 talent submitted to campaign.",                       system:false },
  { id:9,  ts:"Jun 10, 9:14 AM", actor:"System",            type:"Campaign published",          detail:"AW25 Womenswear distributed to 5 agencies.",            system:true  },
];

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────

const cx = (...cs: (string|false|undefined)[]) => cs.filter(Boolean).join(" ");

function XBox({ className = "" }: { className?: string }) {
  return (
    <div className={cx("bg-muted relative overflow-hidden flex items-center justify-center", className)}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="0" x2="100" y2="100" stroke="#D0D0D0" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
        <line x1="100" y1="0" x2="0" y2="100" stroke="#D0D0D0" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
      </svg>
    </div>
  );
}

// Custom polaroid icon — outline of a polaroid photo
function PolaroidIcon({ size = 15, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="2" width="18" height="21" rx="1.5"/>
      <rect x="6" y="5" width="12" height="11" rx="1"/>
      <line x1="9" y1="19" x2="15" y2="19"/>
    </svg>
  );
}

function Badge({ label, variant = "default" }: { label: string; variant?: "default"|"active"|"pending"|"draft"|"success"|"warning"|"info" }) {
  const s: Record<string,string> = {
    default:"bg-secondary text-secondary-foreground", active:"bg-foreground text-primary-foreground",
    pending:"bg-accent border border-border text-muted-foreground", draft:"bg-muted text-muted-foreground",
    success:"bg-secondary border border-foreground/30 text-foreground", warning:"bg-secondary border border-muted-foreground text-foreground",
    info:"bg-secondary text-foreground border border-border",
  };
  return <span className={cx("inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium font-mono whitespace-nowrap", s[variant])}>{label}</span>;
}

function Btn({ children, variant="primary", size="md", onClick, disabled, fullWidth, icon }: {
  children: string | JSX.Element | (string | JSX.Element)[];
  variant?: "primary"|"secondary"|"ghost"|"outline";
  size?: "sm"|"md"|"lg"; onClick?: () => void; disabled?: boolean; fullWidth?: boolean; icon?: JSX.Element;
}) {
  const base = "inline-flex items-center justify-center gap-1.5 font-medium rounded-md transition-colors cursor-pointer select-none";
  const sizes = { sm:"px-3 py-1.5 text-xs", md:"px-4 py-2 text-sm", lg:"px-5 py-2.5 text-sm" };
  const variants = {
    primary:"bg-foreground text-primary-foreground hover:bg-[#2a2a2a]",
    secondary:"bg-secondary text-secondary-foreground border border-border hover:bg-accent",
    ghost:"text-muted-foreground hover:text-foreground hover:bg-accent",
    outline:"bg-card text-foreground border border-border hover:bg-secondary",
  };
  return <button className={cx(base, sizes[size], variants[variant], fullWidth&&"w-full", disabled&&"opacity-40 pointer-events-none")} onClick={onClick}>{icon}{children}</button>;
}

function Stat({ label, value, sub, accent }: { label: string; value: string|number; sub?: string; accent?: boolean }) {
  return (
    <div className={cx("border rounded-md p-4", accent ? "bg-foreground border-foreground" : "bg-card border-border")}>
      <div className={cx("text-xs font-mono mb-1", accent ? "text-primary-foreground/70" : "text-muted-foreground")}>{label}</div>
      <div className={cx("text-2xl font-semibold tabular-nums", accent ? "text-primary-foreground" : "")}>{value}</div>
      {sub && <div className={cx("text-xs mt-0.5", accent ? "text-primary-foreground/60" : "text-muted-foreground")}>{sub}</div>}
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">{children}</div>;
}

function TextInput({ label, placeholder, type="text", defaultValue }: { label?: string; placeholder: string; type?: string; defaultValue?: string }) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <input type={type} placeholder={placeholder} defaultValue={defaultValue} className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground"/>
    </div>
  );
}

function FSelect({ label, options }: { label?: string; options: string[] }) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="relative">
        <select className="w-full appearance-none bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground pr-8">
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"/>
      </div>
    </div>
  );
}

function Textarea({ label, placeholder, rows=3, defaultValue }: { label?: string; placeholder: string; rows?: number; defaultValue?: string }) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <textarea placeholder={placeholder} rows={rows} defaultValue={defaultValue} className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground resize-none"/>
    </div>
  );
}

function Chip({ children, active, onClick }: { children: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cx("px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
      active?"bg-foreground text-primary-foreground border-foreground":"bg-card border-border text-muted-foreground hover:border-foreground hover:text-foreground"
    )}>{children}</button>
  );
}

function SidebarBadge({ count }: { count: number }) {
  return <span className="ml-auto min-w-[18px] h-[18px] bg-foreground text-primary-foreground text-[10px] font-mono font-semibold rounded-full flex items-center justify-center px-1">{count}</span>;
}

// ─── ACTIVITY FEED WIDGET ─────────────────────────────────────────────────────

function ActivityFeedPanel({ onClose, permanent }: { onClose?: () => void; permanent?: boolean }) {
  return (
    <div className={cx("bg-card border border-border rounded-md overflow-hidden flex flex-col", permanent ? "h-full" : "w-80 h-80 shadow-lg")}>
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <div className="text-xs font-semibold">System Activity</div>
        {!permanent && onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={13}/></button>
        )}
      </div>
      <div className="flex-1 overflow-auto divide-y divide-border">
        {ACTIVITY_EVENTS.map(e => (
          <div key={e.id} className="px-3 py-2.5 hover:bg-secondary cursor-pointer">
            <div className="flex items-start gap-2">
              <div className={cx("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", e.system ? "bg-muted-foreground" : "bg-foreground")}/>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium leading-tight">{e.type}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{e.detail}</div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{e.actor} · {e.ts}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

const NOTIFS = [
  { id:1, text:"Elite Model Mgmt. submitted 4 talent",  sub:"AW25 Womenswear", ts:"2m ago",  unread:true  },
  { id:2, text:"Amara Diallo moved to Selected",         sub:"AW25 Womenswear", ts:"1h ago",  unread:true  },
  { id:3, text:"Invoice submitted",                      sub:"Booking #0841",   ts:"3h ago",  unread:true  },
  { id:4, text:"Contract awaiting signature",            sub:"CF-2025-0842",    ts:"5h ago",  unread:true  },
  { id:5, text:"Resort Lookbook — 6 new submissions",   sub:"Resort Lookbook", ts:"1d ago",  unread:false },
];

function BellButton() {
  const [open, setOpen] = useState(false);
  const unread = NOTIFS.filter(n => n.unread).length;
  return (
    <div className="relative">
      <button onClick={() => setOpen(p=>!p)} className="relative p-2 rounded-md hover:bg-secondary text-muted-foreground">
        <Bell size={15}/>
        {unread > 0 && <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-foreground text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center">{unread}</span>}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-80 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold">Notifications</div>
            <button onClick={() => setOpen(false)}><X size={14} className="text-muted-foreground"/></button>
          </div>
          <div className="max-h-72 overflow-auto divide-y divide-border">
            {NOTIFS.map(n => (
              <div key={n.id} className={cx("px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-secondary", n.unread&&"bg-muted/30")}>
                <div className="flex-1 min-w-0">
                  <div className={cx("text-sm", n.unread&&"font-medium")}>{n.text}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{n.sub} · {n.ts}</div>
                </div>
                {n.unread && <span className="w-1.5 h-1.5 bg-foreground rounded-full shrink-0 mt-1.5"/>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CONTRACT MODAL ───────────────────────────────────────────────────────────

function ContractModal({ talent, onSend, onLater }: {
  talent: Talent; onSend: () => void; onLater: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-foreground/40 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-md w-full max-w-md mx-4 overflow-hidden shadow-xl">
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

// ─── TOP BAR ─────────────────────────────────────────────────────────────────

function TopBar({ title, sub, actions }: { title: string; sub?: string; actions?: JSX.Element }) {
  return (
    <div className="h-14 border-b border-border bg-card flex items-center px-6 gap-4 shrink-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{title}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">{actions}<BellButton/></div>
    </div>
  );
}

// ─── LAYER 1: GLOBAL SIDEBAR ─────────────────────────────────────────────────

const GLOBAL_NAV: { id: GlobalView; label: string; Icon: IconFn; badge?: number }[] = [
  { id:"dashboard",        label:"Dashboard",  Icon:LayoutDashboard          },
  { id:"campaigns",        label:"Campaigns",  Icon:Camera,        badge:3   },
  { id:"contracts-global", label:"Contracts",  Icon:FileCheck                },
  { id:"payments-global",  label:"Payments",   Icon:CreditCard               },
  { id:"messaging",        label:"Messaging",  Icon:MessageSquare            },
  { id:"reports",          label:"Reports",    Icon:BarChart2                },
  { id:"network",          label:"Network",    Icon:Building2                },
  { id:"directory",        label:"Directory",  Icon:User                     },
];

function GlobalSidebar({ active, onNav, onOpenCampaign }: {
  active: GlobalView; onNav: (v: GlobalView) => void; onOpenCampaign: () => void;
}) {
  return (
    <aside className="w-52 shrink-0 bg-card border-r border-border flex flex-col h-full">
      <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
        <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center shrink-0">
          <span className="text-primary-foreground text-xs font-bold">A</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">Acne Studios</div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Brand OS</div>
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
      {/* Recent campaigns */}
      <div className="px-3 pb-3 border-t border-border pt-3">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2 px-2">Recent</div>
        {["AW25 Womenswear","SS25 Fragrance","Resort Lookbook"].map(name => (
          <button key={name} onClick={onOpenCampaign}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-left">
            <Camera size={11}/><span className="truncate">{name}</span>
          </button>
        ))}
      </div>
      <div className="px-3 pb-3 border-t border-border pt-3">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer" onClick={() => onNav("settings")}>
          <XBox className="w-6 h-6 rounded-full"/>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">Marcus Webb</div>
            <div className="text-xs text-muted-foreground">Brand Director</div>
          </div>
          <Settings size={13} className="text-muted-foreground"/>
        </div>
      </div>
    </aside>
  );
}

// ─── LAYER 2: CAMPAIGN SIDEBAR ────────────────────────────────────────────────

const CAMPAIGN_NAV: { id: CampaignSection; label: string; Icon: IconFn }[] = [
  { id:"overview",     label:"Overview",      Icon:LayoutDashboard },
  { id:"moodboard",    label:"Moodboard",     Icon:PolaroidIcon    },
  { id:"requirements", label:"Requirements",  Icon:BookOpen        },
  { id:"deliverables", label:"Deliverables",  Icon:Calendar        },
  { id:"contracts",    label:"Contracts",     Icon:FileCheck       },
  { id:"bookings",     label:"Bookings",      Icon:Briefcase       },
  { id:"payments",     label:"Payments",      Icon:CreditCard      },
  { id:"activity",      label:"Activity",       Icon:Activity        },
  { id:"collaboration", label:"Collaboration",  Icon:MessageSquare   },
  { id:"directory",     label:"Directory",      Icon:User            },
];

function CampaignSidebar({ section, onSection, onBack, onNewCampaign, counts }: {
  section: CampaignSection; onSection: (s: CampaignSection) => void;
  onBack: () => void; onNewCampaign: () => void; counts: Record<string,number>;
}) {
  return (
    <aside className="w-52 shrink-0 bg-card border-r border-border flex flex-col h-full">
      <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
        <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center shrink-0">
          <span className="text-primary-foreground text-xs font-bold">A</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">Acne Studios</div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Brand OS</div>
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

// ─── MOODBOARD (KANBAN PIPELINE) ──────────────────────────────────────────────

const DECLINE_REASONS = ["Rate too high","Doesn't meet brief","Look not right","Dates conflict","Client preference","Agency preference","Other"];

function Moodboard({ talent, setTalent, onContractPrompt }: {
  talent: Talent[];
  setTalent: (fn: (prev: Talent[]) => Talent[]) => void;
  onContractPrompt: (t: Talent) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [dragging, setDragging] = useState<number|null>(null);
  const [dragOver, setDragOver] = useState<TalentStage|null>(null);
  const [toast, setToast] = useState<{ msg: string; undo: () => void }|null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const [drawer, setDrawer] = useState<Talent|null>(null);
  const [declineModal, setDeclineModal] = useState<Talent|null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const byStage = (s: TalentStage) => talent.filter(t => t.stage === s);
  const totalNeeded = 4;
  const booked = byStage("booked").length;
  const daysRemaining = 8;
  const unsentContracts = 1;

  function moveTo(id: number, stage: TalentStage, group = "") {
    setTalent(prev => prev.map(t => t.id === id ? { ...t, stage, group } : t));
  }

  function showToast(msg: string, undo: () => void) {
    setToast({ msg, undo: () => { undo(); setToast(null); } });
    setTimeout(() => setToast(null), 7000);
  }

  function moveWithUndo(id: number, newStage: TalentStage, label: string) {
    if (newStage === "rejected") {
      const t = talent.find(x => x.id === id);
      if (t) setDeclineModal(t);
      return;
    }
    const prev = talent.find(t => t.id === id);
    if (!prev) return;
    const prevStage = prev.stage;
    const prevGroup = prev.group;
    moveTo(id, newStage);
    if (newStage === "selected") onContractPrompt({ ...prev, stage: newStage });
    showToast(`${prev.name} moved to ${label}`, () => moveTo(id, prevStage, prevGroup));
  }

  function bulkMove(ids: number[], newStage: TalentStage, label: string) {
    const prevMap = ids.map(id => {
      const t = talent.find(x => x.id === id);
      const prevStage: TalentStage = t?.stage ?? "submitted";
      return { id, stage: prevStage, group: t?.group ?? "" };
    });
    ids.forEach(id => moveTo(id, newStage));
    setSelected([]);
    showToast(`${ids.length} models moved to ${label}`, () => {
      prevMap.forEach(({ id, stage, group }) => moveTo(id, stage, group));
    });
  }

  function toggleSelect(id: number) {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  const STAGE_ACTIONS: Partial<Record<TalentStage, { stage: TalentStage; label: string }[]>> = {
    submitted:   [{ stage:"shortlisted", label:"Shortlist" }, { stage:"selected", label:"Select" }, { stage:"rejected", label:"Decline" }],
    shortlisted: [{ stage:"selected", label:"Select" }, { stage:"submitted", label:"Return" }],
    selected:    [{ stage:"booked", label:"Book" }, { stage:"shortlisted", label:"Return" }],
    booked:      [],
  };

  return (
    <div className="flex-1 flex flex-col h-full relative">
      {/* Toolbar with pipeline stats */}
      <div className="bg-card border-b border-border px-5 py-2 shrink-0 flex items-center gap-3 flex-wrap">
        <div className="flex items-center border border-border rounded-md bg-input-background px-3 gap-2 h-8">
          <Search size={13} className="text-muted-foreground"/>
          <input placeholder="Search…" className="text-xs bg-transparent focus:outline-none w-24 placeholder:text-muted-foreground"/>
        </div>
        {/* Contextual stats */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground border-l border-border pl-3">
          <span><span className="font-semibold text-foreground">{talent.filter(t=>t.stage!=="rejected").length}</span> in pipeline</span>
          <span>·</span>
          <span><span className="font-semibold text-foreground">{booked}/{totalNeeded}</span> booked</span>
          <span>·</span>
          <span className={cx("font-semibold", daysRemaining<=3?"text-foreground":"text-muted-foreground")}>{daysRemaining} days left</span>
          {unsentContracts > 0 && (<><span>·</span><span className="font-semibold text-foreground">{unsentContracts} contract{unsentContracts>1?"s":""} outstanding</span></>)}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowRejected(p=>!p)}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5 hover:bg-secondary transition-colors flex items-center gap-1">
            {showRejected ? <ChevronUp size={10}/> : <ChevronDown size={10}/>} Declined ({byStage("rejected").length})
          </button>
        </div>
      </div>

      {/* Kanban + Drawer */}
      <div className="flex-1 overflow-hidden flex min-h-0">
        <div className="flex-1 overflow-auto">
          <div className="flex gap-0 h-full min-w-max">
            {PIPELINE_STAGES.map(stage => {
              const cards = byStage(stage.id);
              const isOver = dragOver === stage.id;
              const actions = STAGE_ACTIONS[stage.id] ?? [];
              return (
                <div key={stage.id}
                  className={cx("w-60 flex-shrink-0 flex flex-col border-r border-border last:border-0 transition-colors", isOver?"bg-secondary/60":"bg-background")}
                  onDragOver={e=>{e.preventDefault();setDragOver(stage.id);}}
                  onDragLeave={()=>setDragOver(null)}
                  onDrop={()=>{if(dragging!==null){moveWithUndo(dragging,stage.id,stage.label);setDragging(null);setDragOver(null);}}}
                >
                  <div className={cx("px-4 py-3 border-b border-border flex items-center justify-between shrink-0", stage.id==="booked"?"bg-foreground":"bg-card")}>
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
                        <div key={t.id}
                          draggable
                          onDragStart={()=>setDragging(t.id)}
                          onDragEnd={()=>{setDragging(null);setDragOver(null);}}
                          onClick={()=>{toggleSelect(t.id);setDrawer(t);}}
                          className={cx("bg-card rounded-md border overflow-hidden cursor-grab active:cursor-grabbing select-none transition-all group",
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
                          {/* Card info: name, agency, rate, height, location, measurements */}
                          <div className="p-2.5 space-y-0.5">
                            <div className="text-xs font-semibold leading-tight truncate">{t.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{t.agency}</div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                              <span>{t.height}</span><span>·</span><span className="truncate">{t.location.split(",")[0]}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                              <span>B{t.bust}</span><span>W{t.waist}</span><span>{t.dress}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="text-[10px] font-mono font-medium">{t.rate}</div>
                              <div className="flex items-center gap-0.5">
                                {[0,1,2,3,4].map(i=><Star key={i} size={7} className={i<t.score?"fill-foreground text-foreground":"text-muted-foreground"}/>)}
                              </div>
                            </div>
                          </div>
                          {actions.length>0&&(
                            <div className="border-t border-border flex divide-x divide-border opacity-0 group-hover:opacity-100 transition-opacity" onClick={e=>e.stopPropagation()}>
                              {actions.map(a=>(
                                <button key={a.label} onClick={()=>moveWithUndo(t.id,a.stage,a.label)}
                                  className={cx("flex-1 py-1.5 text-[10px] font-medium transition-colors",
                                    a.label==="Decline"?"text-muted-foreground hover:bg-muted"
                                      :a.label==="Book"||a.label==="Select"?"bg-foreground text-primary-foreground hover:bg-[#2a2a2a]"
                                      :"text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  )}>{a.label}</button>
                              ))}
                            </div>
                          )}
                          {stage.id==="booked"&&(
                            <div className="border-t border-foreground/20 flex divide-x divide-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e=>e.stopPropagation()}>
                              <button className="flex-1 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-secondary">Contract</button>
                              <button className="flex-1 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-secondary">Message</button>
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

        {/* Talent Detail Drawer — slides in from right */}
        {drawer && (
          <div className="w-72 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <div className="text-sm font-semibold truncate">{drawer.name}</div>
              <button onClick={()=>{setDrawer(null);setSelected(p=>p.filter(x=>x!==drawer.id));}} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Portfolio */}
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Portfolio</div>
                <XBox className="w-full h-36 rounded-md"/>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {[0,1,2].map(i=><XBox key={i} className="aspect-square rounded-sm"/>)}
                </div>
              </div>
              {/* Measurements */}
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
              {/* Agency Contact */}
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Agency</div>
                <div className="bg-secondary rounded-md p-3 space-y-1">
                  <div className="text-xs font-semibold">{drawer.agency}</div>
                  <div className="text-[10px] text-muted-foreground">Sophie Chen · sophie@elitemodels.com</div>
                  <div className="text-[10px] text-muted-foreground">+1 (212) 555-0110</div>
                </div>
              </div>
              {/* Social */}
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Social</div>
                <div className="space-y-1">
                  {[["Instagram","@"+drawer.name.split(" ")[0].toLowerCase()+"official","180K followers"],["TikTok","@"+drawer.name.split(" ")[0].toLowerCase(),"42K followers"]].map(([p,h,f])=>(
                    <div key={p} className="flex items-center justify-between text-xs bg-secondary rounded-sm px-2 py-1.5">
                      <span className="text-muted-foreground font-mono">{p}</span>
                      <div className="text-right"><div className="font-medium">{h}</div><div className="text-[9px] text-muted-foreground">{f}</div></div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Experience & location */}
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Details</div>
                {[["Location",drawer.location],["Experience",drawer.exp],["Day Rate",drawer.rate]].map(([k,v])=>(
                  <div key={k} className="flex justify-between py-1.5 border-b border-border last:border-0 text-xs">
                    <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
              {/* Notes */}
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Notes</div>
                <textarea defaultValue={drawer.note||""} placeholder="Add internal notes…" rows={3}
                  className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-foreground resize-none"/>
              </div>
            </div>
            {/* Drawer actions */}
            <div className="border-t border-border p-3 space-y-2 shrink-0">
              <button onClick={()=>{moveWithUndo(drawer.id,"selected","Selected");setDrawer(null);}}
                className="w-full py-2 text-xs font-medium bg-foreground text-primary-foreground rounded-md hover:bg-[#2a2a2a] transition-colors">
                Select Talent
              </button>
              <div className="flex gap-2">
                <button onClick={()=>{moveWithUndo(drawer.id,"shortlisted","Shortlisted");setDrawer(null);}}
                  className="flex-1 py-1.5 text-xs text-muted-foreground border border-border rounded-md hover:bg-secondary transition-colors">Shortlist</button>
                <button onClick={()=>{setDeclineModal(drawer);setDrawer(null);}}
                  className="flex-1 py-1.5 text-xs text-muted-foreground border border-border rounded-md hover:bg-muted transition-colors">Decline</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Declined strip */}
      {showRejected && byStage("rejected").length > 0 && (
        <div className="border-t border-border bg-card shrink-0 max-h-36 overflow-auto">
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Declined ({byStage("rejected").length})</span>
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

      {/* Multi-select bar */}
      {selected.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-primary-foreground rounded-lg shadow-lg px-4 py-3 flex items-center gap-4 z-30">
          <span className="text-sm font-semibold whitespace-nowrap">{selected.length} selected</span>
          <div className="flex items-center gap-2">
            {["Shortlist","Select","Book"].map(label=>{
              const m: Record<string,TalentStage>={Shortlist:"shortlisted",Select:"selected",Book:"booked"};
              return <button key={label} onClick={()=>bulkMove(selected,m[label],label)} className="text-xs font-medium bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md">{label}</button>;
            })}
            <button onClick={()=>bulkMove(selected,"rejected","Declined")} className="text-xs text-white/60 hover:text-white hover:bg-white/10 px-2 py-1.5 rounded-md">Remove</button>
            <button onClick={()=>setSelected([])} className="ml-1 text-white/60 hover:text-white"><X size={15}/></button>
          </div>
        </div>
      )}

      {/* Undo toast */}
      {toast && (
        <div className="absolute bottom-6 right-6 bg-card border border-border rounded-md shadow-lg px-4 py-3 flex items-center gap-4 z-30 max-w-sm">
          <span className="text-sm flex-1">{toast.msg}</span>
          <button onClick={toast.undo} className="text-xs font-semibold underline underline-offset-2 hover:no-underline shrink-0">Undo</button>
          <button onClick={()=>setToast(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X size={13}/></button>
        </div>
      )}

      {/* Decline reason modal */}
      {declineModal && (
        <div className="fixed inset-0 bg-foreground/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-md w-80 overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="text-sm font-semibold">Decline — {declineModal.name}</div>
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
                const prevStage=t.stage;const prevGroup=t.group;
                moveTo(t.id,"rejected");
                setDeclineModal(null);setDeclineReason("");
                showToast(`${t.name} declined`,()=>moveTo(t.id,prevStage,prevGroup));
              }}>Confirm Decline</Btn>
              <Btn variant="outline" onClick={()=>{setDeclineModal(null);setDeclineReason("");}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CAMPAIGN WORKSPACE ───────────────────────────────────────────────────────

function CampaignWorkspace({ section, onSection, onBack, onNewCampaign }: {
  section: CampaignSection; onSection: (s: CampaignSection) => void;
  onBack: () => void; onNewCampaign: () => void;
}) {
  const [talent, setTalent] = useState<Talent[]>(SAMPLE_TALENT);
  const [contractModal, setContractModal] = useState<Talent|null>(null);
  const [payTab, setPayTab] = useState<PayTab>("pending");

  const counts: Record<string,number> = {
    submitted:  talent.filter(t=>t.stage==="submitted").length,
    shortlisted:talent.filter(t=>t.stage==="shortlisted").length,
    selected:   talent.filter(t=>t.stage==="selected").length,
    booked:     talent.filter(t=>t.stage==="booked").length,
    rejected:   talent.filter(t=>t.stage==="rejected").length,
  };

  const allPay: { campaign:string; amount:string; due:string; status:PayTab }[] = [
    { campaign:"AW25 Womenswear", amount:"$2,850", due:"06/14/2025", status:"pending"  },
    { campaign:"AW25 Womenswear", amount:"$2,300", due:"06/18/2025", status:"awaiting" },
    { campaign:"AW25 Womenswear", amount:"$1,100", due:"05/30/2025", status:"paid"     },
  ];

  const sectionLabel = CAMPAIGN_NAV.find(n=>n.id===section)?.label ?? "";

  return (
    <>
      <CampaignSidebar section={section} onSection={onSection} onBack={onBack} onNewCampaign={onNewCampaign} counts={counts}/>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TopBar title={sectionLabel} sub="AW25 Womenswear Campaign"/>
        <div className="flex-1 min-h-0 overflow-hidden">

          {/* OVERVIEW */}
          {section==="overview" && (
            <div className="h-full overflow-auto p-6">
              <div className="max-w-3xl space-y-5">
                <div className="grid grid-cols-4 gap-3">
                  {[["Submitted",counts.submitted,""],["Shortlisted",counts.shortlisted,""],["Selected",counts.selected,""],["Booked",counts.booked,""]].map(([l,v])=>(
                    <div key={String(l)} className={cx("border rounded-md p-3 text-center cursor-pointer hover:border-foreground/40", String(l)==="Booked"&&Number(v)>0?"bg-foreground border-foreground":"bg-card border-border")} onClick={()=>onSection("moodboard")}>
                      <div className={cx("text-xl font-semibold tabular-nums", String(l)==="Booked"&&Number(v)>0?"text-primary-foreground":"")}>{String(v)}</div>
                      <div className={cx("text-[10px] font-mono mt-0.5", String(l)==="Booked"&&Number(v)>0?"text-primary-foreground/70":"text-muted-foreground")}>{String(l)}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-md p-4">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Campaign Details</div>
                    {[["Type","Editorial"],["Budget","$800–$1,200/day"],["Dates","07/14–07/16/2025"],["Location","Studio 9, New York"],["Talent needed","3"],["Status","Active"]].map(([k,v])=>(
                      <div key={k} className="flex justify-between py-1.5 border-b border-border last:border-0 text-xs">
                        <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-card border border-border rounded-md p-4">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Campaign Budget</div>
                    {[["Total budget","$18,000"],["Committed","$5,150"],["Remaining","$12,850"]].map(([k,v])=>(
                      <div key={k} className="flex justify-between py-1.5 border-b border-border last:border-0 text-xs">
                        <span className="text-muted-foreground">{k}</span><span className="font-mono font-medium">{v}</span>
                      </div>
                    ))}
                    <button className="w-full text-xs text-muted-foreground hover:text-foreground mt-3 text-left" onClick={()=>onSection("payments")}>View invoices →</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MOODBOARD */}
          {section==="moodboard" && (
            <Moodboard talent={talent} setTalent={setTalent} onContractPrompt={t=>setContractModal(t)}/>
          )}

          {/* REQUIREMENTS — editable */}
          {section==="requirements" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold">Requirements</h2>
                  <Badge label="Editable" variant="info"/>
                </div>
                <div className="bg-card border border-border rounded-md p-5 space-y-4">
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
                <div className="bg-card border border-border rounded-md p-5">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Campaign Brief</div>
                  <Textarea placeholder="Campaign brief…" defaultValue="AW25 editorial campaign focusing on architectural minimalism. Models should embody a strong, directional aesthetic. Runs across print and digital globally." rows={5}/>
                </div>
                <div className="bg-card border border-border rounded-md p-5">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Usage Rights</div>
                  <div className="grid grid-cols-2 gap-4">
                    <FSelect label="Territory" options={["United States","North America","Worldwide"]}/>
                    <FSelect label="Duration" options={["1 year","2 years","Unlimited"]}/>
                    <FSelect label="Exclusivity" options={["Non-exclusive","Category exclusivity","Full"]}/>
                    <TextInput label="Media types" placeholder="Print, Digital, OOH" defaultValue="Print, Digital, OOH"/>
                  </div>
                </div>
                <div className="flex justify-end"><Btn variant="primary" icon={<Check size={13}/>}>Save Requirements</Btn></div>
              </div>
            </div>
          )}

          {/* DELIVERABLES — editable */}
          {section==="deliverables" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold">Deliverables</h2>
                  <Badge label="Editable" variant="info"/>
                </div>
                <div className="bg-card border border-border rounded-md p-5 space-y-4">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Shoot Schedule</div>
                  {[["Mon 07/14","08:00–18:00","James Whitfield + Amara Diallo","Hero shots — Studio 9, NYC"],
                    ["Tue 07/15","09:00–17:00","Amara Diallo","Close-up editorial"],
                    ["Fri 07/22","10:00–18:00","Sofia Brandt","Miami location shoot"]].map((d,i)=>(
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

          {/* CONTRACTS */}
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
                  <div key={c[0]} className="bg-card border border-border rounded-md p-4 flex items-center gap-4">
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

          {/* BOOKINGS */}
          {section==="bookings" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl space-y-3">
                <p className="text-xs text-muted-foreground mb-4">Bookings originate from this campaign's pipeline. Select and confirm talent to create bookings.</p>
                {talent.filter(t=>t.stage==="booked").map(t=>(
                  <div key={t.id} className="bg-card border border-foreground/20 rounded-md p-4 flex items-center gap-4">
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

          {/* PAYMENTS — campaign level, per campaign only */}
          {section==="payments" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Campaign Budget" value="$18,000"/>
                  <Stat label="Invoiced" value="$5,150" sub="2 invoices"/>
                  <Stat label="Remaining" value="$12,850"/>
                </div>
                <div className="flex items-center gap-1 border-b border-border">
                  {(["pending","awaiting","paid"]).map(t=>(
                    <button key={t} onClick={()=>setPayTab(t)}
                      className={cx("px-4 py-2.5 text-sm capitalize border-b-2 -mb-px transition-colors",
                        payTab===t?"border-foreground text-foreground font-medium":"border-transparent text-muted-foreground hover:text-foreground"
                      )}>{t==="awaiting"?"Awaiting Invoice":t==="paid"?"Paid":t.charAt(0).toUpperCase()+t.slice(1)}</button>
                  ))}
                </div>
                <div className="space-y-2">
                  {allPay.filter(p=>p.status===payTab).map((p,i)=>(
                    <div key={i} className="bg-card border border-border rounded-md p-4 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{p.campaign}</div>
                        <div className="text-xs text-muted-foreground">Due {p.due}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm">{p.amount}</span>
                        <Badge label={payTab==="paid"?"Paid":payTab==="awaiting"?"Awaiting Invoice":"Pending"} variant={payTab==="paid"?"active":payTab==="awaiting"?"pending":"draft"}/>
                        {payTab!=="paid"&&<Btn variant="primary" size="sm">Initiate Payment</Btn>}
                      </div>
                    </div>
                  ))}
                  {allPay.filter(p=>p.status===payTab).length===0&&(
                    <div className="flex items-center justify-center h-32 border border-dashed border-border rounded-md">
                      <div className="text-sm text-muted-foreground">No {payTab} payments</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ACTIVITY */}
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
          {/* COLLABORATION */}
          {section==="collaboration" && <CollaborationTab/>}

          {/* CAMPAIGN USERS */}
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
                    <div key={u.id} className="bg-card border border-border rounded-md px-4 py-3 flex items-center gap-3">
                      <XBox className="w-7 h-7 rounded-full shrink-0"/>
                      <div className="flex-1 min-w-0"><div className="text-sm font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.title}</div></div>
                      <Badge label={u.access} variant={ACCESS_BADGE[u.access]}/>
                      <button className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 cursor-pointer hover:border-foreground">Remove</button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Agency</div>
                  {ORG_USERS.filter(u=>u.org!=="Acne Studios").map(u=>(
                    <div key={u.id} className="bg-card border border-border rounded-md px-4 py-3 flex items-center gap-3">
                      <XBox className="w-7 h-7 rounded-full shrink-0"/>
                      <div className="flex-1 min-w-0"><div className="text-sm font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.title} · {u.org}</div></div>
                      <Badge label={u.access} variant={ACCESS_BADGE[u.access]}/>
                      <button className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 cursor-pointer hover:border-foreground">Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {contractModal && (
        <ContractModal talent={contractModal} onSend={()=>setContractModal(null)} onLater={()=>setContractModal(null)}/>
      )}
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function Dashboard({ openCampaign }: { openCampaign: () => void }) {
  const campaigns = [
    { name:"AW25 Womenswear Campaign", type:"Editorial",  submitted:14, shortlisted:4, selected:2, booked:2, dueLabel:"Due tomorrow",    dueUrgency:"high",   budget:18000, committed:5150, remaining:12850, talentNeeded:4 },
    { name:"SS25 Fragrance Launch",    type:"Commercial", submitted:9,  shortlisted:3, selected:1, booked:0, dueLabel:"5 days remaining", dueUrgency:"medium", budget:10000, committed:0,    remaining:10000, talentNeeded:2 },
    { name:"Resort Lookbook 2025",     type:"E-commerce", submitted:21, shortlisted:6, selected:1, booked:0, dueLabel:"14 days",          dueUrgency:"low",    budget:7000,  committed:0,    remaining:7000,  talentNeeded:3 },
  ];

  const attention = [
    { icon:"⚡", msg:"AW25 Womenswear — due tomorrow. 14 submissions need review.", action:"Review now", urgent:true  },
    { icon:"✉",  msg:"1 unsent contract for Zara Okafor pending signature.",        action:"Send",       urgent:true  },
    { icon:"👤", msg:"SS25 Fragrance — 9 submissions awaiting first review.",       action:"Review",     urgent:false },
  ];

  const nextEvents = [
    { label:"Tomorrow",    talent:"James Whitfield",  agency:"Elite Model Mgmt.", campaign:"AW25 Womenswear", detail:"Shoot 8am–6pm · Studio 9, NYC · Contract signed" },
    { label:"Tomorrow",    talent:"Amara Diallo",      agency:"Elite Model Mgmt.", campaign:"AW25 Womenswear", detail:"Shoot 8am–6pm · Studio 9, NYC · Contract signed" },
    { label:"3 days",      talent:"Sofia Brandt",      agency:"DNA Models",        campaign:"Resort Lookbook",  detail:"Shoot 10am · Miami Beach · Contract outstanding" },
    { label:"Submissions", talent:"14 need review",    agency:"AW25 Womenswear",   campaign:"",                 detail:"Elite Model Mgmt. submitted 4 · IMG submitted 3 · 7 others" },
    { label:"Contracts",   talent:"Zara Okafor",       agency:"Elite Model Mgmt.", campaign:"AW25 Womenswear",  detail:"Draft generated · Not yet sent to agency" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Dashboard" sub="Acne Studios · Brand OS"/>
      <div className="flex-1 overflow-auto p-6 space-y-5">

        {/* Needs Attention */}
        <div className="bg-card border border-border rounded-md overflow-hidden">
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

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* LEFT: Active campaigns */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold mb-3">Active Campaigns</h2>
            <div className="space-y-3">
              {campaigns.map(c=>{
                const conv = c.submitted > 0 ? Math.round((c.booked/c.submitted)*100) : 0;
                return (
                  <div key={c.name} className="bg-card border border-border rounded-md p-4 cursor-pointer hover:border-foreground/30 transition-colors" onClick={openCampaign}>
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
                    {/* Pipeline */}
                    <div className="flex items-stretch gap-0 border border-border rounded-md overflow-hidden text-center text-xs mb-2">
                      {[
                        { l:"Submitted", v:c.submitted, note:"needs review" },
                        { l:"Shortlisted", v:c.shortlisted, note:"" },
                        { l:"Selected", v:c.selected, note:"" },
                        { l:"Booked", v:c.booked, note:`of ${c.talentNeeded}` },
                      ].map((s,i,arr)=>(
                        <div key={s.l} className={cx("flex-1 py-2 border-r border-border last:border-0", i===arr.length-1&&s.v>0?"bg-foreground":"")}>
                          <div className={cx("font-semibold tabular-nums", i===arr.length-1&&s.v>0?"text-primary-foreground":"")}>{s.v}</div>
                          <div className={cx("text-[9px] font-mono leading-tight", i===arr.length-1&&s.v>0?"text-primary-foreground/70":"text-muted-foreground")}>
                            {s.l}{s.note&&<span className="block opacity-70">{s.note}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Budget */}
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

          {/* RIGHT: Stats + Next Events */}
          <div className="space-y-4">
            {/* Actionable stats */}
            <div className="space-y-2">
              {[
                { label:"Unsent Contracts",      value:"1",  action:"Send now", urgent:true  },
                { label:"Submissions to Review", value:"44", action:"Review",   urgent:false },
                { label:"Talent Selected",       value:"4",  action:"Book now", urgent:false },
                { label:"Active Campaigns",      value:"3",  action:"View all", urgent:false },
              ].map(s=>(
                <div key={s.label} className={cx("bg-card border rounded-md px-4 py-3 flex items-center justify-between gap-3",s.urgent?"border-foreground":"border-border")}>
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

            {/* Next Events */}
            <div>
              <h2 className="text-sm font-semibold mb-2">Next Events</h2>
              <div className="space-y-2">
                {nextEvents.map((e,i)=>(
                  <div key={i} className="bg-card border border-border rounded-md px-3 py-2.5 cursor-pointer hover:border-foreground/30" onClick={openCampaign}>
                    <div className="flex items-start gap-2">
                      <span className={cx("text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm shrink-0 mt-0.5",
                        e.label==="Tomorrow"?"bg-foreground text-primary-foreground":
                        e.label==="Contracts"?"bg-secondary border border-foreground/30 text-foreground":
                        "bg-secondary text-muted-foreground"
                      )}>{e.label}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{e.talent}</div>
                        {e.campaign&&<div className="text-[10px] text-muted-foreground">{e.agency} · {e.campaign}</div>}
                        <div className="text-[10px] text-muted-foreground leading-snug mt-0.5">{e.detail}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
    { name:"AW25 Womenswear Campaign", type:"Editorial",  status:"active",   due:"06/20", submitted:14, shortlisted:4, selected:2, booked:2 },
    { name:"SS25 Fragrance Launch",    type:"Commercial", status:"active",   due:"06/24", submitted:9,  shortlisted:3, selected:1, booked:0 },
    { name:"Resort Lookbook 2025",     type:"E-commerce", status:"active",   due:"07/03", submitted:21, shortlisted:6, selected:1, booked:0 },
    { name:"FW24 Campaign",            type:"Editorial",  status:"archived", due:"01/15", submitted:41, shortlisted:8, selected:3, booked:3 },
  ];
  const filtered = tab==="active"?all.filter(c=>c.status==="active"):tab==="drafts"?[]:all.filter(c=>c.status==="archived");
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Campaigns" sub="All campaigns · Acne Studios"/>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Stat label="Total" value="4" sub="3 active"/>
          <Stat label="Submissions" value="44" sub="Across active"/>
          <Stat label="Selected" value="4" sub="Pending booking"/>
          <Stat label="Booked" value="5" sub="This quarter"/>
        </div>
        <div className="flex items-center gap-1 mb-4 border-b border-border">
          {["active","drafts","archived"].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={cx("px-4 py-2.5 text-sm capitalize border-b-2 -mb-px transition-colors",
                tab===t?"border-foreground text-foreground font-medium":"border-transparent text-muted-foreground hover:text-foreground"
              )}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
          ))}
        </div>
        {filtered.length===0 ? (
          <div className="bg-card border border-dashed border-border rounded-md p-10 text-center">
            <div className="text-sm text-muted-foreground mb-3">No {tab} campaigns</div>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c=>(
              <div key={c.name} className="bg-card border border-border rounded-md p-4 cursor-pointer hover:border-foreground/30 transition-colors" onClick={openCampaign}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold">{c.name}</span>
                      <Badge label={c.status==="archived"?"Archived":"Active"} variant={c.status==="archived"?"draft":"active"}/>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{c.type} · Due {c.due}</div>
                  </div>
                  <Btn variant="secondary" size="sm">Open workspace →</Btn>
                </div>
                <div className="flex items-stretch gap-0 border border-border rounded-md overflow-hidden text-center">
                  {([["Submitted",c.submitted],["Shortlisted",c.shortlisted],["Selected",c.selected],["Booked",c.booked]]).map(([l,v],i,arr)=>(
                    <div key={l} className={cx("flex-1 py-2 border-r border-border last:border-0", i===arr.length-1&&v>0?"bg-foreground":"")}>
                      <div className={cx("text-base font-semibold tabular-nums", i===arr.length-1&&v>0?"text-primary-foreground":"")}>{v}</div>
                      <div className={cx("text-[10px] font-mono", i===arr.length-1&&v>0?"text-primary-foreground/70":"text-muted-foreground")}>{l}</div>
                    </div>
                  ))}
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

function CreateCampaign({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [genders, setGenders] = useState(["Female"]);
  const [cats, setCats] = useState(["Editorial"]);
  const toggle = (arr: string[], val: string, set: (a:string[])=>void) =>
    set(arr.includes(val)?arr.filter(v=>v!==val):[...arr,val]);
  const STEPS = [{n:1,label:"Basics"},{n:2,label:"Talent"},{n:3,label:"Brief"},{n:4,label:"Publish"}];
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="New Campaign" sub={`Step ${step} of 4`}
        actions={<Btn variant="ghost" size="sm" onClick={onBack}><X size={13}/> Discard</Btn>}
      />
      <div className="bg-card border-b border-border px-6 py-4 shrink-0">
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
              <FieldLabel>Distribute to agencies</FieldLabel>
              <div className="flex flex-wrap gap-2 mt-1">{["Elite Model Management","IMG Models","Wilhelmina","DNA Models"].map(a=><Chip key={a} active>{a}</Chip>)}</div>
            </div>
            <div className="bg-card border border-border rounded-md p-4 flex items-start gap-2.5">
              <AlertCircle size={13} className="text-muted-foreground mt-0.5 shrink-0"/>
              <div className="text-xs text-muted-foreground leading-relaxed">No payment is due until talent is booked and contracts are executed.</div>
            </div>
          </>)}
          <div className="flex items-center justify-between pt-6 border-t border-border">
            <div className="flex gap-2">
              {step>1&&<Btn variant="outline" onClick={()=>setStep(step-1)}><ChevronLeft size={13}/> Back</Btn>}
              <Btn variant="ghost" size="sm">Save draft</Btn>
            </div>
            {step<4?<Btn variant="primary" onClick={()=>setStep(step+1)}>Continue <ChevronRight size={13}/></Btn>
              :<Btn variant="primary" icon={<Check size={13}/>} onClick={onBack}>Publish Campaign</Btn>}
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
      <TopBar title="Contracts" sub="All contracts · Acne Studios"
        actions={<Btn variant="primary" size="sm" icon={<Plus size={13}/>}>Generate Contract</Btn>}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Active contracts" value="3" sub="2 awaiting signature"/>
          <Stat label="Unsent drafts"    value="1" sub="Action required" accent/>
          <Stat label="Executed"         value="8" sub="All time"/>
        </div>
        <div className="bg-card border border-border rounded-md overflow-hidden">
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

type PaymentState = "idle" | "processing" | "complete";

function GlobalPayments() {
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
  const goldBtn = "bg-[#C4A84A] hover:bg-[#B8962E] text-white font-semibold tracking-widest uppercase transition-all shadow-md hover:shadow-lg";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Payments" sub="Acne Studios · Payment methods and invoices"/>
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
            <h2 className="text-sm font-semibold mb-3">Payment Cards</h2>
            {hasCard ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden h-44 bg-gradient-to-br from-[#C9961A] via-[#E2B84A] to-[#9A7015] p-5 flex flex-col justify-between select-none cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between">
                    <div><div className="text-[10px] font-mono text-yellow-100/80 uppercase tracking-widest">Primary</div><div className="text-base font-bold text-white tracking-widest mt-1">AMEX</div></div>
                    <div className="text-right"><div className="text-[10px] text-yellow-100/70">American Express</div><div className="text-xs text-yellow-100/90 mt-1">Gold</div></div>
                  </div>
                  <div>
                    <div className="text-white font-mono text-lg tracking-widest mb-2">•••• •••• •••• 4242</div>
                    <div className="flex items-end justify-between">
                      <div><div className="text-[9px] text-yellow-100/60 uppercase">Card Holder</div><div className="text-xs text-white font-medium">MARCUS WEBB</div></div>
                      <div className="text-right"><div className="text-[9px] text-yellow-100/60 uppercase">Expires</div><div className="text-xs text-white font-mono">09/27</div></div>
                    </div>
                  </div>
                </div>
                <div className="relative rounded-xl overflow-hidden h-28 bg-gradient-to-br from-[#2a2a2a] to-[#444] p-4 flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow opacity-70">
                  <div className="text-xs text-white/60 font-mono">VISA</div>
                  <div><div className="text-white font-mono text-sm tracking-widest mb-1">•••• •••• •••• 8891</div><div className="text-xs text-white/60">MARCUS WEBB · 03/26</div></div>
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
            <h2 className="text-sm font-semibold mb-3">Bank Accounts</h2>
            <div className="space-y-2">
              <div className="bg-card border border-foreground/20 rounded-md p-3">
                <div className="flex items-start justify-between mb-1.5">
                  <div><div className="text-xs font-semibold">Acne Studios Operating</div><div className="text-[10px] text-muted-foreground font-mono">Checking · Primary</div></div>
                  <Badge label="Default" variant="active"/>
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Account</span><span className="font-mono">••••4422</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Routing</span><span className="font-mono">021000021</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Bank</span><span className="font-mono">JPMorgan Chase</span></div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-md p-3">
                <div className="text-xs font-semibold mb-0.5">Creative Fund</div>
                <div className="text-[10px] text-muted-foreground font-mono mb-1.5">Savings</div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Account</span><span className="font-mono">••••8834</span></div>
              </div>
              <button className="text-xs text-muted-foreground hover:text-foreground w-full text-center border border-dashed border-border rounded-md px-4 py-2 hover:border-foreground transition-colors">See all accounts</button>
              <button onClick={()=>setShowAddBank(true)} className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-4 py-2 flex items-center justify-center gap-1 hover:border-foreground w-full transition-colors"><Plus size={12}/> Add account</button>
            </div>
          </div>
        </div>

        {/* RIGHT 2/3 — Invoices flex-1, button pinned bottom */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header row: legend left, see all right */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-1">
              <h2 className="text-sm font-semibold mr-3">Outstanding Invoices</h2>
              <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C0392B] inline-block"/>Overdue</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#D4A017] inline-block"/>Due soon</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#27AE60] inline-block"/>On track</span>
              </div>
            </div>
            <button className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer" onClick={() => setPaymentsTab("invoices")}>
              See all invoices →
            </button>
          </div>
          {/* 3×3 grid — unpaid invoices only, taller cards */}
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-3 gap-3">
              {invoices.slice(0,9).map((inv,i)=>(
                <div key={i} className={cx("bg-card border rounded-md p-4 cursor-pointer hover:border-foreground/40 transition-all flex flex-col gap-3", inv.urgency==="red"?"border-[#C0392B]/30 bg-[#C0392B]/5":"border-border")}>
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

          {/* Authorize Payment — gold with white text, inevitably tall */}
          <button
            onClick={()=>setShowPayModal(true)}
            className={`w-full py-10 mt-4 rounded-md ${goldBtn} text-lg`}
          >
            Authorize Payment
          </button>
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
                  <input readOnly value="Marcus Webb" className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"/>
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
                  <div className="text-xs text-muted-foreground">By signing, you authorize this payment on behalf of Acne Studios.</div>
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
              <div className="text-sm font-semibold">Create E-Signature</div>
              <button onClick={()=>setShowSigModal(false)} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-xs text-muted-foreground">Type your full name to create your authorized e-signature.</div>
              <div><FieldLabel>Full Name</FieldLabel><input value={sigInput} onChange={e=>setSigInput(e.target.value)} placeholder="e.g. Marcus Webb" className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground"/></div>
              {sigInput && (<div className="border border-border rounded-md p-4 bg-secondary text-center"><div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-mono">Preview</div><div className="font-serif italic text-2xl">{sigInput}</div></div>)}
              <div className="text-[10px] text-muted-foreground leading-relaxed">By creating this e-signature, you agree it is legally equivalent to your handwritten signature within DVURE.</div>
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
              <div className="text-sm font-semibold">Add Payment Card</div>
              <button onClick={()=>setShowAddCard(false)} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
            </div>
            <div className="p-6 space-y-4">
              <TextInput label="Name on Card" placeholder="e.g. Marcus Webb"/>
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
                <span className="shrink-0 mt-0.5">🔒</span>
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
              <div className="text-sm font-semibold">Add Bank Account</div>
              <button onClick={()=>setShowAddBank(false)} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
            </div>
            <div className="p-6 space-y-4">
              <TextInput label="Account Nickname" placeholder="e.g. Acne Studios Operating"/>
              <FSelect label="Account Type" options={["Checking","Savings"]}/>
              <TextInput label="Account Holder Name" placeholder="e.g. Acne Studios LLC"/>
              <div>
                <FieldLabel>Account Number</FieldLabel>
                <input placeholder="Enter account number" className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:border-foreground"/>
              </div>
              <TextInput label="Routing Number" placeholder="9 digit routing number"/>
              <TextInput label="Bank Name" placeholder="e.g. JPMorgan Chase"/>
              <div className="bg-secondary border border-border rounded-md px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
                <span className="shrink-0 mt-0.5">🔒</span>
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

// ─── INVOICES SCREEN ─────────────────────────────────────────────────────────

const INVOICE_DATA = [
  { id:"INV-0841", campaign:"AW25 Womenswear Campaign", agency:"Elite Model Mgmt.", talent:"James Whitfield", dayRate:950,  days:3, amount:2850,  due:"06/20/2025", urgency:"yellow", agencyPct:20, dvurePct:3, taxPct:8.25 },
  { id:"INV-0842", campaign:"AW25 Womenswear Campaign", agency:"Elite Model Mgmt.", talent:"Amara Diallo",    dayRate:1150, days:2, amount:2300,  due:"06/24/2025", urgency:"green",  agencyPct:20, dvurePct:3, taxPct:8.25 },
  { id:"INV-0791", campaign:"SS25 Fragrance Launch",    agency:"IMG Models",        talent:"Mila Tran",       dayRate:1100, days:1, amount:1100,  due:"07/03/2025", urgency:"green",  agencyPct:20, dvurePct:3, taxPct:8.25 },
  { id:"INV-0768", campaign:"FW24 Campaign",            agency:"DNA Models",        talent:"Sofia Brandt",    dayRate:1200, days:3, amount:3600,  due:"06/10/2025", urgency:"red",    agencyPct:20, dvurePct:3, taxPct:8.25 },
  { id:"INV-0804", campaign:"Resort Lookbook 2025",     agency:"Storm Models",      talent:"Ines Ferreira",   dayRate:1340, days:2, amount:2680,  due:"07/03/2025", urgency:"green",  agencyPct:20, dvurePct:3, taxPct:8.25 },
  { id:"INV-0815", campaign:"Beauty Campaign Q1",       agency:"Next Models",       talent:"Chiara Russo",    dayRate:860,  days:2, amount:1720,  due:"07/10/2025", urgency:"green",  agencyPct:20, dvurePct:3, taxPct:8.25 },
];

function InvoicesPanel() {
  const [selected, setSelected] = useState<typeof INVOICE_DATA[number]|null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<typeof INVOICE_DATA[number]|null>(null);
  const [showPayModalFromInvoice, setShowPayModalFromInvoice] = useState(false);
  const [msgThread, setMsgThread] = useState<typeof INVOICE_DATA[number]|null>(INVOICE_DATA[0]);
  const [msgInput, setMsgInput] = useState("");
  const [messages, setMessages] = useState([
    { from:"Agency", text:"Please review the attached invoice for the AW25 shoot.", ts:"Jun 14, 10:02 AM" },
    { from:"You",    text:"Received. We'll process this within 3 business days.", ts:"Jun 14, 11:15 AM" },
    { from:"Agency", text:"Thank you. Let us know if you need any amendments.", ts:"Jun 14, 11:30 AM" },
  ]);

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

  function sendMsg() {
    if (!msgInput.trim()) return;
    setMessages(p => [...p, { from:"You", text:msgInput, ts:"Now" }]);
    setMsgInput("");
  }

  const urgencyOrder: Record<string,number> = { red:0, yellow:1, green:2 };
  const sorted = [...INVOICE_DATA].sort((a,b)=>(urgencyOrder[a.urgency]??2)-(urgencyOrder[b.urgency]??2));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Invoices" sub="All invoices · Acne Studios"/>
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Gallery — left 2/3 */}
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
                  onClick={() => { setSelected(inv); setMsgThread(inv); }}
                  className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-foreground/40 hover:shadow-md transition-all group"
                >
                  {/* Card face */}
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

      </div>

      {/* Invoice Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-xl shadow-2xl overflow-hidden">
            {/* Header */}
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
            {/* Breakdown */}
            <div className="px-6 py-5">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Fee Breakdown</div>
              {(() => {
                const bd = calcBreakdown(selected);
                return (
                  <div className="space-y-1">
                    {/* Model fee */}
                    <div className="flex items-baseline justify-between py-2.5 border-b border-border">
                      <div>
                        <div className="text-sm">Model Fee — {selected.talent}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{selected.days} day{selected.days>1?"s":""} × ${selected.dayRate.toLocaleString()}/day</div>
                      </div>
                      <div className="font-mono text-sm font-medium">${bd.modelFee.toLocaleString()}</div>
                    </div>
                    {/* Agency fee — its own line, NOT in tooltip */}
                    <div className="flex items-baseline justify-between py-2.5 border-b border-border">
                      <div>
                        <div className="text-sm">Agency Fee — {selected.agency}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{selected.agencyPct}% of model fee</div>
                      </div>
                      <div className="font-mono text-sm font-medium">${bd.agencyFee.toLocaleString()}</div>
                    </div>
                    {/* DVURE fees + Tax collapsed — only DVURE in tooltip */}
                    <div className="flex items-center justify-between py-2.5 border-b border-border">
                      <div className="flex items-center gap-2">
                        <div className="text-sm">Fees &amp; Taxes</div>
                        <div className="relative group/tooltip">
                          <span className="w-4 h-4 rounded-full border border-border bg-secondary text-[9px] font-mono text-muted-foreground flex items-center justify-center cursor-default select-none">i</span>
                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover/tooltip:block z-20 w-56 bg-foreground text-primary-foreground rounded-md shadow-lg p-3 text-[10px] font-mono space-y-1.5">
                            <div className="flex justify-between gap-4"><span>DVURE transaction (3%)</span><span>${bd.dvureFee.toLocaleString()}</span></div>
                            <div className="flex justify-between gap-4"><span>Processing (2.9% + $0.30)</span><span>${bd.processingFee.toLocaleString()}</span></div>
                            <div className="border-t border-primary-foreground/20 pt-1.5 flex justify-between gap-4 font-semibold"><span>Total fees</span><span>${bd.totalFees.toLocaleString()}</span></div>
                          </div>
                        </div>
                      </div>
                      <div className="font-mono text-sm font-medium">${(bd.dvureFee+bd.processingFee+bd.tax).toLocaleString()}</div>
                    </div>
                    {/* Invoice Total — no subtotal row */}
                    <div className="flex items-center justify-between pt-4 mt-1 border-t-2 border-foreground">
                      <div className="text-sm font-semibold">Invoice Total</div>
                      <div className="text-2xl font-semibold font-mono">${bd.total.toLocaleString()}</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono text-right">Due {selected.due}</div>
                  </div>
                );
              })()}
            </div>
            {/* Actions — Authorize Payment auto-fills campaign */}
            <div className="px-6 pb-5 flex gap-2">
              <button
                onClick={()=>{ setSelectedInvoice(selected); setSelected(null); }}
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

// ─── ORG DATA (shared) ────────────────────────────────────────────────────────

const ORG_USERS = [
  { id:1, name:"Marcus Webb",   title:"Brand Director",    email:"marcus@acne.com",  phone:"+1 212 555 0100", access:"administrator", group:"Creative Leadership", org:"Acne Studios"   },
  { id:2, name:"Lena Chu",      title:"Campaign Manager",  email:"lena@acne.com",    phone:"+1 212 555 0101", access:"enhanced",      group:"Campaign Team",       org:"Acne Studios"   },
  { id:3, name:"Jake Torres",   title:"Art Director",      email:"jake@acne.com",    phone:"+1 212 555 0102", access:"enhanced",      group:"Creative Leadership", org:"Acne Studios"   },
  { id:4, name:"Priya Shah",    title:"Finance Lead",      email:"priya@acne.com",   phone:"+1 212 555 0103", access:"enhanced",      group:"Finance",             org:"Acne Studios"   },
  { id:5, name:"Sam Brooks",    title:"Creative Producer", email:"sam@acne.com",     phone:"+1 212 555 0104", access:"basic",         group:"Campaign Team",       org:"Acne Studios"   },
  { id:6, name:"Sofia Reyes",   title:"Legal Counsel",     email:"sofia@acne.com",   phone:"+1 212 555 0105", access:"administrator", group:"Legal",               org:"Acne Studios"   },
  { id:7, name:"Sophie Chen",   title:"Senior Agent",      email:"sophie@elite.com", phone:"+1 212 555 0200", access:"enhanced",      group:"Elite Team",          org:"Elite Model Mgmt." },
  { id:8, name:"James Kirk",    title:"Booking Agent",     email:"james@elite.com",  phone:"+1 212 555 0201", access:"basic",         group:"Elite Team",          org:"Elite Model Mgmt." },
];

const ACCESS_BADGE: Record<string,"active"|"info"|"draft"> = { administrator:"active", enhanced:"info", basic:"draft" };

// ─── COLLABORATION TAB ────────────────────────────────────────────────────────

function CollaborationTab() {
  const campaignUsers = ORG_USERS.slice(0, 6); // brand + agency users on this campaign
  const [msgs, setMsgs] = useState([
    { id:1, from:2, text:"Just finished reviewing the submissions. Zara and Amara are strong leads.", ts:"Jun 19, 9:14 AM"  },
    { id:2, from:1, text:"Agreed. I'd like to schedule a quick call to align on the shortlist before EOD.", ts:"Jun 19, 9:32 AM" },
    { id:3, from:7, text:"Hi team — we can confirm Amara is available the full window. Excited to move forward.", ts:"Jun 19, 10:05 AM" },
    { id:4, from:3, text:"The mood board references look great. I'll have the brief updated with the revised direction by noon.", ts:"Jun 19, 11:20 AM" },
    { id:5, from:1, text:"Perfect. Let's aim to finalize the shortlist by end of today and get contracts out tomorrow.", ts:"Jun 19, 11:45 AM" },
  ]);
  const [input, setInput] = useState("");
  const [showAddUsers, setShowAddUsers] = useState(false);
  const ME = 1; // logged-in user id

  function send() {
    if (!input.trim()) return;
    setMsgs(p=>[...p,{ id:Date.now(), from:ME, text:input, ts:"Now" }]);
    setInput("");
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div>
          <div className="text-xs font-semibold">AW25 Womenswear — Campaign Chat</div>
          <div className="text-[10px] text-muted-foreground">{campaignUsers.length} participants · Acne Studios + Elite Model Mgmt.</div>
        </div>
        <button onClick={()=>setShowAddUsers(true)} className="text-xs border border-border rounded-md px-3 py-1.5 text-muted-foreground hover:border-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
          <Plus size={11}/> Add / Remove Users
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
        {msgs.map(m => {
          const isMe = m.from === ME;
          const user = campaignUsers.find(u=>u.id===m.from);
          return (
            <div key={m.id} className={cx("flex flex-col gap-1", isMe && "items-end")}>
              <div className={cx("rounded-xl px-4 py-2.5 text-sm max-w-md leading-relaxed",
                isMe ? "bg-[#C4A84A] text-white" : "bg-secondary text-foreground"
              )}>
                {m.text}
              </div>
              <div className={cx("flex items-center gap-2 text-[10px] text-muted-foreground", isMe && "flex-row-reverse")}>
                <span className="font-medium">{isMe ? "Me" : user?.name ?? "Unknown"}</span>
                {!isMe && <span>·</span>}
                {!isMe && <span>{user?.org}</span>}
                <span>·</span>
                <span className="font-mono">{m.ts}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose */}
      <div className="px-6 py-4 border-t border-border bg-card shrink-0">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); }}}
            placeholder="Message the campaign group…"
            rows={2}
            className="flex-1 bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none placeholder:text-muted-foreground"
          />
          <button onClick={send} className="p-2.5 bg-[#C4A84A] hover:bg-[#B8962E] text-white rounded-md transition-colors cursor-pointer shrink-0">
            <Send size={15}/>
          </button>
        </div>
      </div>

      {/* Add/Remove users modal */}
      {showAddUsers && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="text-sm font-semibold">Campaign Participants</div>
              <button onClick={()=>setShowAddUsers(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-2 max-h-80 overflow-auto">
              {ORG_USERS.map(u=>{
                const inCampaign = campaignUsers.some(c=>c.id===u.id);
                return (
                  <div key={u.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <XBox className="w-7 h-7 rounded-full shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{u.name} <span className="text-muted-foreground">· {u.org}</span></div>
                      <div className="text-[10px] text-muted-foreground">{u.title}</div>
                    </div>
                    <Badge label={u.access} variant={ACCESS_BADGE[u.access]}/>
                    <span className={cx("text-[10px] font-mono px-2 py-0.5 rounded-sm border cursor-pointer",
                      inCampaign?"bg-foreground text-primary-foreground border-foreground":"border-border text-muted-foreground hover:border-foreground"
                    )}>{inCampaign?"Remove":"Add"}</span>
                  </div>
                );
              })}
            </div>
            <div className="px-5 pb-4">
              <Btn variant="primary" fullWidth onClick={()=>setShowAddUsers(false)}>Save Changes</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MESSAGING SCREEN ─────────────────────────────────────────────────────────

const INBOX_MSGS = [
  { id:1, urgent:true,  date:"Jun 19, 2:14 PM", subject:"Invoice #INV-0841 — Payment Required",         sender:"Sophie Chen",  org:"Elite Model Mgmt.", title:"Senior Agent",    campaign:"AW25 Womenswear", read:false, body:"Please find the invoice for the AW25 Womenswear shoot. Payment is due by 06/20. Let us know if you have any questions." },
  { id:2, urgent:false, date:"Jun 18, 10:30 AM",subject:"Talent availability confirmed — Amara Diallo",  sender:"James Kirk",   org:"Elite Model Mgmt.", title:"Booking Agent",   campaign:"AW25 Womenswear", read:false, body:"Amara has confirmed availability for the full window, 07/14–07/15. Please proceed with the contract." },
  { id:3, urgent:false, date:"Jun 17, 4:05 PM", subject:"Rate negotiation — SS25 Fragrance",            sender:"Diana Park",   org:"IMG Models",        title:"Agent",           campaign:"SS25 Fragrance",  read:true,  body:"Following up on rates. Mila is open to $1,050/day for a 3-day booking. Please advise." },
  { id:4, urgent:false, date:"Jun 16, 9:00 AM", subject:"Contract amendment requested",                  sender:"Tom Reeves",   org:"Storm Models",      title:"Director",        campaign:"Resort Lookbook",  read:true,  body:"We would like to amend clause 4.2 to include social media exclusivity for 30 days only, not 90." },
  { id:5, urgent:false, date:"Jun 14, 3:22 PM", subject:"Campaign brief received — thank you",           sender:"Nina Vasquez", org:"DNA Models",        title:"Agent",           campaign:"Beauty Campaign",  read:true,  body:"Thank you for the AW25 brief. Several of our models are a great fit. Expect our submission in 48 hours." },
];

function MessagingScreen() {
  const [activeTab, setActiveTab] = useState("inbox");
  const [openMsg, setOpenMsg] = useState<typeof INBOX_MSGS[number]|null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [replyMode, setReplyMode] = useState<"reply"|"replyAll"|null>(null);
  const [replyText, setReplyText] = useState("");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Messaging" sub="Organization and agency communications"/>
      {/* Action buttons row */}
      <div className="bg-card border-b border-border px-6 py-3 flex items-center gap-2 shrink-0">
        {[["New Message",true],["Drafts",false],["Archived",false],["Sent",false]].map(([label,primary])=>(
          <button key={String(label)}
            onClick={()=>{ if(label==="New Message") setShowCompose(true); setActiveTab(String(label).toLowerCase().replace(" ","-")); }}
            className={cx("px-4 py-2 text-xs font-medium rounded-md border transition-colors cursor-pointer",
              activeTab===String(label).toLowerCase().replace(" ","-")
                ?"bg-foreground text-primary-foreground border-foreground"
                :"bg-card border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            )}>{String(label)}</button>
        ))}
      </div>

      {/* Column headers */}
      <div className="bg-muted/30 border-b border-border px-4 py-2 flex items-center shrink-0 gap-2">
        <div className="w-16 shrink-0 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Urgent</div>
        <div className="w-36 shrink-0 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Date / Time</div>
        <div className="flex-1 min-w-0 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Subject</div>
        <div className="w-28 shrink-0 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Sender</div>
        <div className="w-36 shrink-0 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Organization</div>
        <div className="w-24 shrink-0 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Title</div>
        <div className="w-32 shrink-0 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Campaign</div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-auto divide-y divide-border">
        {INBOX_MSGS.map(m=>(
          <div key={m.id} onClick={()=>setOpenMsg(m)}
            className={cx("flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-secondary transition-colors", !m.read&&"bg-muted/20")}
          >
            <div className="w-16 shrink-0">
              {m.urgent&&<span className="text-[8px] font-mono border border-[#C0392B] text-[#C0392B] px-1.5 py-0.5 rounded-sm tracking-wider">URGENT</span>}
            </div>
            <div className="w-36 shrink-0 text-[10px] font-mono text-muted-foreground leading-tight">{m.date}</div>
            <div className={cx("flex-1 min-w-0 text-sm truncate", !m.read&&"font-semibold")}>{m.subject}</div>
            <div className="w-28 shrink-0 text-xs truncate">{m.sender}</div>
            <div className="w-36 shrink-0 text-xs text-muted-foreground truncate">{m.org}</div>
            <div className="w-24 shrink-0 text-xs text-muted-foreground truncate">{m.title}</div>
            <div className="w-32 shrink-0 text-xs text-muted-foreground truncate">{m.campaign}</div>
          </div>
        ))}
      </div>

      {/* Open message overlay */}
      {openMsg && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4 shrink-0">
              <div>
                {openMsg.urgent&&<span className="text-[8px] font-mono border border-[#C0392B] text-[#C0392B] px-1.5 py-0.5 rounded-sm mr-2">URGENT</span>}
                <div className="text-sm font-semibold mt-1">{openMsg.subject}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{openMsg.sender} · {openMsg.org} · {openMsg.title}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{openMsg.date} · {openMsg.campaign}</div>
              </div>
              <button onClick={()=>{setOpenMsg(null);setReplyMode(null);setReplyText("");}} className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"><X size={16}/></button>
            </div>
            <div className="px-6 py-5 flex-1 overflow-auto">
              <p className="text-sm leading-relaxed">{openMsg.body}</p>
            </div>
            {replyMode ? (
              <div className="border-t border-border p-4 space-y-3 shrink-0">
                <div className="text-xs font-semibold text-muted-foreground">{replyMode==="replyAll"?"Reply All":"Reply"} — {openMsg.sender}</div>
                <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} rows={4} placeholder="Write your reply…"
                  className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none"/>
                <div className="flex gap-2">
                  <Btn variant="primary" size="sm" onClick={()=>{setReplyMode(null);setReplyText("");}}>Send</Btn>
                  <Btn variant="ghost" size="sm" onClick={()=>setReplyMode(null)}>Cancel</Btn>
                </div>
              </div>
            ) : (
              <div className="border-t border-border px-6 py-3 flex items-center gap-2 shrink-0">
                <Btn variant="primary" size="sm" onClick={()=>setReplyMode("reply")}>Reply</Btn>
                <Btn variant="outline" size="sm" onClick={()=>setReplyMode("replyAll")}>Reply All</Btn>
                <Btn variant="ghost" size="sm" onClick={()=>setOpenMsg(null)}>Archive</Btn>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compose window */}
      {showCompose && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="text-sm font-semibold">New Message</div>
              <button onClick={()=>setShowCompose(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-3">
              <TextInput label="To" placeholder="Recipient name or agency"/>
              <TextInput label="Subject" placeholder="Message subject"/>
              <FSelect label="Campaign (optional)" options={["Select campaign…","AW25 Womenswear","SS25 Fragrance","Resort Lookbook 2025"]}/>
              <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" className="cursor-pointer"/><span>Mark as urgent</span></label>
              <Textarea label="Message" placeholder="Write your message…" rows={5}/>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <Btn variant="primary" onClick={()=>setShowCompose(false)}>Send</Btn>
              <Btn variant="outline" onClick={()=>setShowCompose(false)}>Save Draft</Btn>
              <Btn variant="ghost" onClick={()=>setShowCompose(false)}>Discard</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── USERS SCREEN ─────────────────────────────────────────────────────────────

function UsersScreen() {
  const [showMakeGroup, setShowMakeGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<number[]>([]);
  const [groups, setGroups] = useState(["Creative Leadership","Campaign Team","Finance","Legal","Elite Team"]);
  const [filterAccess, setFilterAccess] = useState("all");

  const filtered = filterAccess==="all" ? ORG_USERS : ORG_USERS.filter(u=>u.access===filterAccess);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Users" sub="Organization members, access levels, and groups"
        actions={<Btn variant="primary" size="sm" icon={<Plus size={13}/>} onClick={()=>setShowMakeGroup(true)}>Make Group</Btn>}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 gap-5">

          {/* Member roster */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Organization Members</h2>
              <div className="flex items-center gap-1">
                {["all","administrator","enhanced","basic"].map(a=>(
                  <button key={a} onClick={()=>setFilterAccess(a)}
                    className={cx("text-[9px] font-mono px-2 py-1 rounded-sm border transition-colors cursor-pointer capitalize",
                      filterAccess===a?"bg-foreground text-primary-foreground border-foreground":"border-border text-muted-foreground hover:border-foreground"
                    )}>{a}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {filtered.map(u=>(
                <div key={u.id} className="bg-card border border-border rounded-md p-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <XBox className="w-8 h-8 rounded-full"/>
                      <div>
                        <div className="text-sm font-semibold">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.title} · {u.org}</div>
                      </div>
                    </div>
                    <Badge label={u.access} variant={ACCESS_BADGE[u.access]}/>
                  </div>
                  <div className="space-y-0.5 mb-2">
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    <div className="text-xs text-muted-foreground font-mono">{u.phone}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-sm">{u.group}</span>
                    <div className="flex gap-1">
                      {(["administrator","enhanced","basic"] as const).map(a=>(
                        <button key={a} className={cx("text-[9px] font-mono px-1.5 py-0.5 rounded-sm border cursor-pointer capitalize",
                          u.access===a?"bg-foreground text-primary-foreground border-foreground":"border-border text-muted-foreground hover:border-foreground"
                        )}>{a.slice(0,5)}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Groups */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Groups</h2>
              <button onClick={()=>setShowMakeGroup(true)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer border border-dashed border-border rounded-md px-3 py-1.5 hover:border-foreground flex items-center gap-1">
                <Plus size={11}/> New group
              </button>
            </div>
            <div className="space-y-2">
              {groups.map(g=>{
                const members = ORG_USERS.filter(u=>u.group===g);
                return (
                  <div key={g} className="bg-card border border-border rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold">{g}</div>
                      <Badge label={`${members.length} member${members.length!==1?"s":""}`} variant="default"/>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {members.map(m=><span key={m.id} className="text-[9px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-sm font-mono">{m.name.split(" ")[0]}</span>)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-2 font-mono italic">Used in agency auto-assign</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Make Group modal */}
      {showMakeGroup && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="text-sm font-semibold">Create Group</div>
              <button onClick={()=>setShowMakeGroup(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-4">
              <TextInput label="Group Name" placeholder="e.g. Campaign Team A"/>
              <div>
                <FieldLabel>Select Members</FieldLabel>
                <div className="space-y-1 max-h-52 overflow-auto border border-border rounded-md divide-y divide-border">
                  {ORG_USERS.map(u=>(
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

// ─── PAID STAMP ───────────────────────────────────────────────────────────────

function PaidStamp({ size = 120, animating = false }: { size?: number; animating?: boolean }) {
  return (
    <div className={cx("flex items-center justify-center", animating && "transition-all duration-700")}>
      <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"
        className={cx(animating ? "animate-bounce" : "")}>
        {/* Outer ring */}
        <circle cx="60" cy="60" r="56" stroke="#16a34a" strokeWidth="4" fill="none"/>
        {/* Inner ring */}
        <circle cx="60" cy="60" r="48" stroke="#16a34a" strokeWidth="2" fill="none"/>
        {/* Top & bottom horizontal banner bars */}
        <rect x="4" y="42" width="112" height="14" fill="#16a34a" opacity="0.15"/>
        <rect x="4" y="64" width="112" height="14" fill="#16a34a" opacity="0.15"/>
        {/* PAID text diagonal */}
        <text
          x="60" y="66"
          textAnchor="middle"
          fontSize="26"
          fontWeight="900"
          fill="#16a34a"
          fontFamily="serif"
          transform="rotate(-22 60 60)"
          letterSpacing="3"
        >PAID</text>
        {/* Decorative top & bottom lines */}
        <line x1="10" y1="42" x2="110" y2="42" stroke="#16a34a" strokeWidth="3"/>
        <line x1="10" y1="78" x2="110" y2="78" stroke="#16a34a" strokeWidth="3"/>
      </svg>
    </div>
  );
}

// ─── PAYMENT CONFIRMATION ANIMATION ───────────────────────────────────────────

function PaymentSuccessOverlay({ campaign, amount, onClose }: {
  campaign: string; amount: string; onClose: () => void;
}) {
  const [phase, setPhase] = useState<"processing"|"stamp"|"done">("processing");

  const startAnimation = () => {
    setTimeout(() => setPhase("stamp"), 800);
    setTimeout(() => setPhase("done"), 2000);
    setTimeout(() => onClose(), 5000);
  };

  // Trigger on mount
  useState(() => { startAnimation(); });

  return (
    <div className="absolute inset-0 bg-card/97 flex flex-col items-center justify-center gap-6 rounded-xl z-50">
      {phase === "processing" && (
        <>
          <div className="w-14 h-14 border-2 border-border border-t-[#C4A84A] rounded-full animate-spin"/>
          <div className="text-base font-semibold text-foreground">Processing payment…</div>
          <div className="text-xs text-muted-foreground font-mono">{campaign}</div>
        </>
      )}
      {(phase === "stamp" || phase === "done") && (
        <>
          <div className={cx("transition-all duration-500", phase === "stamp" ? "scale-150 opacity-0" : "scale-100 opacity-100")}>
            <PaidStamp size={140}/>
          </div>
          <div className="text-center space-y-1">
            <div className="text-base font-semibold text-foreground">Payment Authorized</div>
            <div className="text-sm text-[#16a34a] font-semibold">{amount} — Paid in Full</div>
            <div className="text-xs text-muted-foreground font-mono">{campaign}</div>
          </div>
          {phase === "done" && (
            <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer">
              Close
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── DIRECTORY SCREEN ─────────────────────────────────────────────────────────

function DirectoryScreen() {
  const [showAddUser, setShowAddUser] = useState(false);
  const [showMakeGroup, setShowMakeGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<number[]>([]);
  const [groups, setGroups] = useState(["Creative Leadership","Campaign Team","Finance","Legal","Elite Team"]);
  const [filterAccess, setFilterAccess] = useState("all");
  const [users, setUsers] = useState(ORG_USERS);
  const [newUser, setNewUser] = useState({ name:"", email:"", title:"", phone:"", access:"basic", org:"Acne Studios" });

  const ME_ID = 1; // logged in user is admin (id=1)
  const isAdmin = (id: number) => users.find(u=>u.id===id)?.access==="administrator";

  const filtered = filterAccess==="all" ? users : users.filter(u=>u.access===filterAccess);

  function changeAccess(userId: number, newAccess: string) {
    // Admins can't change other admins' status
    if (isAdmin(userId) && userId !== ME_ID) return;
    // Only admins can change any status
    if (!isAdmin(ME_ID)) return;
    setUsers(p=>p.map(u=>u.id===userId?{...u,access:newAccess}:u));
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Directory" sub="Organization members and groups"
        actions={<button onClick={()=>setShowAddUser(true)} className="px-4 py-2 text-sm font-medium bg-foreground text-primary-foreground rounded-md hover:bg-[#2a2a2a] cursor-pointer flex items-center gap-2"><Plus size={13}/> Add User</button>}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 gap-5">

          {/* Left: Member roster */}
          <div>
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
            <div className="space-y-2">
              {filtered.map(u=>{
                const canEdit = isAdmin(ME_ID) && !(isAdmin(u.id) && u.id !== ME_ID);
                return (
                  <div key={u.id} className="bg-card border border-border rounded-md p-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-secondary border border-border rounded-full flex items-center justify-center text-xs font-semibold shrink-0">
                          {u.name.split(" ").map((n:string)=>n[0]).join("").slice(0,2)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.title} · {u.org}</div>
                        </div>
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
          </div>

          {/* Right: Groups */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Groups</h2>
              <button onClick={()=>setShowMakeGroup(true)}
                className="text-xs font-medium bg-secondary border border-border text-muted-foreground rounded-md px-3 py-1.5 hover:border-foreground hover:text-foreground cursor-pointer flex items-center gap-1 transition-colors">
                <Plus size={11}/> Make Group
              </button>
            </div>
            <div className="space-y-2">
              {groups.map(g=>{
                const members = users.filter(u=>u.group===g);
                return (
                  <div key={g} className="bg-card border border-border rounded-md p-4">
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
              <div className="text-sm font-semibold">Add New User</div>
              <button onClick={()=>setShowAddUser(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-3">
              <TextInput label="Full Name" placeholder="e.g. Marcus Webb"/>
              <TextInput label="Email" placeholder="email@company.com" type="email"/>
              <TextInput label="Title" placeholder="e.g. Campaign Manager"/>
              <TextInput label="Phone" placeholder="+1 212 555 0100" type="tel"/>
              <FSelect label="Access Level" options={["basic — Standard access","enhanced — Elevated access","administrator — Full admin access"]}/>
              <TextInput label="Organization" placeholder="e.g. Acne Studios"/>
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
              <div className="text-sm font-semibold">Create Group</div>
              <button onClick={()=>setShowMakeGroup(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-4">
              <TextInput label="Group Name" placeholder="e.g. Campaign Team A"/>
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

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────

function LoginScreen({ onBrandLogin, onAgencyLogin, onSignup }: {
  onBrandLogin: () => void; onAgencyLogin: () => void; onSignup: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"brand"|"agency">("brand");
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-foreground rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground text-2xl font-bold tracking-tight">D</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight">DVURE</div>
          <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">Talent Operating System</div>
          {/* Brand / Agency toggle — mirrors the public website buttons */}
          <div className="flex gap-2 mt-6 justify-center">
            <button onClick={()=>setMode("brand")}
              className={cx("px-5 py-2.5 rounded-md text-sm font-semibold cursor-pointer transition-colors border",
                mode==="brand"?"bg-foreground text-primary-foreground border-foreground":"bg-card border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              )}>Brand Sign-In</button>
            <button onClick={()=>setMode("agency")}
              className={cx("px-5 py-2.5 rounded-md text-sm font-semibold cursor-pointer transition-colors border",
                mode==="agency"?"bg-foreground text-primary-foreground border-foreground":"bg-card border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              )}>Agency Sign-In</button>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg space-y-4">
          <div className="text-xs text-muted-foreground text-center font-mono mb-2">
            Signing in as {mode === "brand" ? "Brand" : "Agency"}
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <div className="flex items-center border border-border rounded-md bg-input-background overflow-hidden">
              <Mail size={14} className="text-muted-foreground ml-3 shrink-0"/>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"
                className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"/>
            </div>
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <div className="flex items-center border border-border rounded-md bg-input-background overflow-hidden">
              <Lock size={14} className="text-muted-foreground ml-3 shrink-0"/>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
                className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"/>
            </div>
          </div>
          <button onClick={mode==="brand"?onBrandLogin:onAgencyLogin}
            className="w-full py-2.5 bg-foreground text-primary-foreground rounded-md text-sm font-semibold hover:bg-[#2a2a2a] cursor-pointer transition-colors">
            Sign In
          </button>
          <div className="text-center text-xs text-muted-foreground">
            <button className="hover:text-foreground cursor-pointer underline underline-offset-2">Forgot password?</button>
          </div>
        </div>
        {mode === "brand" && (
          <div className="text-center mt-5 text-xs text-muted-foreground">
            New to DVURE?{" "}
            <button onClick={onSignup} className="text-foreground font-medium cursor-pointer hover:underline">Start your free trial</button>
          </div>
        )}
        {mode === "agency" && (
          <div className="text-center mt-5 text-xs text-muted-foreground">
            New agency?{" "}
            <button onClick={onSignup} className="text-foreground font-medium cursor-pointer hover:underline">Create agency account</button>
          </div>
        )}
        <div className="text-center mt-3 text-[10px] text-muted-foreground font-mono">
          Model sign-in is available via the DVURE mobile app.
        </div>
      </div>
    </div>
  );
}

// ─── SIGNUP SCREEN ────────────────────────────────────────────────────────────

function SignupScreen({ onBack, onComplete, defaultType }: {
  onBack: () => void; onComplete: () => void; defaultType?: "brand"|"agency";
}) {
  const [orgType, setOrgType] = useState<"brand"|"agency">(defaultType || "brand");
  const [step, setStep] = useState(1);
  const totalSteps = orgType === "brand" ? 4 : 3;

  return (
    <div className="h-screen flex items-center justify-center bg-background overflow-auto py-8">
      <div className="w-full max-w-lg px-4">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-foreground rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-primary-foreground text-xl font-bold">D</span>
          </div>
          <div className="text-xl font-semibold">
            {orgType === "brand" ? "Start your 14-day free trial" : "Create your agency account"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Step {step} of {totalSteps}</div>
        </div>

        {/* Org type switcher — step 1 only */}
        {step === 1 && (
          <div className="flex gap-2 mb-4">
            {[{id:"brand",label:"Brand"},{id:"agency",label:"Agency"}].map(t=>(
              <button key={t.id} onClick={()=>setOrgType(t.id)}
                className={cx("flex-1 py-2 rounded-md text-sm font-medium cursor-pointer border transition-colors",
                  orgType===t.id?"bg-foreground text-primary-foreground border-foreground":"bg-card border-border text-muted-foreground hover:border-foreground"
                )}>{t.label}</button>
            ))}
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          {step === 1 && (
            <div className="space-y-3">
              <div className="text-sm font-semibold mb-1">Organization information</div>
              <TextInput label="Organization Name" placeholder={orgType==="brand"?"e.g. Acne Studios":"e.g. Elite Model Management"}/>
              <TextInput label="Your Full Name" placeholder="e.g. Marcus Webb"/>
              <TextInput label="Work Email" placeholder="you@company.com" type="email"/>
              <TextInput label="Phone (optional)" placeholder="+1 212 555 0100" type="tel"/>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <div className="text-sm font-semibold mb-1">Create your password</div>
              <TextInput label="Password" placeholder="Min. 8 characters" type="password"/>
              <TextInput label="Confirm Password" placeholder="Repeat password" type="password"/>
              <div className="bg-secondary border border-border rounded-md px-3 py-2.5 text-xs text-muted-foreground space-y-0.5">
                <div>✓ At least 8 characters</div>
                <div>✓ One uppercase letter</div>
                <div>✓ One number or symbol</div>
              </div>
            </div>
          )}
          {step === 3 && orgType === "brand" && (
            <div className="space-y-4">
              <div className="text-sm font-semibold">Start your free trial</div>
              <div className="bg-secondary border border-border rounded-md p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">DVURE Brand OS</div>
                  <div className="text-sm font-semibold">$99 / month</div>
                </div>
                <div className="text-xs text-muted-foreground">14-day free trial. No charge until trial ends. Cancel anytime.</div>
                <div className="border-t border-border pt-2 text-xs text-muted-foreground space-y-0.5">
                  <div>✓ Unlimited campaigns</div>
                  <div>✓ Agency submissions</div>
                  <div>✓ Contract management</div>
                  <div>✓ Payment processing via Stripe</div>
                </div>
              </div>
              <div>
                <FieldLabel>Card number (for after trial)</FieldLabel>
                <div className="flex items-center border border-border rounded-md bg-input-background overflow-hidden">
                  <CreditCard size={14} className="text-muted-foreground ml-3 shrink-0"/>
                  <input placeholder="•••• •••• •••• ••••" className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground font-mono tracking-widest"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Expiry" placeholder="MM/YY"/>
                <TextInput label="CVV" placeholder="•••"/>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                <Lock size={9}/> Secured by Stripe. You will not be charged for 14 days.
              </div>
            </div>
          )}
          {step === 3 && orgType === "agency" && (
            <div className="space-y-3">
              <div className="text-sm font-semibold mb-1">Agency details</div>
              <FSelect label="Primary Market" options={["Fashion & Editorial","Commercial","Fitness & Sports","Beauty","All markets"]}/>
              <FSelect label="Headquarters" options={["New York, NY","Los Angeles, CA","London, UK","Paris, FR","Milan, IT","Other"]}/>
              <TextInput label="Website (optional)" placeholder="https://youragency.com"/>
            </div>
          )}
          {step === 4 && orgType === "brand" && (
            <div className="space-y-3 text-center py-4">
              <div className="w-14 h-14 bg-secondary border border-border rounded-full flex items-center justify-center mx-auto">
                <Check size={24} className="text-foreground"/>
              </div>
              <div className="text-sm font-semibold">You are all set!</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Your 14-day free trial has started. You will be charged $99/month starting{" "}
                <strong>July 3, 2026</strong> unless you cancel before then.
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">Manage subscription under Settings at any time.</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-5">
          <button onClick={step===1?onBack:()=>setStep(step-1)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
            <ChevronLeft size={13}/> {step===1?"Back to login":"Back"}
          </button>
          {step < totalSteps
            ? <button onClick={()=>setStep(step+1)}
                className="px-5 py-2 rounded-md text-sm font-medium cursor-pointer bg-foreground text-primary-foreground hover:bg-[#2a2a2a] transition-colors">
                Continue <ArrowRight size={14} className="inline"/>
              </button>
            : <button onClick={onComplete} className="px-5 py-2 rounded-md text-sm font-medium bg-foreground text-primary-foreground hover:bg-[#2a2a2a] cursor-pointer">
                {orgType === "brand" ? "Launch Brand OS" : "Create Account"}
              </button>
          }
        </div>
      </div>
    </div>
  );
}

// ─── OS SELECTOR ──────────────────────────────────────────────────────────────

function OsSelector({ onSelect, onLogout, defaultOs }: { onSelect: (os: OSType) => void; onLogout: () => void; defaultOs?: OSType }) {
  const options: { id: OSType; label: string; desc: string; sub: string; Icon: typeof User }[] = [
    { id:"brand",  label:"Brand OS",  desc:"Campaign creation, talent selection, payments, and reporting.", sub:"For brands and creative directors.", Icon:Building },
    { id:"agency", label:"Agency OS", desc:"Campaign invitations, talent submissions, contracts, and invoicing.", sub:"For talent agencies and agents.", Icon:Users },
  ];
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-2xl px-6">
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-foreground rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground text-2xl font-bold">D</span>
          </div>
          <div className="text-2xl font-semibold">Welcome back, Marcus</div>
          <div className="text-sm text-muted-foreground mt-1">Select your workspace to continue</div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {options.map(o=>{
            const OIcon = o.Icon;
            return (
              <div key={o.id} onClick={()=>onSelect(o.id)}
                className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-foreground transition-all hover:shadow-md group">
                <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center mb-4 group-hover:bg-foreground group-hover:text-primary-foreground transition-colors">
                  <OIcon size={20} className="text-muted-foreground group-hover:text-primary-foreground"/>
                </div>
                <div className="text-sm font-semibold mb-1">{o.label}</div>
                <div className="text-xs text-muted-foreground leading-relaxed mb-3">{o.desc}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{o.sub}</div>
              </div>
            );
          })}
        </div>
        <div className="text-center">
          <button onClick={onLogout} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1.5 mx-auto">
            <LogOut size={12}/> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AGENCY OS ────────────────────────────────────────────────────────────────

function AgencyOS({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState("invitations");
  const agencyNav = [
    { id:"invitations", label:"Campaign Invitations", count:3  },
    { id:"submissions", label:"Talent Submissions",   count:12 },
    { id:"contracts",   label:"Contracts",            count:2  },
    { id:"invoicing",   label:"Invoicing",            count:4  },
    { id:"messaging",   label:"Messaging",            count:1  },
    { id:"roster",      label:"Talent Roster"                  },
  ];
  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <aside className="w-52 shrink-0 bg-card border-r border-border flex flex-col">
        <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
          <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">E</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">Elite Models</div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Agency OS</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {agencyNav.map(item=>(
            <button key={item.id} onClick={()=>setView(item.id)}
              className={cx("w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors text-left",
                view===item.id?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}>
              {item.label}
              {item.count && <span className="ml-auto text-[10px] font-mono bg-foreground text-primary-foreground px-1.5 py-0.5 rounded-full">{item.count}</span>}
            </button>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-border">
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-secondary">
            <LogOut size={13}/> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-h-0">
        <div className="h-14 border-b border-border bg-card flex items-center px-6">
          <div className="text-sm font-semibold capitalize">{view.replace("-"," ")}</div>
          <div className="ml-auto text-xs text-muted-foreground font-mono bg-secondary px-2 py-1 rounded-sm">Agency OS · Beta</div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {view === "invitations" && (
            <div className="max-w-2xl space-y-3">
              <p className="text-sm text-muted-foreground mb-4">Brand campaign invitations requiring talent submissions.</p>
              {[
                { brand:"Acne Studios", campaign:"AW25 Womenswear Campaign", type:"Editorial", due:"06/20/2025", budget:"$800–$1,200/day", models:3 },
                { brand:"Nike",         campaign:"Run Global SS25",          type:"Fitness",   due:"07/01/2025", budget:"$600–$900/day",   models:5 },
                { brand:"Chanel",        campaign:"Beauty Editorial AW25",   type:"Beauty",    due:"06/28/2025", budget:"$1,200–$2,000/day",models:2 },
              ].map(inv=>(
                <div key={inv.campaign} className="bg-card border border-border rounded-md p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="text-sm font-semibold">{inv.campaign}</div>
                      <div className="text-xs text-muted-foreground">{inv.brand} · {inv.type} · Due {inv.due}</div>
                    </div>
                    <Badge label={`${inv.models} needed`} variant="info"/>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">Budget: {inv.budget}/day</div>
                  <div className="flex gap-2">
                    <Btn variant="primary" size="sm">Submit Talent</Btn>
                    <Btn variant="outline" size="sm">View Brief</Btn>
                    <Btn variant="ghost" size="sm">Decline</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
          {view !== "invitations" && (
            <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-md">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">{view.charAt(0).toUpperCase()+view.slice(1)}</div>
                <div className="text-xs text-muted-foreground">Agency OS · Coming soon</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── MODEL OS ─────────────────────────────────────────────────────────────────

function ModelOS({ onLogout }: { onLogout: () => void }) {
  const modelNav = [
    { id:"bookings",      label:"My Bookings",    count:2 },
    { id:"campaigns",     label:"Campaigns",      count:3 },
    { id:"availability",  label:"Availability"            },
    { id:"contracts",     label:"Contracts",      count:1 },
    { id:"earnings",      label:"Earnings"                },
    { id:"profile",       label:"My Profile"              },
  ];
  const [view, setView] = useState("bookings");
  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <aside className="w-52 shrink-0 bg-card border-r border-border flex flex-col">
        <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-[#C9961A] to-[#9A7015] rounded-full flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">ZO</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">Zara Okafor</div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Model OS</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {modelNav.map(item=>(
            <button key={item.id} onClick={()=>setView(item.id)}
              className={cx("w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors text-left",
                view===item.id?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}>
              {item.label}
              {item.count && <span className="ml-auto text-[10px] font-mono bg-foreground text-primary-foreground px-1.5 py-0.5 rounded-full">{item.count}</span>}
            </button>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-border">
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-secondary">
            <LogOut size={13}/> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-h-0">
        <div className="h-14 border-b border-border bg-card flex items-center px-6">
          <div className="text-sm font-semibold capitalize">{view}</div>
          <div className="ml-auto text-xs text-muted-foreground font-mono bg-secondary px-2 py-1 rounded-sm">Model OS · Beta</div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {view === "bookings" && (
            <div className="max-w-2xl space-y-3">
              {[
                { campaign:"AW25 Womenswear", brand:"Acne Studios", date:"07/14/2025", rate:"$980/day", status:"Confirmed" },
                { campaign:"Resort Lookbook", brand:"Acne Studios", date:"07/22/2025", rate:"$980/day", status:"Pending contract" },
              ].map(b=>(
                <div key={b.campaign} className="bg-card border border-border rounded-md p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="text-sm font-semibold">{b.campaign}</div>
                      <div className="text-xs text-muted-foreground">{b.brand} · {b.date}</div>
                    </div>
                    <Badge label={b.status} variant={b.status==="Confirmed"?"active":"pending"}/>
                  </div>
                  <div className="text-xs font-mono">{b.rate}</div>
                </div>
              ))}
            </div>
          )}
          {view !== "bookings" && (
            <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-md">
              <div className="text-sm text-muted-foreground">Model OS · {view.charAt(0).toUpperCase()+view.slice(1)} · Coming soon</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── SETTINGS SCREEN ─────────────────────────────────────────────────────────

function SettingsScreen({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"subscription"|"billing"|"security"|"org">("subscription");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Settings" sub="Acne Studios · Account and billing"/>
      <div className="flex-1 flex min-h-0">
        {/* Settings sidebar */}
        <div className="w-44 shrink-0 border-r border-border bg-card px-2 py-4 space-y-0.5">
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

        {/* Settings content */}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-xl">

            {tab === "subscription" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold mb-0.5">Subscription</h2>
                  <p className="text-sm text-muted-foreground">Manage your DVURE Brand OS subscription.</p>
                </div>
                <div className="bg-card border border-border rounded-md overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">DVURE Brand OS</div>
                      <div className="text-xs text-muted-foreground">Professional plan · Billed monthly</div>
                    </div>
                    <Badge label="Active Trial" variant="success"/>
                  </div>
                  <div className="px-5 py-4 space-y-3 text-sm">
                    {[["Plan","Brand OS Professional"],["Monthly price","$99 / month"],["Trial ends","July 3, 2026"],["Next charge","$99 on July 3, 2026"],["Billing cycle","Monthly"]].map(([k,v])=>(
                      <div key={k} className="flex justify-between border-b border-border last:border-0 pb-3 last:pb-0">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-3 bg-muted/20 flex gap-2">
                    <Btn variant="outline" size="sm">Upgrade plan</Btn>
                    <Btn variant="ghost" size="sm">Cancel subscription</Btn>
                  </div>
                </div>
                <div className="bg-secondary border border-border rounded-md px-4 py-3 text-xs text-muted-foreground">
                  Subscription payments are processed securely by <strong>Stripe</strong>. You can cancel at any time before your trial ends with no charge.
                </div>
              </div>
            )}

            {tab === "billing" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold mb-0.5">Billing</h2>
                  <p className="text-sm text-muted-foreground">Payment methods and billing history.</p>
                </div>
                {/* Subscription card on file */}
                <div className="bg-card border border-border rounded-md p-4">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Subscription Card</div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 bg-gradient-to-br from-[#C9961A] to-[#9A7015] rounded flex items-center justify-center text-white text-[9px] font-bold">AMEX</div>
                    <div>
                      <div className="text-sm font-medium">American Express ending 4242</div>
                      <div className="text-xs text-muted-foreground">Expires 09/27 · Marcus Webb</div>
                    </div>
                    <Btn variant="ghost" size="sm">Change</Btn>
                  </div>
                </div>
                {/* Billing history */}
                <div className="bg-card border border-border rounded-md overflow-hidden">
                  <div className="px-5 py-3 border-b border-border text-xs font-mono text-muted-foreground uppercase tracking-wider">Billing History</div>
                  <div className="divide-y divide-border">
                    {[["Jun 3, 2026","DVURE Brand OS — Trial start","$0.00","Trial"],["May 3, 2026","DVURE Brand OS","$99.00","Paid"],["Apr 3, 2026","DVURE Brand OS","$99.00","Paid"]].map(([date,desc,amount,status])=>(
                      <div key={date} className="px-5 py-3 flex items-center justify-between text-sm">
                        <div>
                          <div className="font-medium">{desc}</div>
                          <div className="text-xs text-muted-foreground font-mono">{date}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono">{amount}</span>
                          <Badge label={status} variant={status==="Paid"?"active":status==="Trial"?"info":"draft"}/>
                          <button className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline">PDF</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "security" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold mb-0.5">Security</h2>
                  <p className="text-sm text-muted-foreground">Manage access and authentication settings.</p>
                </div>
                <div className="space-y-3">
                  {[{label:"Change password",desc:"Update your account password",action:"Update"},
                    {label:"Two-factor authentication",desc:"Add an extra layer of security (recommended)",action:"Enable"},
                    {label:"Active sessions",desc:"2 active sessions",action:"Manage"},
                    {label:"API access",desc:"Manage API keys for integrations",action:"View keys"},
                  ].map(item=>(
                    <div key={item.label} className="bg-card border border-border rounded-md px-4 py-3 flex items-center justify-between">
                      <div><div className="text-sm font-medium">{item.label}</div><div className="text-xs text-muted-foreground">{item.desc}</div></div>
                      <Btn variant="outline" size="sm">{item.action}</Btn>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "org" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold mb-0.5">Organization</h2>
                  <p className="text-sm text-muted-foreground">Manage your brand profile and workspace settings.</p>
                </div>
                <div className="space-y-3">
                  <TextInput label="Organization Name" placeholder="e.g. Acne Studios" defaultValue="Acne Studios"/>
                  <TextInput label="Website" placeholder="https://yourbrand.com"/>
                  <FSelect label="Industry" options={["Fashion & Luxury","Beauty","Sportswear","Commercial","Entertainment","Other"]}/>
                  <FSelect label="Headquarters" options={["New York, NY","Los Angeles, CA","London, UK","Paris, FR","Milan, IT","Other"]}/>
                  <TextInput label="Billing Contact Email" placeholder="billing@yourbrand.com"/>
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

// ─── REPORTS ──────────────────────────────────────────────────────────────────

function Reports() {
  const [running, setRunning] = useState<string|null>(null);
  const reportTypes = [
    { id:"ytd-finance",  label:"YTD Finance Report",       desc:"Total spend, invoices, payments, and budget utilization for the current fiscal year.", icon:BarChart2  },
    { id:"bookings",     label:"Booking Report",            desc:"All bookings by campaign, talent, agency, and date range.", icon:Briefcase     },
    { id:"quarterly",    label:"Quarterly Report",          desc:"Campaign performance, talent pipeline metrics, and spend summary by quarter.", icon:Calendar   },
    { id:"campaigns",    label:"Campaign Report",           desc:"Per-campaign breakdown: submissions, selections, bookings, and costs.", icon:Camera      },
    { id:"contracts",    label:"Contract Report",           desc:"Contract status, execution dates, and signature tracking.", icon:FileCheck    },
    { id:"agencies",     label:"Agency Performance Report", desc:"Submission volume, selection rate, and booking history by agency.", icon:Building2   },
    { id:"declines",     label:"Decline Reasons Report",    desc:"Reasons talent was declined across all campaigns — identify patterns and brief alignment issues.", icon:X           },
  ];
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Reports" sub="Generate reports from available data"/>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl">
          <p className="text-sm text-muted-foreground mb-6">Generate reports from any data available in DVURE. Select a report type and configure the date range to export.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reportTypes.map(r=>{
              const RIcon = r.icon;
              const isRunning = running === r.id;
              return (
                <div key={r.id} className="bg-card border border-border rounded-md p-5 hover:border-foreground/30 transition-colors">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 bg-secondary border border-border rounded-md flex items-center justify-center shrink-0">
                      <RIcon size={15} className="text-muted-foreground"/>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{r.label}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{r.desc}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <FSelect options={["Last 30 days","This quarter","YTD 2025","Custom range"]}/>
                    <Btn variant={isRunning?"secondary":"primary"} size="sm" onClick={()=>setRunning(isRunning?null:r.id)}>
                      {isRunning?"Close":"Run Report"}
                    </Btn>
                  </div>
                  {isRunning&&(
                    <div className="mt-3 bg-secondary border border-border rounded-md p-3">
                      <div className="text-xs font-mono text-muted-foreground mb-2">Preview — {r.label}</div>
                      <div className="text-xs text-muted-foreground">Report data will appear here. Export as CSV or PDF.</div>
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
          <Stat label="Agencies"  value="4"  sub="3 with active bookings"/>
          <Stat label="Added"     value={String(added.length)} sub="Instant campaign alerts"/>
          <Stat label="Submissions" value="44" sub="Across active campaigns"/>
        </div>
        <div className="space-y-2">
          {agencies.map(a=>{
            const isAdded = added.includes(a.name);
            return (
              <div key={a.name} className="bg-card border border-border rounded-md p-4 flex items-center gap-4 hover:border-foreground/30">
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

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [authStep, setAuthStep] = useState<AuthStep>("login");
  const [osType, setOsType] = useState<OSType>("brand");
  const [view, setView] = useState<AppView>("dashboard");
  const [globalNav, setGlobalNav] = useState<GlobalView>("dashboard");
  const [campaignSection, setCampaignSection] = useState<CampaignSection>("moodboard");
  const [activityOpen, setActivityOpen] = useState(false);

  // Auth gates
  if (authStep === "login") return <LoginScreen
    onBrandLogin={()=>{ setOsType("brand"); setAuthStep("app"); }}
    onAgencyLogin={()=>{ setOsType("agency"); setAuthStep("app"); }}
    onSignup={()=>setAuthStep("signup")}
  />;
  if (authStep === "signup") return <SignupScreen onBack={()=>setAuthStep("login")} onComplete={()=>{ setOsType("brand"); setAuthStep("app"); }}/>;
  if (authStep === "os-select") return <OsSelector onSelect={os=>{ setOsType(os); setAuthStep("app"); }} onLogout={()=>setAuthStep("login")}/>;
  if (osType === "agency") return <AgencyOS onLogout={()=>setAuthStep("login")}/>;
  if (osType === "model")  return <ModelOS  onLogout={()=>setAuthStep("login")}/>;


  const talentForCounts = SAMPLE_TALENT;
  const pipelineCounts: Record<string,number> = {
    submitted:  talentForCounts.filter(t=>t.stage==="submitted").length,
    shortlisted:talentForCounts.filter(t=>t.stage==="shortlisted").length,
    selected:   talentForCounts.filter(t=>t.stage==="selected").length,
    booked:     talentForCounts.filter(t=>t.stage==="booked").length,
  };

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
          <GlobalSidebar active={globalNav} onNav={handleGlobalNav} onOpenCampaign={openCampaign}/>
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {view==="dashboard"        && <Dashboard openCampaign={openCampaign}/>}
            {view==="campaigns"        && <CampaignsList openCampaign={openCampaign}/>}
            {view==="create-campaign"  && <CreateCampaign onBack={()=>setView("campaigns")}/>}
            {view==="contracts-global" && <GlobalContracts/>}
            {view==="payments-global"  && <GlobalPayments/>}
            {view==="messaging"        && <MessagingScreen/>}
            {view==="directory"        && <DirectoryScreen/>}
            {view==="reports"          && <Reports/>}
            {view==="settings"         && <SettingsScreen onLogout={()=>setAuthStep("login")}/>}
            {view==="network"          && <Network/>}
          </main>
        </>
      )}

      {/* Activity widget — hoverable icon on all pages, expands on hover/click */}
      <div className="fixed bottom-6 right-6 z-40 group">
        {activityOpen ? (
          <div className="w-72 bg-card border border-border rounded-md shadow-xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
              <div className="text-xs font-semibold">Activity</div>
              <button onClick={()=>setActivityOpen(false)} className="text-muted-foreground hover:text-foreground w-5 h-5 flex items-center justify-center rounded hover:bg-secondary transition-colors" title="Minimize">
                <span className="text-sm font-bold leading-none">−</span>
              </button>
            </div>
            <ActivityFeedPanel/>
          </div>
        ) : (
          <div className="relative">
            {/* Hover preview tooltip */}
            <div className="absolute bottom-14 right-0 w-64 bg-card border border-border rounded-md shadow-lg overflow-hidden opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
              <div className="px-3 py-2 border-b border-border text-xs font-semibold">Recent Activity</div>
              {ACTIVITY_EVENTS.slice(0,3).map(e=>(
                <div key={e.id} className="px-3 py-2 border-b border-border last:border-0">
                  <div className="text-xs font-medium">{e.type}</div>
                  <div className="text-[10px] text-muted-foreground">{e.actor} · {e.ts}</div>
                </div>
              ))}
              <div className="px-3 py-2 text-[10px] text-muted-foreground text-center">Click to open full feed</div>
            </div>
            <button onClick={()=>setActivityOpen(true)}
              className="w-10 h-10 bg-foreground text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:bg-[#2a2a2a] transition-colors">
              <Activity size={16}/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
