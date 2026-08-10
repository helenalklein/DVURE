import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Plus, CalendarPlus } from "lucide-react";
import { cx, Modal, Btn, TextInput, FSelect } from "../shared/ui";
import type { Campaign } from "../shared/types";
import { googleCalendarUrl, downloadEventIcs, icsFeedUrls } from "../../lib/queries/calendarFeed";

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type EventKind = "shoot" | "casting";

export interface CalEvent {
  date: Date;
  campaignId: number;
  campaignName: string;
  kind: EventKind;
  label: string;
}

const KIND_LABEL: Record<EventKind, string> = { shoot: "Shoot day", casting: "Casting" };
const KIND_DOT: Record<EventKind, string> = { shoot: "bg-foreground", casting: "bg-muted-foreground" };

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

type ViewMode = "day" | "4day" | "week" | "month";

const VIEW_OPTIONS: { id: ViewMode; label: string }[] = [
  { id: "day",   label: "Day" },
  { id: "4day",  label: "4 Days" },
  { id: "week",  label: "Week" },
  { id: "month", label: "Month" },
];

function EventChip({ e, onSelect, dense }: { e: CalEvent; onSelect: (e: CalEvent) => void; dense?: boolean }) {
  return (
    <button onClick={()=>onSelect(e)}
      className={cx("w-full flex items-center gap-1.5 text-left leading-tight rounded-sm hover:bg-secondary cursor-pointer transition-colors truncate",
        dense ? "text-[10px] px-1 py-0.5" : "text-[11px] px-2 py-1.5 bg-secondary hover:bg-secondary/70")}>
      <span className={cx("w-1.5 h-1.5 rounded-full shrink-0", KIND_DOT[e.kind])}/>
      <span className="truncate">{e.label}</span>
    </button>
  );
}

function DayColumn({ date, events, onSelect, compact }: { date: Date; events: CalEvent[]; onSelect: (e: CalEvent) => void; compact?: boolean }) {
  const today = new Date();
  const isToday = sameDay(date, today);
  return (
    <div className="flex-1 min-w-0 border-r border-border last:border-r-0 flex flex-col">
      <div className={cx("px-3 py-2 border-b border-border text-center shrink-0", isToday && "bg-secondary/50")}>
        <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{date.toLocaleDateString("en-US",{weekday: compact ? "short" : "long"})}</div>
        <div className={cx("text-sm font-mono", isToday ? "font-semibold" : "text-muted-foreground")}>{date.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
      </div>
      <div className="flex-1 p-2 space-y-1 overflow-y-auto">
        {events.length===0 ? (
          <div className="text-[10px] text-muted-foreground/50 text-center pt-4">No events</div>
        ) : events.map((e,i)=><EventChip key={i} e={e} onSelect={onSelect}/>)}
      </div>
    </div>
  );
}

export default function CampaignCalendar({ campaigns, addableCampaigns, openCampaign, events, onAddEvent, feedToken, onRegenerateFeed }: {
  campaigns: Campaign[];
  addableCampaigns: Campaign[];
  openCampaign: (id: number) => void;
  events: CalEvent[];
  onAddEvent: (params: { campaignId: number; kind: EventKind; date: string; title: string }) => Promise<{ error: string | null }>;
  feedToken: string | null;
  onRegenerateFeed: () => Promise<void>;
}) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [view, setView] = useState<ViewMode>("month");
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);

  function step(dir: 1 | -1) {
    if (view === "month") setCursor(c => new Date(c.getFullYear(), c.getMonth() + dir, 1));
    else if (view === "week") setCursor(c => addDays(c, 7 * dir));
    else if (view === "4day") setCursor(c => addDays(c, 4 * dir));
    else setCursor(c => addDays(c, dir));
  }

  function goToday() {
    const d = new Date(); d.setHours(0,0,0,0); setCursor(d);
  }

  let rangeLabel: string;
  if (view === "month") {
    rangeLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } else if (view === "day") {
    rangeLabel = cursor.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } else {
    const start = view === "week" ? startOfWeek(cursor) : cursor;
    const end = addDays(start, (view === "week" ? 6 : 3));
    const sameMonth = start.getMonth() === end.getMonth();
    rangeLabel = sameMonth
      ? `${start.toLocaleDateString("en-US",{month:"long"})} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
      : `${start.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${end.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="text-heading text-lg">{rangeLabel}</div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5">
            {VIEW_OPTIONS.map(o => (
              <button key={o.id} onClick={()=>setView(o.id)}
                className={cx("px-2.5 py-1 text-xs rounded-sm transition-colors cursor-pointer",
                  view===o.id ? "bg-foreground text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={()=>step(-1)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <ChevronLeft size={15}/>
            </button>
            <button onClick={goToday} className="px-3 py-1.5 text-xs rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              Today
            </button>
            <button onClick={()=>step(1)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <ChevronRight size={15}/>
            </button>
          </div>
          <Btn variant="outline" size="sm" icon={<CalendarPlus size={13}/>} onClick={()=>setShowSubscribe(true)}>Connect</Btn>
          <Btn variant="primary" size="sm" icon={<Plus size={13}/>} onClick={()=>setShowAdd(true)} disabled={addableCampaigns.length===0}>New Event</Btn>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3 text-[11px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-foreground"/> Shoot day</div>
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground"/> Casting</div>
      </div>

      {view === "month" ? (
        <MonthGrid cursor={cursor} events={events} onSelect={setSelected}/>
      ) : (
        <div className="flex-1 min-h-0 flex border-t border-l border-border rounded-md overflow-hidden">
          {(view === "day" ? [cursor] : view === "4day" ? [0,1,2,3].map(n=>addDays(cursor,n)) : [0,1,2,3,4,5,6].map(n=>addDays(startOfWeek(cursor),n)))
            .map((date,i)=>(
              <DayColumn key={i} date={date} events={events.filter(e=>sameDay(e.date,date))} onSelect={setSelected} compact={view!=="day"}/>
            ))}
        </div>
      )}

      {selected && (
        <Modal onClose={()=>setSelected(null)} maxWidth="max-w-sm">
          <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-heading text-sm truncate">{selected.label}</div>
              <div className="text-xs font-mono text-muted-foreground mt-0.5">{selected.date.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
            </div>
            <button onClick={()=>setSelected(null)} className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"><X size={14}/></button>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cx("w-1.5 h-1.5 rounded-full shrink-0", KIND_DOT[selected.kind])}/>
              {KIND_LABEL[selected.kind]} · {selected.campaignName}
            </div>
          </div>
          <div className="px-5 pb-5 space-y-2">
            <Btn variant="primary" fullWidth onClick={()=>{ openCampaign(selected.campaignId); setSelected(null); }}>Open Campaign</Btn>
            <div className="flex gap-2">
              <Btn variant="outline" fullWidth onClick={()=>window.open(googleCalendarUrl({ title: selected.label, date: toISODate(selected.date) }), "_blank")}>Add to Google</Btn>
              <Btn variant="outline" fullWidth onClick={()=>downloadEventIcs({ title: selected.label, date: toISODate(selected.date) })}>Download .ics</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showSubscribe && (
        <SubscribeModal token={feedToken} onClose={()=>setShowSubscribe(false)} onRegenerate={onRegenerateFeed}/>
      )}

      {showAdd && (
        <AddEventModal campaigns={addableCampaigns} onClose={()=>setShowAdd(false)} onAdd={onAddEvent}/>
      )}
    </div>
  );
}

function SubscribeModal({ token, onClose, onRegenerate }: {
  token: string | null; onClose: () => void; onRegenerate: () => Promise<void>;
}) {
  const [copied, setCopied] = useState<"webcal" | "https" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const urls = token ? icsFeedUrls(token) : null;

  function copy(kind: "webcal" | "https", value: string) {
    navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    await onRegenerate();
    setRegenerating(false);
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="text-heading text-sm">Connect to Apple / Google Calendar</div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
      </div>
      <div className="p-5 space-y-4">
        <div className="text-xs text-muted-foreground">
          Add this link as a calendar connection and every shoot day and casting across your campaigns stays in sync automatically — new events show up without re-adding anything.
        </div>
        {urls ? (
          <>
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Apple Calendar / most apps</div>
              <div className="flex items-center gap-2 border border-border rounded-md bg-input-background px-3 py-2">
                <div className="flex-1 text-xs font-mono truncate">{urls.webcalUrl}</div>
                <button onClick={()=>copy("webcal", urls.webcalUrl)} className="text-xs font-medium text-foreground hover:underline cursor-pointer shrink-0">{copied==="webcal"?"Copied":"Copy"}</button>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Google Calendar ("From URL")</div>
              <div className="flex items-center gap-2 border border-border rounded-md bg-input-background px-3 py-2">
                <div className="flex-1 text-xs font-mono truncate">{urls.httpsUrl}</div>
                <button onClick={()=>copy("https", urls.httpsUrl)} className="text-xs font-medium text-foreground hover:underline cursor-pointer shrink-0">{copied==="https"?"Copied":"Copy"}</button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Google Calendar: Settings → Add calendar → From URL, paste the second link. Apple Calendar: File → New Calendar Subscription, paste either link (or just tap the first one on iPhone/Mac).
            </div>
            <button onClick={handleRegenerate} disabled={regenerating} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline">
              {regenerating ? "Regenerating…" : "Regenerate link (invalidates the current one)"}
            </button>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">Couldn't load your calendar link.</div>
        )}
      </div>
    </Modal>
  );
}

function AddEventModal({ campaigns, onClose, onAdd }: {
  campaigns: Campaign[];
  onClose: () => void;
  onAdd: (params: { campaignId: number; kind: EventKind; date: string; title: string }) => Promise<{ error: string | null }>;
}) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? 0);
  const [kind, setKind] = useState<EventKind>("shoot");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const campaignOptions = campaigns.map(c => c.name);

  async function handleSubmit() {
    if (!date) return;
    setSaving(true);
    setError(null);
    const { error: err } = await onAdd({ campaignId, kind, date, title });
    setSaving(false);
    if (err) { setError(err); return; }
    onClose();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="text-heading text-sm">New Event</div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
      </div>
      <div className="p-5 space-y-3">
        <FSelect label="Campaign" options={campaignOptions}
          value={campaigns.find(c=>c.id===campaignId)?.name}
          onChange={(v)=>{ const c = campaigns.find(c=>c.name===v); if (c) setCampaignId(c.id); }}/>
        <FSelect label="Type" options={["Shoot day","Casting"]} value={kind==="shoot"?"Shoot day":"Casting"}
          onChange={(v)=>setKind(v==="Casting"?"casting":"shoot")}/>
        <TextInput type="date" label="Date" placeholder="Date" value={date} onChange={e=>setDate(e.target.value)}/>
        <TextInput label="Title" placeholder={kind==="shoot" ? "e.g. Hero shots — Studio 9" : "e.g. First round fittings"} value={title} onChange={e=>setTitle(e.target.value)}/>
        {error && <div className="text-xs text-red-500">{error}</div>}
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <Btn variant="primary" disabled={!date || saving} onClick={handleSubmit}>{saving ? "Adding…" : "Add Event"}</Btn>
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}

function MonthGrid({ cursor, events, onSelect }: { cursor: Date; events: CalEvent[]; onSelect: (e: CalEvent) => void }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), inMonth: true });
  while (cells.length % 7 !== 0 || cells.length < 42) cells.push({ date: new Date(year, month + 1, cells.length - startWeekday - daysInMonth + 1), inMonth: false });

  const today = new Date();

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="grid grid-cols-7 border-t border-l border-border">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} className="border-r border-b border-border px-2 py-1.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground bg-secondary/40">{d}</div>
        ))}
        {cells.map(({ date, inMonth }, i) => {
          const dayEvents = events.filter(e => sameDay(e.date, date));
          const isToday = sameDay(date, today);
          return (
            <div key={i} className={cx("border-r border-b border-border min-h-[92px] p-1.5", !inMonth && "bg-secondary/20")}>
              <div className={cx("text-[11px] font-mono mb-1 inline-flex items-center justify-center",
                isToday ? "w-5 h-5 rounded-full bg-foreground text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/50")}>
                {date.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e, j) => <EventChip key={j} e={e} onSelect={onSelect} dense/>)}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
