import { useRef, useState } from "react";
import { Check, Pin, RotateCw, Mail, Phone, Globe, Star } from "lucide-react";
import { cx, XBox, Badge, CountryFlag } from "./ui";
import type { Talent } from "./types";

// Small deterministic color tile for an agency name, sized for the
// comp-card's mother-agency line — same hash-based approach as
// AgencyApp's BrandLogoBadge, just compact enough to sit inline next
// to text instead of filling a whole card face.
const SEX_LABEL: Record<string, string> = { male: "Male", female: "Female", non_binary: "Non-binary", other: "Other" };
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

// The physical pin holding the card to the board — rendered outside
// the flipping inner element so it stays put (and doesn't itself do a
// weird 3D spin) whichever face is showing.
function Pushpin({ offset }: { offset: number }) {
  return (
    <div className="absolute -top-1.5 z-10 w-2.5 h-2.5 rounded-full pointer-events-none"
      style={{
        left: `calc(50% + ${offset}px)`,
        background: "radial-gradient(circle at 35% 30%, #e8503a, #8f2a1c 70%)",
        boxShadow: "0 1.5px 2px rgba(0,0,0,0.35)",
      }}/>
  );
}

// A model's digital comp card — headshot, name, physical stats and
// mother agency on the front; clicking anywhere on the card flips it
// via a real 3D transform (perspective + backface-visibility) to show
// measurements, full representation, and contact info. Used both for a
// model's own "My Profile" view and the drag/drop pipeline boards
// (BrandApp's Moodboard) — operationally-dense props below are silent
// no-ops for the simpler single-model consumer.
export function CompCard({
  talent: t, onViewAgency, onCommentClick, onNoteClick, onExpand, draggable, onDragStart, onDragEnd, selected, dragging,
  actions, duplicateBadge, commentCount, boutiqueAgencies, rate, score, rotate,
  location, exp, statusBanner, flipped: flippedProp, onFlippedChange,
}: {
  talent: Talent;
  onViewAgency?: (agency: string) => void;
  // Fires only from the comment-count pin (stopPropagation'd — doesn't
  // also flip the card). No general onClick anymore: the whole card's
  // job on click is to flip, full stop.
  onCommentClick?: () => void;
  // The corner sticker — real per-model staff note, not decoration.
  onNoteClick?: () => void;
  // Fires alongside the flip — the flip is the transition, this is
  // where the exhaustive detail (socials, agency contacts, full
  // contact info) actually lives, since a card face is too small to
  // hold all of it at a readable size.
  onExpand?: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  selected?: boolean;
  dragging?: boolean;
  actions?: { label: string; onClick: () => void }[];
  duplicateBadge?: string;
  commentCount?: number;
  // Operationally-dense fields the pipeline boards (Moodboard) want that
  // a model's own "My Profile" view (the other CompCard consumer) has
  // no use for — all optional, all silent when omitted, so this stays
  // one component instead of forking into two nearly-identical cards.
  boutiqueAgencies?: string[];
  rate?: string;
  score?: number;
  location?: string;
  exp?: string;
  // Hold column's "where's their contract at" ribbon — plain text,
  // parent decides the wording.
  statusBanner?: string;
  // Stable per-card tilt in degrees, e.g. -3..3 — the parent seeds this
  // from the talent id so it's the same every render, not re-randomized
  // on every reload. Omitted = perfectly upright (used while dragging).
  rotate?: number;
  // Optional controlled flip — Moodboard uses this so closing its
  // expanded-detail popup can flip the card back to front from outside.
  // Falls back to internal state when omitted (ModelApp's own use).
  flipped?: boolean;
  onFlippedChange?: (flipped: boolean) => void;
}) {
  const [flippedState, setFlippedState] = useState(false);
  const flipped = flippedProp !== undefined ? flippedProp : flippedState;
  function setFlipped(v: boolean) {
    onFlippedChange?.(v);
    if (flippedProp === undefined) setFlippedState(v);
  }
  const pinOffset = (t.id % 7) - 3; // -3..3px, stable per card
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Hover preview of the note's actual text — the sticker itself only
  // ever showed an "Edit note"/"Add note" action label, never the
  // content. Rendered as a sibling of the flip container (not inside
  // it) so it isn't clipped by the front face's own overflow-hidden.
  const [noteHovered, setNoteHovered] = useState(false);

  // The default browser drag-ghost is unreliable here — this card sits
  // inside a [perspective:1000px] 3D-transform context for the flip,
  // and browsers are inconsistent about snapshotting elements with
  // backface-visibility inside one (often only the <img> shows up,
  // dropping name/agency/pin). Setting an explicit drag image off the
  // outer wrapper — outside that 3D context — sidesteps it entirely.
  function handleDragStart(e: React.DragEvent) {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      e.dataTransfer.setDragImage(wrapperRef.current, e.clientX - rect.left, e.clientY - rect.top);
    }
    onDragStart?.();
  }

  return (
    <div ref={wrapperRef} className="relative aspect-[3/4] [perspective:1000px] transition-transform duration-200"
      style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined }}>
      <Pushpin offset={pinOffset}/>
      <div
        className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d]"
        style={{ transform: flipped ? "rotateY(180deg)" : undefined }}
      >
        {/* Front */}
        <div draggable={draggable}
          onDragStart={handleDragStart}
          onDragEnd={onDragEnd}
          onClick={()=>{ setFlipped(true); onExpand?.(); }}
          className={cx("absolute inset-0 [backface-visibility:hidden] glass-subtle rounded-md border overflow-hidden select-none transition-all group flex flex-col cursor-pointer",
            selected ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/40",
            dragging && "opacity-40"
          )}
          style={{ boxShadow: "0 3px 8px -2px rgba(30,28,26,0.28), 0 1px 2px rgba(30,28,26,0.16)" }}
        >
          <div className="relative flex-1 min-h-0">
            {t.photo ? (
              // draggable={false} matters here specifically — browsers make
              // <img> natively draggable regardless of the ancestor's own
              // draggable state, so without this, starting a drag on the
              // photo hands the gesture to the browser's native image-drag
              // (just the photo, no custom ghost) instead of the card's own
              // handleDragStart below — and a drag that gets hijacked this
              // way can register as a stray click afterward, flipping the
              // card mid-drag.
              <img src={t.photo} alt={t.name} draggable={false} className="w-full h-full object-cover grayscale"/>
            ) : (
              <XBox className="w-full h-full"/>
            )}
            {statusBanner && (
              <div className="absolute inset-x-0 top-0 bg-black/65 text-white text-[8px] font-mono uppercase tracking-wide text-center px-1 py-1 leading-tight">
                {statusBanner}
              </div>
            )}
            {/* Staff note sticker — a real per-model note, not just
                decoration. Bright when a note's on file, faint until
                hovered when there isn't, so it doesn't shout "empty". */}
            {onNoteClick && (
              <button onClick={e=>{ e.stopPropagation(); onNoteClick(); }}
                onMouseEnter={()=>setNoteHovered(true)}
                onMouseLeave={()=>setNoteHovered(false)}
                title={t.note ? "Edit note" : "Add note"}
                className="absolute bottom-0 right-0 w-5 h-5 overflow-hidden">
                <div className="absolute -bottom-2.5 -right-2.5 w-5 h-5 rotate-45" style={{ background: "#d9603b" }}/>
              </button>
            )}
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
              <button onClick={e=>{ e.stopPropagation(); onCommentClick?.(); }}
                className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 text-[9px] font-mono text-white bg-black/50 hover:bg-black/70 rounded-full px-1.5 py-0.5 transition-colors cursor-pointer">
                <Pin size={8}/> {commentCount}
              </button>
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
            {t.motherAgency ? (
              <div className="flex items-center gap-1 mt-1 min-w-0">
                <AgencyMonogram name={t.motherAgency} className="w-3.5 h-3.5 text-[6px]"/>
                {onViewAgency ? (
                  <button onClick={e=>{ e.stopPropagation(); onViewAgency(t.motherAgency); }}
                    className="text-[10px] text-muted-foreground truncate hover:text-foreground hover:underline underline-offset-2 cursor-pointer">{t.motherAgency}</button>
                ) : (
                  <span className="text-[10px] text-muted-foreground truncate">{t.motherAgency}</span>
                )}
              </div>
            ) : boutiqueAgencies !== undefined ? (
              <div className="text-[9px] text-muted-foreground truncate mt-1">Independent — no agency</div>
            ) : null}
            {boutiqueAgencies !== undefined && (
              <div className="text-[9px] text-muted-foreground truncate">
                {boutiqueAgencies.length > 0 ? `+ ${boutiqueAgencies.join(", ")}` : " "}
              </div>
            )}
            {(rate !== undefined || score !== undefined) && (
              <div className="flex items-center justify-between mt-1">
                <div className="text-[9px] font-mono font-medium">{rate}</div>
                {score !== undefined && (
                  <div className="flex items-center gap-0.5">
                    {[0,1,2,3,4].map(i=><Star key={i} size={7} className={i<score?"fill-foreground text-foreground":"text-muted-foreground"}/>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Back */}
        <div onClick={()=>setFlipped(false)}
          className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] glass-subtle rounded-md border border-border overflow-hidden flex flex-col p-2 cursor-pointer"
          style={{ boxShadow: "0 3px 8px -2px rgba(30,28,26,0.28), 0 1px 2px rgba(30,28,26,0.16)" }}>
          <div className="flex items-center justify-between shrink-0 mb-1.5">
            <div className="text-[10px] font-semibold truncate">{t.name}</div>
            <button onClick={e=>{ e.stopPropagation(); setFlipped(false); }} title="Flip back"
              className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center hover:bg-muted shrink-0">
              <RotateCw size={10}/>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 shrink-0">
            {[0,1,2,3].map(i=><XBox key={i} className="aspect-square rounded-sm"/>)}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 shrink-0" onClick={e=>e.stopPropagation()}>
            {[["Height",t.height],["Bust",t.bust],["Waist",t.waist],["Dress",t.dress],["Sex",SEX_LABEL[t.sex ?? ""]]].filter(([,v])=>v).map(([k,v])=>(
              <div key={k} className="text-[8px] leading-tight">
                <span className="text-muted-foreground">{k}</span> <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-border space-y-0.5 min-w-0" onClick={e=>e.stopPropagation()}>
            {t.motherAgency && (
              <div className="text-[9px] truncate">
                <span className="text-muted-foreground">Mother: </span>
                {onViewAgency ? (
                  <button onClick={()=>onViewAgency(t.motherAgency)} className="font-medium hover:underline underline-offset-2 cursor-pointer">{t.motherAgency}</button>
                ) : <span className="font-medium">{t.motherAgency}</span>}
              </div>
            )}
            {!!boutiqueAgencies?.length && (
              <div className="text-[9px] truncate">
                <span className="text-muted-foreground">Boutique: </span>
                <span className="font-medium">{boutiqueAgencies.join(", ")}</span>
              </div>
            )}
            {(location ?? t.location) && (
              <div className="text-[9px] truncate"><span className="text-muted-foreground">Based: </span><span className="font-medium">{location ?? t.location}</span></div>
            )}
            {(exp ?? t.exp) && (
              <div className="text-[9px] truncate"><span className="text-muted-foreground">Exp: </span><span className="font-medium">{exp ?? t.exp}</span></div>
            )}
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-border space-y-1 min-w-0 overflow-hidden">
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
      {/* Note preview — a sibling of the flip container (not inside
          it), same reason Pushpin lives out here: the front face has
          overflow-hidden for its own rounded corners/photo crop, which
          would clip a popover trying to escape past the card's edge. */}
      {noteHovered && t.note && !flipped && (
        <div className="absolute bottom-6 right-0 z-20 w-40 pointer-events-none rounded-md border shadow-lg px-2.5 py-2 text-[10px] leading-snug whitespace-pre-wrap break-words"
          style={{ background: "#fdf1de", borderColor: "#d9603b", color: "#3d2c1f" }}>
          {t.note}
        </div>
      )}
    </div>
  );
}
