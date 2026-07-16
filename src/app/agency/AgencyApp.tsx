import { useState, useMemo } from "react";
import { LogOut, Plus, Send, MessageSquare, Inbox, Users2, CreditCard, X, UserPlus, Search, ChevronRight } from "lucide-react";
import { cx, XBox, Badge, Btn, Stat, TopBar, TextInput, FSelect, Textarea, FieldLabel, Modal, CurrentUserProvider } from "../shared/ui";
import { BOOKINGS, bookingBreakdown, SAMPLE_TALENT } from "../shared/mockData";
import type { RosterModel } from "../shared/types";

const AGENCY_NAME = "Elite Model Mgmt.";

// Seed roster from the existing mock talent — in Milestone B this becomes
// a real `talent_profiles` query scoped to the agency's org.
const INITIAL_ROSTER: RosterModel[] = SAMPLE_TALENT
  .filter(t=>t.agency===AGENCY_NAME)
  .map(t=>({ id:t.id, name:t.name, email:`${t.name.toLowerCase().replace(/\s+/g,".")}@models.example`, agency:AGENCY_NAME, location:t.location, rate:t.rate, height:t.height, exp:t.exp }));

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
        <div key={inv.campaign} className="glass-subtle border rounded-md p-4">
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

// Visual, alphabetically-indexed model picker — a card board, not a
// dropdown. This industry casts off photos and physical presence, not
// text lists, so selection should feel like flipping through a board.
function RosterPickerModal({ roster, onPick, onClose }: { roster: RosterModel[]; onPick: (id: number) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const filtered = roster
      .filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a,b) => a.name.localeCompare(b.name));
    const byLetter = new Map<string, RosterModel[]>();
    for (const m of filtered) {
      const letter = m.name.trim()[0]?.toUpperCase() ?? "#";
      if (!byLetter.has(letter)) byLetter.set(letter, []);
      byLetter.get(letter)!.push(m);
    }
    return [...byLetter.entries()].sort(([a],[b]) => a.localeCompare(b));
  }, [roster, search]);

  const letters = groups.map(([l]) => l);

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <div className="text-sm font-semibold">Choose a Model</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">From your roster, A–Z</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
      </div>
      <div className="px-6 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <div className="flex-1 flex items-center border border-border rounded-md bg-input-background px-3 gap-2 h-9">
          <Search size={13} className="text-muted-foreground"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search roster…"
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"/>
        </div>
        {letters.length>0 && (
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-muted-foreground shrink-0">
            {letters.map(l=><span key={l} className="w-4 text-center">{l}</span>)}
          </div>
        )}
      </div>
      <div className="max-h-[26rem] overflow-y-auto px-6 py-4 space-y-6">
        {groups.length===0 && <div className="text-center text-sm text-muted-foreground py-10">No models match "{search}"</div>}
        {groups.map(([letter, models]) => (
          <div key={letter}>
            <div className="text-xs font-display italic text-muted-foreground mb-2 sticky -top-4 bg-transparent">{letter}</div>
            <div className="grid grid-cols-3 gap-3">
              {models.map(m=>(
                <button key={m.id} onClick={()=>onPick(m.id)}
                  className="text-left glass-subtle border rounded-md overflow-hidden hover:border-foreground hover:shadow-md transition-all group">
                  <XBox className="w-full h-24"/>
                  <div className="p-2.5 space-y-0.5">
                    <div className="text-xs font-semibold truncate">{m.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{m.location}</div>
                    <div className="text-[10px] font-mono font-medium mt-1">{m.rate}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function SubmitTalentView({ roster, onGoToRoster }: { roster: RosterModel[]; onGoToRoster: () => void }) {
  const [submitted, setSubmitted] = useState<{ modelId: number; campaign: string }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [pickedCampaign, setPickedCampaign] = useState(INVITATIONS[0]?.campaign ?? "");
  const [pickedModelId, setPickedModelId] = useState<number | "">("");

  const submittedIds = new Set(submitted.map(s=>s.modelId));
  const pickedModel = roster.find(m=>m.id===pickedModelId);

  function selectModel(id: number) {
    setPickedModelId(id);
    setPickedCampaign(INVITATIONS[0]?.campaign ?? "");
    setShowPicker(false);
    setShowForm(true);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Submit models from your roster to open campaigns.</p>
        <Btn variant="primary" size="sm" icon={<Plus size={12}/>} onClick={()=>setShowPicker(true)} disabled={roster.length===0}>Submit Talent</Btn>
      </div>

      {roster.length===0 && (
        <div className="border border-dashed border-border rounded-md p-8 text-center space-y-3">
          <div className="text-sm text-muted-foreground">Your roster is empty — add a model before you can submit talent to a campaign.</div>
          <Btn variant="primary" size="sm" icon={<UserPlus size={12}/>} onClick={onGoToRoster}>Add Model</Btn>
        </div>
      )}

      <div className="space-y-2">
        {roster.filter(m=>submittedIds.has(m.id)).map(m=>{
          const sub = submitted.find(s=>s.modelId===m.id)!;
          return (
            <div key={m.id} className="glass-subtle border border-dashed rounded-md p-4 flex items-center gap-4 opacity-70">
              <XBox className="w-12 h-12 rounded-md shrink-0"/>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{m.name}</div>
                <div className="text-xs text-muted-foreground">{sub.campaign} · awaiting brand review</div>
              </div>
              <Badge label="Submitted" variant="pending"/>
            </div>
          );
        })}
        {roster.filter(m=>!submittedIds.has(m.id)).map(m=>(
          <div key={m.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
            <XBox className="w-12 h-12 rounded-md shrink-0"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.location} · {m.rate}</div>
            </div>
            <Btn variant="outline" size="sm" onClick={()=>selectModel(m.id)}>Submit</Btn>
          </div>
        ))}
      </div>

      {showPicker && (
        <RosterPickerModal roster={roster.filter(m=>!submittedIds.has(m.id))} onPick={selectModel} onClose={()=>setShowPicker(false)}/>
      )}

      {showForm && pickedModel && (
        <Modal onClose={()=>setShowForm(false)}>
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold">Submit Talent</div>
            <button onClick={()=>setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <FieldLabel>Model</FieldLabel>
              <button onClick={()=>{ setShowForm(false); setShowPicker(true); }}
                className="w-full flex items-center gap-3 border border-border rounded-md p-2.5 hover:border-foreground transition-colors text-left">
                <XBox className="w-10 h-10 rounded-sm shrink-0"/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{pickedModel.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{pickedModel.location} · {pickedModel.rate}</div>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5 shrink-0">Change <ChevronRight size={11}/></span>
              </button>
              <div className="text-[10px] text-muted-foreground font-mono mt-1">Pulled from their DVURE profile.</div>
            </div>
            <FSelect label="Campaign" options={INVITATIONS.map(i=>i.campaign)}/>
            <Textarea label="Note to brand" placeholder="Optional — why this model fits the brief…" rows={3}/>
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <Btn variant="primary" onClick={()=>{
              setSubmitted(p=>[...p,{ modelId:pickedModel.id, campaign:pickedCampaign||INVITATIONS[0]?.campaign||"" }]);
              setShowForm(false);
            }}>Submit</Btn>
            <Btn variant="outline" onClick={()=>setShowForm(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AddModelModal({ onClose, onAdd }: { onClose: () => void; onAdd: (m: Omit<RosterModel,"id"|"agency">) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [rate, setRate] = useState("");

  return (
    <Modal onClose={onClose}>
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="text-sm font-semibold">Add Model to Roster</div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
      </div>
      <div className="p-5 space-y-3">
        <TextInput label="Full Name" placeholder="e.g. Nadia Petrov" value={name} onChange={e=>setName(e.target.value)}/>
        <TextInput label="Email" placeholder="model@example.com" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>
        <TextInput label="Location" placeholder="e.g. New York, NY" value={location} onChange={e=>setLocation(e.target.value)}/>
        <TextInput label="Day Rate" placeholder="e.g. $1,000/day" value={rate} onChange={e=>setRate(e.target.value)}/>
        <div className="bg-secondary border border-border rounded-md px-3 py-2 text-xs text-muted-foreground">
          An invitation email will be sent to this model to set up their DVURE login, so they can see their own bookings and payment status.
        </div>
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <Btn variant="primary" disabled={!name || !email} onClick={()=>{
          onAdd({ name, email, location: location||"—", rate: rate||"—", height:"—", exp:"—" });
          onClose();
        }}>Send Invitation</Btn>
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}

function RosterView({ roster, onAddModel }: { roster: RosterModel[]; onAddModel: (m: Omit<RosterModel,"id"|"agency">) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Your full talent roster — it's the agency's responsibility to add models here.</p>
        <Btn variant="primary" size="sm" icon={<UserPlus size={12}/>} onClick={()=>setShowAdd(true)}>Add Model</Btn>
      </div>
      <div className="space-y-2">
        {roster.map(m=>(
          <div key={m.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
            <XBox className="w-12 h-12 rounded-md shrink-0"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.location} · {m.email}</div>
            </div>
            <div className="text-xs font-mono">{m.rate}</div>
          </div>
        ))}
        {roster.length===0 && (
          <div className="border border-dashed border-border rounded-md p-10 text-center text-sm text-muted-foreground">No models yet — add your first one.</div>
        )}
      </div>
      {showAdd && <AddModelModal onClose={()=>setShowAdd(false)} onAdd={onAddModel}/>}
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
              <div key={b.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
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
            <div key={b.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
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
  const [roster, setRoster] = useState<RosterModel[]>(INITIAL_ROSTER);

  function addModel(m: Omit<RosterModel,"id"|"agency">) {
    setRoster(prev => [...prev, { ...m, id: Date.now(), agency: AGENCY_NAME }]);
  }

  return (
    <CurrentUserProvider user={{ name:"Sophie Chen", title:"Senior Agent" }}>
      <div className="h-screen flex bg-background overflow-hidden">
        <aside className="w-52 shrink-0 glass border-r flex flex-col">
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
            {view === "submit" && <SubmitTalentView roster={roster} onGoToRoster={()=>setView("roster")}/>}
            {view === "roster" && <RosterView roster={roster} onAddModel={addModel}/>}
            {view === "payments" && <PaymentsView/>}
            {view === "messaging" && (
              <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-md">
                <div className="text-sm text-muted-foreground">Messaging · shares the same thread data as Brand once Supabase lands</div>
              </div>
            )}
          </div>
        </main>
      </div>
    </CurrentUserProvider>
  );
}
