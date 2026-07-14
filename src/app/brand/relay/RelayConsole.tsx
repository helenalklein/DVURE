import { useState, useEffect } from "react";
import {
  LayoutDashboard, Radio, MapPin, Smartphone, CircleDot, Activity, BarChart2,
  Settings, ArrowLeft, Search, Wifi, WifiOff, BatteryFull, BatteryMedium, BatteryLow
} from "lucide-react";
import { cx } from "../../shared/ui";
import {
  RELAY_STATIONS, RELAY_BANDS, RELAY_DEVICES, RELAY_INITIAL_EVENTS, RELAY_SHOW,
  makeRelayEvent, type RelayEvent
} from "./relayMockData";

// Relay — full UI + state management for the runway-day operations
// console, built exactly as if the NFC/QR bands and scanning hardware
// already exist. No device/backend logic here by design: every table
// and every "live" update below is driven by mock data and a timer.

type RelayPage = "dashboard" | "live-events" | "stations" | "devices" | "bands" | "activity" | "analytics" | "settings";

const RELAY_NAV: { id: RelayPage; label: string; Icon: typeof LayoutDashboard }[] = [
  { id:"dashboard",   label:"Dashboard",    Icon:LayoutDashboard },
  { id:"live-events", label:"Live Events",  Icon:Radio            },
  { id:"stations",    label:"Stations",     Icon:MapPin           },
  { id:"devices",     label:"Devices",      Icon:Smartphone       },
  { id:"bands",       label:"Relay Bands",  Icon:CircleDot        },
  { id:"activity",    label:"Activity",     Icon:Activity         },
  { id:"analytics",   label:"Analytics",    Icon:BarChart2        },
  { id:"settings",    label:"Settings",     Icon:Settings         },
];

// ─── SHARED PIECES ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string|number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-md p-4">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-1">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function EventCard({ e, fresh }: { e: RelayEvent; fresh?: boolean }) {
  return (
    <div className={cx("bg-card border rounded-md p-4", fresh ? "border-white/30" : "border-border")}
      style={fresh ? { animation: "relayIn 0.4s ease-out" } : undefined}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-mono text-muted-foreground">{e.ts}</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-secondary text-muted-foreground uppercase tracking-wide">{e.station}</span>
      </div>
      <div className="text-sm font-semibold">{e.model}</div>
      <div className="text-xs text-muted-foreground font-mono mt-0.5 mb-2.5">Relay Band {e.bandId}</div>
      <div className="text-sm font-medium">{e.event}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{e.previousState} → {e.newState}</div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-2.5 mt-2.5 border-t border-border">
        <span>Operator: {e.operator}</span>
        <span>Show: {e.show}</span>
      </div>
    </div>
  );
}

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono">
      <span className={cx("w-1.5 h-1.5 rounded-full", online ? "bg-white" : "bg-muted-foreground")}/>
      {online ? "Online" : "Offline"}
    </span>
  );
}

function BatteryIcon({ pct }: { pct: number }) {
  const Icon = pct > 60 ? BatteryFull : pct > 25 ? BatteryMedium : BatteryLow;
  return <span className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums"><Icon size={13} className="text-muted-foreground"/>{pct}%</span>;
}

const th = "px-4 py-2.5 text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider whitespace-nowrap";
const td = "px-4 py-3 text-sm whitespace-nowrap";

// ─── PAGES ────────────────────────────────────────────────────────────────────

function DashboardPage({ events }: { events: RelayEvent[] }) {
  const connectedStations = RELAY_STATIONS.filter(s=>s.online).length;
  const activeBands = RELAY_BANDS.filter(b=>b.status==="Assigned").length;
  const offlineDevices = RELAY_DEVICES.filter(d=>d.status==="Offline").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Active Shows" value={1} sub={RELAY_SHOW}/>
        <MetricCard label="Connected Stations" value={`${connectedStations}/${RELAY_STATIONS.length}`}/>
        <MetricCard label="Active Relay Bands" value={activeBands}/>
        <MetricCard label="Events Today" value={events.length}/>
        <MetricCard label="Avg. Event Latency" value="1.4s"/>
        <MetricCard label="Offline Devices" value={offlineDevices}/>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white" style={{ animation:"relayPulse 2s ease-in-out infinite" }}/>
            Live Event Feed
          </h2>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {events.slice(0,8).map((e,i)=><EventCard key={e.id} e={e} fresh={i===0}/>)}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Stations</h2>
        <StationsTable/>
      </div>
    </div>
  );
}

function LiveEventsPage({ events }: { events: RelayEvent[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-white" style={{ animation:"relayPulse 2s ease-in-out infinite" }}/>
        <p className="text-sm text-muted-foreground">Streaming live — a new event lands every few seconds as bands are scanned through the show.</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {events.map((e,i)=><EventCard key={e.id} e={e} fresh={i===0}/>)}
      </div>
    </div>
  );
}

function StationsTable() {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-secondary/40">
          {["Station Name","Department","Current Model","Status","Last Event","Events Today","Online"].map(h=><th key={h} className={th}>{h}</th>)}
        </tr></thead>
        <tbody>
          {RELAY_STATIONS.map(s=>(
            <tr key={s.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
              <td className={cx(td,"font-medium")}>{s.name}</td>
              <td className={cx(td,"text-muted-foreground")}>{s.department}</td>
              <td className={cx(td,"text-muted-foreground")}>{s.currentModel ?? "—"}</td>
              <td className={td}><span className={cx("text-[10px] font-mono px-1.5 py-0.5 rounded-sm uppercase tracking-wide", s.status==="Occupied"?"bg-white text-black":"bg-secondary text-muted-foreground")}>{s.status}</span></td>
              <td className={cx(td,"text-muted-foreground font-mono")}>{s.lastEvent}</td>
              <td className={cx(td,"text-muted-foreground font-mono")}>{s.eventsToday} Events</td>
              <td className={td}><OnlineDot online={s.online}/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BandsTable() {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-secondary/40">
          {["Relay Band ID","Assigned Model","Status","Current Show","Battery","Last Seen"].map(h=><th key={h} className={th}>{h}</th>)}
        </tr></thead>
        <tbody>
          {RELAY_BANDS.map(b=>(
            <tr key={b.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
              <td className={cx(td,"font-mono font-medium")}>{b.id}</td>
              <td className={cx(td,"text-muted-foreground")}>{b.assignedModel ?? "—"}</td>
              <td className={td}><span className={cx("text-[10px] font-mono px-1.5 py-0.5 rounded-sm uppercase tracking-wide", b.status==="Assigned"?"bg-white text-black":"bg-secondary text-muted-foreground")}>{b.status}</span></td>
              <td className={cx(td,"text-muted-foreground")}>{b.currentShow ?? "—"}</td>
              <td className={td}><BatteryIcon pct={b.battery}/></td>
              <td className={cx(td,"text-muted-foreground font-mono")}>{b.lastSeen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DevicesTable() {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-secondary/40">
          {["Device","Type","Status","Current Station","Software Version","Last Sync"].map(h=><th key={h} className={th}>{h}</th>)}
        </tr></thead>
        <tbody>
          {RELAY_DEVICES.map(d=>(
            <tr key={d.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
              <td className={cx(td,"font-medium")}>{d.name}</td>
              <td className={cx(td,"text-muted-foreground")}>{d.type}</td>
              <td className={td}>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono">
                  {d.status==="Online" ? <Wifi size={13} className="text-white"/> : <WifiOff size={13} className="text-muted-foreground"/>}
                  {d.status}
                </span>
              </td>
              <td className={cx(td,"text-muted-foreground")}>{d.currentStation ?? "—"}</td>
              <td className={cx(td,"text-muted-foreground font-mono")}>{d.softwareVersion}</td>
              <td className={cx(td,"text-muted-foreground font-mono")}>{d.lastSync}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityPage({ events }: { events: RelayEvent[] }) {
  const [q, setQ] = useState("");
  const filtered = events.filter(e => !q.trim() || e.model.toLowerCase().includes(q.toLowerCase()) || e.event.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="flex items-center border border-border rounded-md bg-card px-3 gap-2 h-9 w-72 mb-4">
        <Search size={13} className="text-muted-foreground"/>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by model or event…"
          className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"/>
      </div>
      <div className="bg-card border border-border rounded-md overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-secondary/40">
            {["Timestamp","Model","Relay Band","Station","Event","Transition","Operator","Show"].map(h=><th key={h} className={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(e=>(
              <tr key={e.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                <td className={cx(td,"font-mono text-muted-foreground")}>{e.ts}</td>
                <td className={cx(td,"font-medium")}>{e.model}</td>
                <td className={cx(td,"font-mono text-muted-foreground")}>{e.bandId}</td>
                <td className={cx(td,"text-muted-foreground")}>{e.station}</td>
                <td className={td}>{e.event}</td>
                <td className={cx(td,"text-muted-foreground")}>{e.previousState} → {e.newState}</td>
                <td className={cx(td,"text-muted-foreground")}>{e.operator}</td>
                <td className={cx(td,"text-muted-foreground")}>{e.show}</td>
              </tr>
            ))}
            {filtered.length===0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No events match "{q}"</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 text-xs text-muted-foreground truncate">{label}</div>
      <div className="flex-1 h-5 bg-secondary rounded-sm overflow-hidden">
        <div className="h-full bg-white/80 rounded-sm" style={{ width:`${Math.max(4,(value/max)*100)}%` }}/>
      </div>
      <div className="w-10 shrink-0 text-xs font-mono text-right tabular-nums">{value}</div>
    </div>
  );
}

function AnalyticsPage() {
  const maxStation = Math.max(...RELAY_STATIONS.map(s=>s.eventsToday));
  const hourly = [4,7,9,14,18,22,26,19,15,10,6,3];
  const latencyTrend = [1.8,1.6,1.5,1.3,1.4,1.2,1.1,1.3,1.4,1.2,1.0,1.4];
  const maxLatency = Math.max(...latencyTrend);
  const points = latencyTrend.map((v,i)=>`${(i/(latencyTrend.length-1))*100},${100-(v/maxLatency)*90}`).join(" ");

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-card border border-border rounded-md p-5 col-span-2">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Events by Station</div>
        <div className="space-y-2.5">
          {RELAY_STATIONS.map(s=><HBar key={s.id} label={s.name} value={s.eventsToday} max={maxStation}/>)}
        </div>
      </div>
      <div className="bg-card border border-border rounded-md p-5">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Events by Hour</div>
        <div className="flex items-end gap-1.5 h-32">
          {hourly.map((v,i)=>(
            <div key={i} className="flex-1 bg-white/80 rounded-t-sm" style={{ height:`${(v/Math.max(...hourly))*100}%` }} title={`${v} events`}/>
          ))}
        </div>
        <div className="text-[9px] font-mono text-muted-foreground mt-2 flex justify-between"><span>8AM</span><span>2PM</span><span>8PM</span></div>
      </div>
      <div className="bg-card border border-border rounded-md p-5">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Latency Trend</div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-32">
          <polyline points={points} fill="none" stroke="white" strokeOpacity="0.8" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
        </svg>
        <div className="text-[9px] font-mono text-muted-foreground mt-2">Average 1.4s over the last 12 hours</div>
      </div>
    </div>
  );
}

function RelayToggle({ label, sub, active, onClick }: { label: string; sub?: string; active: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between bg-card border border-border rounded-md px-4 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      <button onClick={onClick} className={cx("w-9 h-5 rounded-full relative transition-colors cursor-pointer shrink-0", active?"bg-white":"bg-secondary")}>
        <span className={cx("absolute top-0.5 w-4 h-4 rounded-full transition-all", active?"right-0.5 bg-black":"left-0.5 bg-muted-foreground")}/>
      </button>
    </div>
  );
}

function SettingsPage() {
  const [notifyHair, setNotifyHair] = useState(true);
  const [notifyWardrobe, setNotifyWardrobe] = useState(true);
  const [notifyWalking, setNotifyWalking] = useState(false);
  const [autoAssign, setAutoAssign] = useState(true);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Notifications</div>
        <div className="space-y-2">
          <RelayToggle label="Hair Completed" sub="Notify when a model finishes hair" active={notifyHair} onClick={()=>setNotifyHair(p=>!p)}/>
          <RelayToggle label="Wardrobe Completed" sub="Notify when a model finishes wardrobe" active={notifyWardrobe} onClick={()=>setNotifyWardrobe(p=>!p)}/>
          <RelayToggle label="Walking" sub="Notify when a model enters the runway" active={notifyWalking} onClick={()=>setNotifyWalking(p=>!p)}/>
        </div>
      </div>
      <div>
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Stations</div>
        <RelayToggle label="Auto-assign next station" sub="Move a model to the next available station automatically after check-in" active={autoAssign} onClick={()=>setAutoAssign(p=>!p)}/>
      </div>
      <div>
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Relay Bands</div>
        <div className="bg-card border border-border rounded-md px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Low battery alert threshold</div>
            <div className="text-xs text-muted-foreground mt-0.5">Flag a band when its charge drops below this level</div>
          </div>
          <select defaultValue="20" className="bg-secondary border border-border rounded-md px-2.5 py-1.5 text-xs font-mono focus:outline-none">
            <option value="10">10%</option>
            <option value="15">15%</option>
            <option value="20">20%</option>
            <option value="30">30%</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── SHELL ────────────────────────────────────────────────────────────────────

function RelaySidebar({ page, setPage, onExit }: { page: RelayPage; setPage: (p: RelayPage) => void; onExit: () => void }) {
  return (
    <aside className="w-56 shrink-0 bg-card border-r border-border flex flex-col h-full">
      <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
        <div className="w-7 h-7 bg-white rounded-sm flex items-center justify-center shrink-0">
          <span className="text-black text-xs font-bold">R</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">Relay</div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Runway Relay</div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {RELAY_NAV.map(item=>{
          const NavIcon = item.Icon;
          return (
            <button key={item.id} onClick={()=>setPage(item.id)}
              className={cx("w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left cursor-pointer",
                page===item.id?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}>
              <NavIcon size={15}/>{item.label}
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-3 border-t border-border">
        <button onClick={onExit} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-secondary transition-colors">
          <ArrowLeft size={13}/> Exit Relay
        </button>
      </div>
    </aside>
  );
}

export default function RelayConsole({ onExit }: { onExit: () => void }) {
  const [page, setPage] = useState<RelayPage>("dashboard");
  const [events, setEvents] = useState<RelayEvent[]>([...RELAY_INITIAL_EVENTS].reverse());

  useEffect(() => {
    const interval = setInterval(() => {
      setEvents(prev => [makeRelayEvent(), ...prev].slice(0, 50));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dark h-screen flex bg-background text-foreground overflow-hidden">
      <RelaySidebar page={page} setPage={setPage} onExit={onExit}/>
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="h-14 border-b border-border flex items-center px-6 gap-3 shrink-0">
          <div className="text-sm font-semibold">{RELAY_NAV.find(n=>n.id===page)?.label}</div>
          <div className="text-xs text-muted-foreground font-mono">· {RELAY_SHOW}</div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {page==="dashboard"   && <DashboardPage events={events}/>}
          {page==="live-events" && <LiveEventsPage events={events}/>}
          {page==="stations"    && <StationsTable/>}
          {page==="devices"     && <DevicesTable/>}
          {page==="bands"       && <BandsTable/>}
          {page==="activity"    && <ActivityPage events={events}/>}
          {page==="analytics"   && <AnalyticsPage/>}
          {page==="settings"    && <SettingsPage/>}
        </div>
      </main>
    </div>
  );
}
