import { useState } from "react";
import { LogOut, Briefcase, Calendar, FileCheck, CreditCard, User } from "lucide-react";
import { cx, Badge, TopBar, Stat } from "../shared/ui";
import { BOOKINGS, bookingBreakdown } from "../shared/mockData";

const DEMO_MODEL_NAME = "James Whitfield";

type View = "bookings" | "availability" | "contracts" | "earnings" | "profile";

const NAV: { id: View; label: string; Icon: typeof Briefcase }[] = [
  { id:"bookings",     label:"My Bookings",   Icon:Briefcase  },
  { id:"availability", label:"Availability",  Icon:Calendar   },
  { id:"contracts",    label:"Contracts",     Icon:FileCheck  },
  { id:"earnings",     label:"Earnings",      Icon:CreditCard },
  { id:"profile",      label:"My Profile",    Icon:User       },
];

function statusBadge(status: "pending"|"processing"|"paid") {
  if (status === "paid") return <Badge label="Paid" variant="active"/>;
  if (status === "processing") return <Badge label="Processing" variant="pending"/>;
  return <Badge label="Awaiting Payment" variant="draft"/>;
}

function BookingsView() {
  const myBookings = BOOKINGS.filter(b=>b.model===DEMO_MODEL_NAME);
  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-muted-foreground mb-2">Bookings confirmed through your agency.</p>
      {myBookings.map(b=>{
        const bd = bookingBreakdown(b);
        return (
          <div key={b.id} className="glass-subtle border rounded-md p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="text-sm font-semibold">{b.campaign}</div>
                <div className="text-xs text-muted-foreground">{b.brand} · via {b.agency} · Shoot {b.shootDate}</div>
              </div>
              {statusBadge(b.paymentStatus)}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">Your earnings ({b.days} day{b.days>1?"s":""} × ${b.dayRate.toLocaleString()})</span>
              <span className="font-mono text-sm font-semibold">${bd.modelFee.toLocaleString()}</span>
            </div>
          </div>
        );
      })}
      {myBookings.length===0 && (
        <div className="flex items-center justify-center h-40 border border-dashed border-border rounded-md">
          <div className="text-sm text-muted-foreground">No bookings yet</div>
        </div>
      )}
    </div>
  );
}

function EarningsView() {
  const myBookings = BOOKINGS.filter(b=>b.model===DEMO_MODEL_NAME);
  const paid = myBookings.filter(b=>b.paymentStatus==="paid");
  const totalPaid = paid.reduce((s,b)=>s+bookingBreakdown(b).modelFee,0);
  const totalPending = myBookings.filter(b=>b.paymentStatus!=="paid").reduce((s,b)=>s+bookingBreakdown(b).modelFee,0);
  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Paid to date" value={`$${totalPaid.toLocaleString()}`} sub={`${paid.length} booking${paid.length!==1?"s":""}`}/>
        <Stat label="Awaiting payment" value={`$${totalPending.toLocaleString()}`}/>
      </div>
      <div className="space-y-2">
        {myBookings.map(b=>{
          const bd = bookingBreakdown(b);
          return (
            <div key={b.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
              <div className="flex-1"><div className="text-sm font-semibold">{b.campaign}</div><div className="text-xs text-muted-foreground">{b.shootDate}</div></div>
              <span className="font-mono text-sm">${bd.modelFee.toLocaleString()}</span>
              {statusBadge(b.paymentStatus)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ModelApp({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<View>("bookings");

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <aside className="w-52 shrink-0 glass border-r flex flex-col">
        <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-[#C9961A] to-[#9A7015] rounded-full flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">JW</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{DEMO_MODEL_NAME}</div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Model</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(item=>{
            const NavIcon = item.Icon;
            return (
              <button key={item.id} onClick={()=>setView(item.id)}
                className={cx("w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors text-left",
                  view===item.id?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}>
                <NavIcon size={15}/>{item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-border">
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-secondary">
            <LogOut size={13}/> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-h-0">
        <TopBar title={NAV.find(n=>n.id===view)?.label ?? ""} sub={`${DEMO_MODEL_NAME} · Model`}/>
        <div className="flex-1 overflow-auto p-6">
          {view === "bookings" && <BookingsView/>}
          {view === "earnings" && <EarningsView/>}
          {view !== "bookings" && view !== "earnings" && (
            <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-md">
              <div className="text-sm text-muted-foreground">{NAV.find(n=>n.id===view)?.label} · coming soon</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
