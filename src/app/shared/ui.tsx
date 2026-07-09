import { useState } from "react";
import { Bell, X, ChevronDown } from "lucide-react";
import { NOTIFS, ACTIVITY_EVENTS } from "./mockData";

export const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

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
    primary:"bg-foreground text-primary-foreground hover:bg-[#242424] shadow-sm",
    secondary:"bg-secondary text-secondary-foreground border border-border hover:bg-accent",
    ghost:"text-muted-foreground hover:text-foreground hover:bg-accent",
    outline:"bg-card text-foreground border border-border hover:bg-secondary",
  };
  return <button className={cx(base, sizes[size], variants[variant], fullWidth&&"w-full", disabled&&"opacity-40 pointer-events-none")} onClick={onClick}>{icon}{children}</button>;
}

export function Stat({ label, value, sub, accent }: { label: string; value: string|number; sub?: string; accent?: boolean }) {
  return (
    <div className={cx("border rounded-md p-4", accent ? "bg-foreground border-foreground" : "bg-card border-border")}>
      <div className={cx("text-xs font-mono mb-1", accent ? "text-primary-foreground/70" : "text-muted-foreground")}>{label}</div>
      <div className={cx("text-2xl font-semibold tabular-nums", accent ? "text-primary-foreground" : "")}>{value}</div>
      {sub && <div className={cx("text-xs mt-0.5", accent ? "text-primary-foreground/60" : "text-muted-foreground")}>{sub}</div>}
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

export function FSelect({ label, options }: { label?: string; options: string[] }) {
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

export function Textarea({ label, placeholder, rows=3, defaultValue }: { label?: string; placeholder: string; rows?: number; defaultValue?: string }) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <textarea placeholder={placeholder} rows={rows} defaultValue={defaultValue}
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

export function ActivityFeedPanel({ onClose, permanent }: { onClose?: () => void; permanent?: boolean }) {
  return (
    <div className={cx("glass-strong border rounded-md overflow-hidden flex flex-col", permanent ? "h-full" : "w-80 h-80 shadow-xl")}>
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <div className="text-xs font-semibold">Activity</div>
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

export function TopBar({ title, sub, actions }: { title: string; sub?: string; actions?: JSX.Element }) {
  return (
    <div className="h-14 border-b glass flex items-center px-6 gap-4 shrink-0 z-20 relative">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate tracking-tight">{title}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">{actions}<BellButton/></div>
    </div>
  );
}

// Reusable frosted modal shell — overlay + glass card. Use for new
// surfaces; existing bespoke modals keep their own markup for now.
export function Modal({ onClose, maxWidth = "max-w-md", children }: { onClose: () => void; maxWidth?: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-foreground/25 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={cx("glass-strong border rounded-xl w-full shadow-2xl overflow-hidden", maxWidth)} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
