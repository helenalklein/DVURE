import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "../shared/ui";
import type { Campaign } from "../shared/types";

interface CalEvent {
  date: Date;
  campaignId: number;
  campaignName: string;
  kind: "due" | "open" | "close";
}

const KIND_DOT: Record<CalEvent["kind"], string> = { due: "bg-foreground", open: "bg-muted-foreground/50", close: "bg-muted-foreground" };

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function extractEvents(campaigns: Campaign[]): CalEvent[] {
  const events: CalEvent[] = [];
  for (const c of campaigns) {
    if (c.dueDateISO) {
      const d = new Date(`${c.dueDateISO}T00:00:00`);
      if (!isNaN(d.getTime())) events.push({ date: d, campaignId: c.id, campaignName: c.name, kind: "due" });
    }
    const open = new Date(c.submissionOpen);
    if (!isNaN(open.getTime())) events.push({ date: open, campaignId: c.id, campaignName: c.name, kind: "open" });
    const close = new Date(c.submissionClose);
    if (!isNaN(close.getTime())) events.push({ date: close, campaignId: c.id, campaignName: c.name, kind: "close" });
  }
  return events;
}

export default function CampaignCalendar({ campaigns, openCampaign }: { campaigns: Campaign[]; openCampaign: (id: number) => void }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const events = useMemo(() => extractEvents(campaigns), [campaigns]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), inMonth: true });
  while (cells.length % 7 !== 0 || cells.length < 42) cells.push({ date: new Date(year, month + 1, cells.length - startWeekday - daysInMonth + 1), inMonth: false });

  const today = new Date();
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="text-heading text-lg">{monthLabel}</div>
        <div className="flex items-center gap-1">
          <button onClick={()=>setCursor(new Date(year, month-1, 1))} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <ChevronLeft size={15}/>
          </button>
          <button onClick={()=>setCursor(new Date())} className="px-3 py-1.5 text-xs rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            Today
          </button>
          <button onClick={()=>setCursor(new Date(year, month+1, 1))} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <ChevronRight size={15}/>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-foreground"/> Due</div>
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground"/> Submissions close</div>
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"/> Submissions open</div>
      </div>

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
                {dayEvents.slice(0, 3).map((e, j) => (
                  <button key={j} onClick={()=>openCampaign(e.campaignId)}
                    className="w-full flex items-center gap-1 text-left text-[10px] leading-tight px-1 py-0.5 rounded-sm hover:bg-secondary cursor-pointer transition-colors truncate">
                    <span className={cx("w-1.5 h-1.5 rounded-full shrink-0", KIND_DOT[e.kind])}/>
                    <span className="truncate">{e.campaignName}</span>
                  </button>
                ))}
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
