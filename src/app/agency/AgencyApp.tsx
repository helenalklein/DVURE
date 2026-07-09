import { useState } from "react";
import { LogOut, Plus, Send, MessageSquare, Inbox, Users2, CreditCard, X } from "lucide-react";
import { cx, XBox, Badge, Btn, Stat, TopBar, TextInput, FSelect, Textarea } from "../shared/ui";
import { BOOKINGS, bookingBreakdown, SAMPLE_TALENT } from "../shared/mockData";

const AGENCY_NAME = "Elite Model Mgmt.";

type View = "invitations" | "submit" | "roster" | "payments" | "messaging";

const NAV: { id: View; label: string; Icon: typeof Inbox; count?: number }[] = [
  { id:"invitations", label:"Campaign Invitations", Icon:Inbox,         count:3 },
  { id:"submit",       label:"Talent Submissions",   Icon:Send                  },
  { id:"roster",       label:"Talent Roster",        Icon:Users2                },
  { id:"payments",     label:"Payments",             Icon:CreditCard            },
  { id:"messaging",    label:"Messaging",            Icon:MessageSquare, count:1 },
];

const INVITATIONS = [
  { brand:"Acne Studios", campaign:"AW25 Womenswear Campaign", type:"Editorial", due:"06/20/2025", budget:"$800–$1,200/day", models:3 },
  { brand:"Nike",         campaign:"Run Global SS25",          type:"Fitness",   due:"07/01/2025", budget:"$600–$900/day",   models:5 },
  { brand:"Chanel",       campaign:"Beauty Editorial AW25",    type:"Beauty",    due:"06/28/2025", budget:"$1,200–$2,000/day", models:2 },
];

function InvitationsView({ onSubmitTalent }: { onSubmitTalent: () => void }) {
  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-muted-foreground mb-4">Brand campaign invitations requiring talent submissions.</p>
      {INVITATIONS.map(inv=>(
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
            <Btn variant="primary" size="sm" onClick={onSubmitTalent}>Submit Talent</Btn>
            <Btn variant="outline" size="sm">View Brief</Btn>
            <Btn variant="ghost" size="sm">Decline</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

function SubmitTalentView() {
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const roster = SAMPLE_TALENT.filter(t=>t.agency===AGENCY_NAME);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Submit talent from your roster to open campaigns.</p>
        <Btn variant="primary" size="sm" icon={<Plus size={12}/>} onClick={()=>setShowForm(true)}>Submit Talent</Btn>
      </div>
      <div className="space-y-2">
        {roster.map(t=>(
          <div key={t.id} className="bg-card border border-border rounded-md p-4 flex items-center gap-4">
            <XBox className="w-12 h-12 rounded-md shrink-0"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.location} · {t.rate}</div>
            </div>
            <Badge label={t.stage==="submitted"?"Submitted":t.stage==="approved"?"Approved":t.stage==="booked"?"Booked":"Rejected"}
              variant={t.stage==="booked"?"active":t.stage==="approved"?"info":t.stage==="rejected"?"draft":"pending"}/>
          </div>
        ))}
        {submitted.map(name=>(
          <div key={name} className="bg-card border border-dashed border-border rounded-md p-4 flex items-center gap-4 opacity-70">
            <XBox className="w-12 h-12 rounded-md shrink-0"/>
            <div className="flex-1"><div className="text-sm font-semibold">{name}</div><div className="text-xs text-muted-foreground">Just submitted — awaiting brand review</div></div>
            <Badge label="Submitted" variant="pending"/>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="text-sm font-semibold">Submit Talent</div>
              <button onClick={()=>setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-3">
              <FSelect label="Campaign" options={INVITATIONS.map(i=>i.campaign)}/>
              <TextInput label="Model Name" placeholder="e.g. Nadia Petrov"/>
              <TextInput label="Day Rate" placeholder="e.g. $1,000/day"/>
              <Textarea label="Note to brand" placeholder="Optional — why this model fits the brief…" rows={3}/>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <Btn variant="primary" onClick={()=>{ setSubmitted(p=>[...p,"New Submission"]); setShowForm(false); }}>Submit</Btn>
              <Btn variant="outline" onClick={()=>setShowForm(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RosterView() {
  const roster = SAMPLE_TALENT.filter(t=>t.agency===AGENCY_NAME);
  return (
    <div className="max-w-2xl space-y-2">
      <p className="text-sm text-muted-foreground mb-2">Your full talent roster.</p>
      {roster.map(t=>(
        <div key={t.id} className="bg-card border border-border rounded-md p-4 flex items-center gap-4">
          <XBox className="w-12 h-12 rounded-md shrink-0"/>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{t.name}</div>
            <div className="text-xs text-muted-foreground">{t.location} · {t.height} · {t.exp} experience</div>
          </div>
          <div className="text-xs font-mono">{t.rate}</div>
        </div>
      ))}
    </div>
  );
}

function PaymentsView() {
  const [tab, setTab] = useState<"receivable"|"invoices">("receivable");
  const myBookings = BOOKINGS.filter(b=>b.agency===AGENCY_NAME);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Pending payout" value={myBookings.filter(b=>b.paymentStatus==="pending").length}/>
        <Stat label="Processing" value={myBookings.filter(b=>b.paymentStatus==="processing").length}/>
        <Stat label="Paid this month" value={myBookings.filter(b=>b.paymentStatus==="paid").length}/>
      </div>
      <div className="flex items-center gap-1 border-b border-border">
        {(["receivable","invoices"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={cx("px-4 py-2.5 text-sm capitalize border-b-2 -mb-px transition-colors",
              tab===t?"border-foreground text-foreground font-medium":"border-transparent text-muted-foreground hover:text-foreground"
            )}>{t==="receivable"?"Commission Payouts":"Invoices Sent"}</button>
        ))}
      </div>
      {tab==="receivable" && (
        <div className="space-y-2">
          {myBookings.map(b=>{
            const bd = bookingBreakdown(b);
            return (
              <div key={b.id} className="bg-card border border-border rounded-md p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{b.model}</div>
                  <div className="text-xs text-muted-foreground">{b.campaign} · {b.brand}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground font-mono">Your commission ({b.agencyPct}%)</div>
                  <div className="font-mono text-sm font-semibold">${bd.agencyFee.toLocaleString()}</div>
                </div>
                <Badge label={b.paymentStatus==="paid"?"Paid":b.paymentStatus==="processing"?"Processing":"Pending"} variant={b.paymentStatus==="paid"?"active":b.paymentStatus==="processing"?"pending":"draft"}/>
              </div>
            );
          })}
        </div>
      )}
      {tab==="invoices" && (
        <div className="space-y-2">
          {myBookings.map(b=>(
            <div key={b.id} className="bg-card border border-border rounded-md p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="text-sm font-semibold">{b.campaign}</div>
                <div className="text-xs text-muted-foreground">{b.model} · Shoot {b.shootDate}</div>
              </div>
              <Btn variant={b.paymentStatus==="pending"?"primary":"outline"} size="sm" disabled={b.paymentStatus!=="pending"}>
                {b.paymentStatus==="pending"?"Send Invoice":"Sent"}
              </Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgencyApp({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<View>("invitations");

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <aside className="w-52 shrink-0 bg-card border-r border-border flex flex-col">
        <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
          <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">E</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{AGENCY_NAME}</div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Agency</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item=>{
            const NavIcon = item.Icon;
            return (
              <button key={item.id} onClick={()=>setView(item.id)}
                className={cx("w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors text-left",
                  view===item.id?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}>
                <NavIcon size={15}/>{item.label}
                {item.count && <span className="ml-auto text-[10px] font-mono bg-foreground text-primary-foreground px-1.5 py-0.5 rounded-full">{item.count}</span>}
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
        <TopBar title={NAV.find(n=>n.id===view)?.label ?? ""} sub={`${AGENCY_NAME} · Agency`}/>
        <div className="flex-1 overflow-auto p-6">
          {view === "invitations" && <InvitationsView onSubmitTalent={()=>setView("submit")}/>}
          {view === "submit" && <SubmitTalentView/>}
          {view === "roster" && <RosterView/>}
          {view === "payments" && <PaymentsView/>}
          {view === "messaging" && (
            <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-md">
              <div className="text-sm text-muted-foreground">Messaging · shares the same thread data as Brand once Supabase lands</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
