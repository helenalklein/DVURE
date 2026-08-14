import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "./ui";

// Generic month-grid calendar — the same rendering logic BrandApp's
// CampaignCalendar already proved out, generalized to take a plain event
// list instead of being hardcoded to Campaign[]. Each role (model/agency/
// crew) derives its own CalendarEvent[] from whatever "schedule" means
// for that role — bookings' shoot dates, a full set of campaign
// invitations' due/open/close dates, crew grants' due dates — and this
// component just renders it.
export interface CalendarEvent {
  id: string | number;
  date: Date;
  title: string;
  dotClassName?: string; // Tailwind bg-* class for the event's legend dot; defaults to bg-foreground
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function EventCalendar({ events, onEventClick, legend }: {
  events: CalendarEvent[];
  onEventClick?: (id: string | number) => void;
  legend?: { label: string; dotClassName: string }[];
}) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = useMemo(() => {
    const c: { date: Date; inMonth: boolean }[] = [];
    for (let i = startWeekday - 1; i >= 0; i--) c.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) c.push({ date: new Date(year, month, d), inMonth: true });
    while (c.length % 7 !== 0 || c.length < 42) c.push({ date: new Date(year, month + 1, c.length - startWeekday - daysInMonth + 1), inMonth: false });
    return c;
  }, [year, month, startWeekday, daysInMonth, daysInPrevMonth]);

  const today = new Date();
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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

      {legend && legend.length > 0 && (
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          {legend.map(l => (
            <div key={l.label} className="flex items-center gap-1.5"><span className={cx("w-1.5 h-1.5 rounded-full", l.dotClassName)}/> {l.label}</div>
          ))}
        </div>
      )}

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
                {dayEvents.slice(0, 3).map((e) => (
                  <button key={e.id} onClick={()=>onEventClick?.(e.id)} disabled={!onEventClick}
                    className={cx("w-full flex items-center gap-1 text-left text-[10px] leading-tight px-1 py-0.5 rounded-sm truncate transition-colors",
                      onEventClick ? "hover:bg-secondary cursor-pointer" : "cursor-default")}>
                    <span className={cx("w-1.5 h-1.5 rounded-full shrink-0", e.dotClassName ?? "bg-foreground")}/>
                    <span className="truncate">{e.title}</span>
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
