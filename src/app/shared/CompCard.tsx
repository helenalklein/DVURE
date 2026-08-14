import { useState } from "react";
import { Check, Pin, RotateCw, Mail, Phone, Globe } from "lucide-react";
import { cx, XBox, Badge, CountryFlag } from "./ui";
import type { Talent } from "./types";

// Small deterministic color tile for an agency name, sized for the
// comp-card's mother-agency line — same hash-based approach as
// AgencyApp's BrandLogoBadge, just compact enough to sit inline next
// to text instead of filling a whole card face.
const MONOGRAM_COLORS = ["#1E1C1A", "#3D3A35", "#5B5650", "#2A2E35", "#33241F"];
function monogramColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return MONOGRAM_COLORS[hash % MONOGRAM_COLORS.length];
}
function AgencyMonogram({ name, className = "" }: { name: string; className?: string }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div className={cx("rounded-sm flex items-center justify-center shrink-0 text-white font-semibold leading-none", className)}
      style={{ background: monogramColor(name || "?") }}>
      {initials}
    </div>
  );
}

// A model's digital comp card — headshot, name, physical stats and
// mother agency on the front; hover reveals a flip control that turns
// the card over via a real 3D transform (perspective + backface-
// visibility) to show contact info and four portfolio-photo slots
// (placeholders — no second photo source exists anywhere in this app
// yet). Used both for a model's own "My Profile" view and anywhere a
// single model needs the same compact visual treatment; the drag/
// select/stage-action-heavy submissions boards (BrandApp's Moodboard,
// AgencyApp's roster/submit lists) keep their own richer cards — this
// is deliberately the simpler, single-model view, not a replacement
// for those.
export function CompCard({
  talent: t, onViewAgency, onClick, draggable, onDragStart, onDragEnd, selected, dragging,
  actions, duplicateBadge, commentCount,
}: {
  talent: Talent;
  onViewAgency?: (agency: string) => void;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  selected?: boolean;
  dragging?: boolean;
  actions?: { label: string; onClick: () => void }[];
  duplicateBadge?: string;
  commentCount?: number;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="aspect-[3/4] [perspective:1000px]">
      <div
        className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d]"
        style={{ transform: flipped ? "rotateY(180deg)" : undefined }}
      >
        {/* Front */}
        <div draggable={draggable}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onClick={onClick}
          className={cx("absolute inset-0 [backface-visibility:hidden] glass-subtle rounded-md border overflow-hidden select-none transition-all group flex flex-col",
            onClick && "cursor-pointer",
            selected ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/40",
            dragging && "opacity-40"
          )}
        >
          <div className="relative flex-1 min-h-0">
            {t.photo ? (
              <img src={t.photo} alt={t.name} className="w-full h-full object-cover"/>
            ) : (
              <XBox className="w-full h-full"/>
            )}
            <button onClick={e=>{e.stopPropagation(); setFlipped(true);}}
              title="Flip card"
              className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-card/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-card">
              <RotateCw size={10}/>
            </button>
            {selected !== undefined && (
              <div className={cx("absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", selected ? "bg-foreground border-foreground" : "bg-card/80 border-border")}>
                {selected && <Check size={11} className="text-primary-foreground"/>}
              </div>
            )}
            {duplicateBadge && (
              <div className="absolute top-8 left-1.5">
                <Badge label={duplicateBadge} variant="warning"/>
              </div>
            )}
            {!!commentCount && (
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 text-[9px] font-mono text-white bg-black/50 rounded-full px-1.5 py-0.5">
                <Pin size={8}/> {commentCount}
              </div>
            )}
            {actions && actions.length > 0 && (
              <div className="absolute inset-x-0 bottom-0 flex divide-x divide-white/20 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm" onClick={e=>e.stopPropagation()}>
                {actions.map(a=>(
                  <button key={a.label} onClick={a.onClick}
                    className="flex-1 py-1.5 text-[10px] font-medium text-white hover:bg-white/10 transition-colors">{a.label}</button>
                ))}
              </div>
            )}
          </div>
          <div className="p-1.5 shrink-0">
            <div className="text-xs font-semibold leading-tight truncate flex items-center gap-1">
              {t.name} <CountryFlag location={t.location} className="text-[11px] shrink-0"/>
            </div>
            <div className="text-[9px] text-muted-foreground font-mono truncate">
              {[t.height, t.dress].filter(Boolean).join(" · ") || "—"}
            </div>
            {t.motherAgency && (
              <div className="flex items-center gap-1 mt-1 min-w-0">
                <AgencyMonogram name={t.motherAgency} className="w-3.5 h-3.5 text-[6px]"/>
                {onViewAgency ? (
                  <button onClick={e=>{ e.stopPropagation(); onViewAgency(t.motherAgency); }}
                    className="text-[10px] text-muted-foreground truncate hover:text-foreground hover:underline underline-offset-2 cursor-pointer">{t.motherAgency}</button>
                ) : (
                  <span className="text-[10px] text-muted-foreground truncate">{t.motherAgency}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] glass-subtle rounded-md border border-border overflow-hidden flex flex-col p-2"
          onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between shrink-0 mb-1.5">
            <div className="text-[10px] font-semibold truncate">{t.name}</div>
            <button onClick={()=>setFlipped(false)} title="Flip back"
              className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center hover:bg-muted shrink-0">
              <RotateCw size={10}/>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 shrink-0">
            {[0,1,2,3].map(i=><XBox key={i} className="aspect-square rounded-sm"/>)}
          </div>
          <div className="mt-1.5 space-y-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground truncate">
              <Mail size={9} className="shrink-0"/> {t.modelEmail || "Not set"}
            </div>
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground truncate">
              <Phone size={9} className="shrink-0"/> Not set
            </div>
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground truncate">
              <Globe size={9} className="shrink-0"/> Not set
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
