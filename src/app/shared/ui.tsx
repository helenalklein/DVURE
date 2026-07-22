import { useState, useContext, createContext, useEffect, useRef } from "react";
import { Bell, X, ChevronDown, Settings } from "lucide-react";
import { NOTIFS, ACTIVITY_EVENTS } from "./mockData";

export const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

// City/state/country-code fragment -> {flag, full country name}. Covers
// the fragments actually used in this app's location strings (US state
// codes fold to a single US entry). Extend as new countries come up
// rather than trying to cover every ISO code up front.
const COUNTRY_LOOKUP: Record<string, { flag: string; name: string }> = {
  US: { flag:"🇺🇸", name:"United States" },
  CA: { flag:"🇨🇦", name:"Canada" },
  UK: { flag:"🇬🇧", name:"United Kingdom" },
  GB: { flag:"🇬🇧", name:"United Kingdom" },
  FR: { flag:"🇫🇷", name:"France" },
  IT: { flag:"🇮🇹", name:"Italy" },
  DE: { flag:"🇩🇪", name:"Germany" },
  SE: { flag:"🇸🇪", name:"Sweden" },
};
const US_STATE_CODES = new Set(["NY","CA","IL","FL","TX","WA","MA","GA","PA","NJ","CT","AZ","NV","OR","CO"]);

// Derives a country from a "City, XX" location string — reuses the
// location data already on Talent/RosterModel rather than duplicating a
// separate country field that could drift out of sync with it.
export function countryFromLocation(location: string): { flag: string; name: string } | null {
  const code = location.split(",").pop()?.trim().toUpperCase();
  if (!code) return null;
  if (US_STATE_CODES.has(code)) return COUNTRY_LOOKUP.US;
  return COUNTRY_LOOKUP[code] ?? null;
}

export function CountryFlag({ location, country, className = "" }: { location?: string; country?: string; className?: string }) {
  const c = country ? COUNTRY_LOOKUP[country.toUpperCase()] : location ? countryFromLocation(location) : null;
  if (!c) return null;
  return (
    <span className={cx("relative inline-flex group/flag cursor-default", className)}>
      <span aria-hidden="true">{c.flag}</span>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap
        bg-foreground text-primary-foreground text-[10px] font-medium px-2 py-1 rounded-sm opacity-0 group-hover/flag:opacity-100 transition-opacity z-50">
        {c.name}
      </span>
    </span>
  );
}

export function XBox({ className = "" }: { className?: string }) {
  return (
    <div className={cx("bg-muted relative overflow-hidden flex items-center justify-center", className)}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="0" x2="100" y2="100" stroke="#D0D0D0" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
        <line x1="100" y1="0" x2="0" y2="100" stroke="#D0D0D0" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
      </svg>
    </div>
  );
}

// Staff/org user profiles use initials, not photos — distinct from talent
// cards (XBox), which stand in for real casting/portfolio images.
export function UserAvatar({ name, className = "" }: { name: string; className?: string }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2);
  return (
    <div className={cx("bg-secondary border border-border rounded-full flex items-center justify-center font-semibold shrink-0", className)}>
      {initials}
    </div>
  );
}


export function PolaroidIcon({ size = 15, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="2" width="18" height="21" rx="1.5"/>
      <rect x="6" y="5" width="12" height="11" rx="1"/>
      <line x1="9" y1="19" x2="15" y2="19"/>
    </svg>
  );
}

export function Badge({ label, variant = "default" }: { label: string; variant?: "default"|"active"|"pending"|"draft"|"success"|"warning"|"info" }) {
  const s: Record<string,string> = {
    default:"bg-secondary text-secondary-foreground", active:"bg-foreground text-primary-foreground",
    pending:"bg-accent border border-border text-muted-foreground", draft:"bg-muted text-muted-foreground",
    success:"bg-secondary border border-foreground/30 text-foreground", warning:"bg-secondary border border-muted-foreground text-foreground",
    info:"bg-secondary text-foreground border border-border",
  };
  return <span className={cx("inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium font-mono whitespace-nowrap", s[variant])}>{label}</span>;
}

export function Btn({ children, variant="primary", size="md", onClick, disabled, fullWidth, icon }: {
  children: string | JSX.Element | (string | JSX.Element)[];
  variant?: "primary"|"secondary"|"ghost"|"outline";
  size?: "sm"|"md"|"lg"; onClick?: () => void; disabled?: boolean; fullWidth?: boolean; icon?: JSX.Element;
}) {
  const base = "inline-flex items-center justify-center gap-1.5 font-medium rounded-md transition-colors cursor-pointer select-none";
  const sizes = { sm:"px-3 py-1.5 text-xs", md:"px-4 py-2 text-sm", lg:"px-5 py-2.5 text-sm" };
  const variants = {
    primary:"bg-gold text-gold-foreground hover:bg-gold/90 shadow-sm",
    secondary:"bg-secondary text-secondary-foreground border border-border hover:bg-accent",
    ghost:"text-muted-foreground hover:text-foreground hover:bg-accent",
    outline:"bg-card text-foreground border border-border hover:bg-secondary",
  };
  return <button type="button" disabled={disabled} className={cx(base, sizes[size], variants[variant], fullWidth&&"w-full", disabled&&"opacity-40 pointer-events-none")} onClick={onClick}>{icon}{children}</button>;
}

export function Stat({ label, value, sub, accent }: { label: string; value: string|number; sub?: string; accent?: boolean }) {
  return (
    <div className={cx("border rounded-md p-4", accent ? "bg-offwhite border-offwhite" : "glass-subtle")}>
      <div className={cx("text-xs font-mono mb-1", accent ? "text-offwhite-foreground/70" : "text-muted-foreground")}>{label}</div>
      <div className={cx("text-2xl font-semibold tabular-nums", accent ? "text-offwhite-foreground" : "")}>{value}</div>
      {sub && <div className={cx("text-xs mt-0.5", accent ? "text-offwhite-foreground/60" : "text-muted-foreground")}>{sub}</div>}
    </div>
  );
}

export function FieldLabel({ children }: { children: string }) {
  return <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">{children}</div>;
}

export function TextInput({ label, placeholder, type="text", defaultValue, value, onChange, readOnly }: {
  label?: string; placeholder: string; type?: string; defaultValue?: string; value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; readOnly?: boolean;
}) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <input type={type} placeholder={placeholder} defaultValue={defaultValue} value={value} onChange={onChange} readOnly={readOnly}
        className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground"/>
    </div>
  );
}

export function FSelect({ label, options, value, onChange }: { label?: string; options: string[]; value?: string; onChange?: (v: string) => void }) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="relative">
        <select value={value} onChange={onChange ? e=>onChange(e.target.value) : undefined}
          className="w-full appearance-none bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground pr-8">
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"/>
      </div>
    </div>
  );
}

export function Textarea({ label, placeholder, rows=3, defaultValue, value, onChange }: {
  label?: string; placeholder: string; rows?: number; defaultValue?: string;
  value?: string; onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <textarea placeholder={placeholder} rows={rows} defaultValue={value===undefined ? defaultValue : undefined} value={value} onChange={onChange}
        className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground resize-none"/>
    </div>
  );
}

export function Chip({ children, active, onClick }: { children: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cx("px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
      active?"bg-foreground text-primary-foreground border-foreground":"bg-card border-border text-muted-foreground hover:border-foreground hover:text-foreground"
    )}>{children}</button>
  );
}

export function SidebarBadge({ count }: { count: number }) {
  return <span className="ml-auto min-w-[18px] h-[18px] bg-foreground text-primary-foreground text-[10px] font-mono font-semibold rounded-full flex items-center justify-center px-1">{count}</span>;
}

// Capped height + its own scroll region, not "h-full" inside an
// unconstrained parent — that combination silently never scrolls and
// grows to fit every event instead, which is what let this take over the
// screen before.
export function ActivityFeedPanel({ onClose }: { onClose?: () => void }) {
  return (
    <div className="w-80 max-h-96 glass-strong border rounded-md overflow-hidden shadow-xl flex flex-col">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <div className="text-xs font-semibold">Activity</div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={13}/></button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto divide-y divide-border">
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

function BellButton() {
  const [open, setOpen] = useState(false);
  const unread = NOTIFS.filter(n => n.unread).length;
  const wrapRef = useRef<HTMLDivElement>(null);

  // A fixed-position click-catcher doesn't work here: TopBar uses the
  // .glass utility (backdrop-filter), and backdrop-filter establishes a
  // containing block for fixed-position descendants — so a "fixed inset-0"
  // catcher ends up clipped to TopBar's own box instead of the viewport.
  // A real document listener sidesteps that CSS quirk entirely.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button onClick={() => setOpen(p=>!p)} className="relative p-2 rounded-md hover:bg-secondary text-muted-foreground">
        <Bell size={15}/>
        {unread > 0 && <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-foreground text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center">{unread}</span>}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-80 glass-strong border rounded-md shadow-xl z-50 overflow-hidden">
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

// Who's signed in, provided once at each app's root (BrandApp, AgencyApp)
// and read here via context rather than threaded through every TopBar
// call site — TopBar is invoked from dozens of screens, so this keeps the
// signed-in identity in one place instead of a prop drilled everywhere.
export interface CurrentUser {
  name: string; title: string; org: string; email: string; phone: string;
  access: "administrator" | "enhanced" | "basic"; onSettings?: () => void;
}
const CurrentUserContext = createContext<CurrentUser | null>(null);
export function CurrentUserProvider({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}
export function useCurrentUser() {
  return useContext(CurrentUserContext);
}

function UserMenuButton() {
  const user = useContext(CurrentUserContext);
  if (!user) return null;
  return (
    <div onClick={user.onSettings} title={user.onSettings ? "Settings" : undefined}
      className={cx("flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-md transition-colors",
        user.onSettings && "cursor-pointer hover:bg-secondary"
      )}>
      <div className="text-right leading-tight">
        <div className="text-xs font-medium">{user.name}</div>
        <div className="text-[10px] text-muted-foreground">{user.title}</div>
      </div>
      <XBox className="w-6 h-6 rounded-full shrink-0"/>
      {user.onSettings && <Settings size={13} className="text-muted-foreground shrink-0"/>}
    </div>
  );
}

// No real backend to refetch from yet, so this is a UI affordance, not a
// data sync — a brief spin gives the same "just refreshed" confirmation a
// real one would, and it's mounted once in TopBar so every screen
// (campaigns, payments, messaging, everything) gets it for free.
function RefreshButton() {
  const [refreshing, setRefreshing] = useState(false);
  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  }
  return (
    <button onClick={handleRefresh}
      className="px-2.5 py-1.5 rounded-md hover:bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  );
}

export function TopBar({ title, sub, actions }: { title: string; sub?: string; actions?: JSX.Element }) {
  return (
    <div className="h-14 border-b glass flex items-center px-6 gap-4 shrink-0 z-20 relative">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate tracking-tight">{title}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">{actions}<RefreshButton/><UserMenuButton/><BellButton/></div>
    </div>
  );
}

// Reusable frosted modal shell — overlay + glass card. Use for new
// surfaces; existing bespoke modals keep their own markup for now.
export function Modal({ onClose, maxWidth = "max-w-md", children }: { onClose: () => void; maxWidth?: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={cx("glass-strong border rounded-xl w-full shadow-2xl overflow-hidden", maxWidth)} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
