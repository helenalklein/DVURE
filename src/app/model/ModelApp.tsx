import { useEffect, useState } from "react";
import { LogOut, Briefcase, Calendar, FileCheck, CreditCard, User, MessageSquare } from "lucide-react";
import { cx, Badge, TopBar, Stat, CurrentUserProvider, DvureMark, DvureSignature, MobileNavDrawer } from "../shared/ui";
import { CAMPAIGNS, CAMPAIGN_AGENCY_THREADS } from "../shared/mockData";
import { useAuth } from "../shared/auth";
import { fetchPendingConfirmationsForModel, fetchInvoicesForModel, type Invoice, type InvoiceStatus } from "../../lib/queries/payments";
import { fetchBookingsForModel, type ModelBooking } from "../../lib/queries/bookings";
import PaymentConfirmQueue from "../shared/PaymentConfirmQueue";
import { CompCard } from "../shared/CompCard";
import type { Talent } from "../shared/types";

type View = "bookings" | "availability" | "contracts" | "earnings" | "profile" | "messages";

const NAV: { id: View; label: string; Icon: typeof Briefcase }[] = [
  { id:"bookings",     label:"My Bookings",   Icon:Briefcase  },
  { id:"availability", label:"Availability",  Icon:Calendar   },
  { id:"contracts",    label:"Contracts",     Icon:FileCheck  },
  { id:"earnings",     label:"Earnings",      Icon:CreditCard },
  { id:"messages",     label:"Project Updates", Icon:MessageSquare  },
  { id:"profile",      label:"My Profile",    Icon:User       },
];

// Read-only: brands can't message models directly, and models can't
// message brands or agencies from here — they can only view what their
// agency and the brand have said in that agency's private campaign
// thread (including any "message blast" broadcasts about time/location
// changes). Same underlying data the brand and agency see, just no
// input box. A model with both a mother and boutique agency sees both
// agencies' threads here, still read-only.
function MessagesView() {
  const { modelAgencies } = useAuth();
  const myAgencyNames = (modelAgencies ?? []).map(a => a.name);
  const campaignsWithThreads = CAMPAIGNS
    .map(c => ({ campaign: c, agencies: myAgencyNames.filter(a => CAMPAIGN_AGENCY_THREADS[c.id]?.[a]?.length) }))
    .filter(x => x.agencies.length > 0);

  if (campaignsWithThreads.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-md">
        <div className="text-sm text-muted-foreground">No project updates yet.</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-sm text-muted-foreground">
        View-only — messages between your agency and the brand for each project. You can't reply here; talk to your agency directly.
      </p>
      {campaignsWithThreads.map(({ campaign, agencies }) => agencies.map(agency => (
        <div key={`${campaign.id}-${agency}`} className="glass-subtle border rounded-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <div className="text-xs font-semibold">{campaign.name}</div>
            <div className="text-[10px] text-muted-foreground">via {agency}</div>
          </div>
          <div className="p-4 space-y-3">
            {CAMPAIGN_AGENCY_THREADS[campaign.id]![agency].map(m=>(
              <div key={m.id} className="flex flex-col gap-1">
                {m.broadcast && <div className="text-[9px] font-mono uppercase tracking-wide text-urgent">Update from brand</div>}
                <div className={cx("rounded-xl px-4 py-2.5 text-sm max-w-md leading-relaxed",
                  m.broadcast ? "bg-urgent/10 border border-urgent text-foreground" : "bg-secondary text-foreground"
                )}>{m.text}</div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="font-medium">{m.from}</span><span>· {m.fromOrg}</span><span className="font-mono">{m.ts}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )))}
    </div>
  );
}

// Bookings never carry a reliable per-booking payment status of their
// own (bookings.payment_status was retired as a stale signal during
// the Stripe integration — see create-invoice-payment's header) and an
// agency-repped booking's day rate isn't the model's actual take-home
// either, since the agency's internal split with the model happens
// entirely outside DVURE. So this view shows the real booking terms
// only — no fabricated "your earnings" or payment-status badge. Real
// payment tracking (only ever knowable for an independent booking)
// lives in EarningsView below.
function BookingsView() {
  const { modelProfile } = useAuth();
  const [bookings, setBookings] = useState<ModelBooking[] | null>(null);

  useEffect(() => {
    if (!modelProfile) { setBookings([]); return; }
    fetchBookingsForModel(modelProfile.id).then(setBookings);
  }, [modelProfile?.id]);

  if (bookings === null) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-muted-foreground mb-2">Your confirmed bookings.</p>
      {bookings.map(b=>(
        <div key={b.id} className="glass-subtle border rounded-md p-4">
          <div className="mb-2">
            <div className="text-sm font-semibold">{b.campaignName}</div>
            <div className="text-xs text-muted-foreground">{b.brandName}{b.agencyName ? ` · via ${b.agencyName}` : ""} · Shoot {b.shootDate}</div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Day rate ({b.days} day{b.days>1?"s":""} × ${b.dayRate.toLocaleString()})</span>
            <span className="font-mono text-sm font-semibold">${(b.dayRate*b.days).toLocaleString()}</span>
          </div>
        </div>
      ))}
      {bookings.length===0 && (
        <div className="flex items-center justify-center h-40 border border-dashed border-border rounded-md">
          <div className="text-sm text-muted-foreground">No bookings yet</div>
        </div>
      )}
    </div>
  );
}

// Same real-invoice pattern already used for Crew and Agency
// (fetchInvoicesForModel mirrors fetchInvoicesForCrewPayee) — only
// ever populated for an independent booking, since an agency-repped
// booking pays the agency directly and DVURE has no invoice of its
// own naming the model as payee.
const INVOICE_STATUS_BADGE: Record<InvoiceStatus, { label: string; variant: "default"|"active"|"pending"|"draft" }> = {
  outstanding: { label: "Awaiting payment", variant: "draft" },
  partially_paid: { label: "Partially paid", variant: "pending" },
  paid: { label: "Paid", variant: "active" },
};

function EarningsView() {
  const { modelProfile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useEffect(() => {
    if (!modelProfile) { setInvoices([]); return; }
    fetchInvoicesForModel(modelProfile.id).then(setInvoices);
  }, [modelProfile?.id]);

  if (invoices === null) return <div className="text-sm text-muted-foreground">Loading...</div>;

  const totalPaid = invoices.reduce((s,inv)=>s+inv.acceptedAmount,0);
  const totalPending = invoices.reduce((s,inv)=>s+(inv.totalAmount-inv.acceptedAmount),0);
  const paidCount = invoices.filter(i=>i.status==="paid").length;

  return (
    <div className="max-w-2xl space-y-4">
      {modelProfile && <PaymentConfirmQueue fetchPending={()=>fetchPendingConfirmationsForModel(modelProfile.id)}/>}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Paid to date" value={`$${totalPaid.toLocaleString()}`} sub={`${paidCount} invoice${paidCount!==1?"s":""}`}/>
        <Stat label="Awaiting payment" value={`$${totalPending.toLocaleString()}`}/>
      </div>
      {invoices.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No payment history yet. Bookings made through an agency are paid to your agency directly — this tracks payments for your independent bookings only.
        </div>
      ) : (
        <div className="glass-subtle border rounded-md overflow-hidden">
          {invoices.map((inv,i)=>(
            <div key={inv.id} className={cx("px-4 py-3 flex items-center justify-between gap-3", i>0 && "border-t border-border")}>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{inv.campaignName}</div>
                <div className="text-xs text-muted-foreground">${inv.acceptedAmount.toLocaleString()} of ${inv.totalAmount.toLocaleString()} confirmed</div>
              </div>
              <Badge {...INVOICE_STATUS_BADGE[inv.status]}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The model's own digital comp card — same CompCard component that
// backs a submitted model's flip-card everywhere else. A model isn't
// "submitted" on their own profile page, so the submission-only
// fields (stage, score, duplicate flags) are filled with neutral
// values CompCard doesn't render when there's no duplicateBadge/
// actions/etc. passed in.
function MyCompCardView() {
  const { modelProfile, modelAgencies } = useAuth();
  const motherAgency = modelAgencies?.find(a => a.isMotherAgency)?.name ?? modelAgencies?.[0]?.name ?? "";
  const boutiqueAgencies = (modelAgencies ?? []).filter(a => !a.isMotherAgency).map(a => a.name);

  if (!modelProfile) {
    return <div className="text-sm text-muted-foreground">Your profile isn't set up yet — reach out to your agency.</div>;
  }

  const talent: Talent = {
    id: 0, name: modelProfile.fullName,
    photo: modelProfile.photoUrl ?? undefined, modelEmail: modelProfile.email ?? undefined,
    agency: motherAgency, motherAgency, boutiqueAgencies,
    location: modelProfile.location ?? "", rate: modelProfile.dayRate != null ? `$${modelProfile.dayRate}/day` : "",
    stage: "submitted", avail: "available", note: "",
    height: modelProfile.height ?? "", bust: modelProfile.bust ?? "", waist: modelProfile.waist ?? "", dress: modelProfile.dress ?? "",
    exp: "", score: 0,
  };

  return (
    <div className="max-w-xs">
      <div className="text-xs text-muted-foreground mb-3">This is what brands and agencies see when you're submitted — hover the card and click the flip icon to see the back.</div>
      <CompCard talent={talent}/>
    </div>
  );
}

export default function ModelApp({ onLogout }: { onLogout: () => void }) {
  const { profile, modelProfile, modelAgencies } = useAuth();
  const [view, setView] = useState<View>("bookings");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const name = modelProfile?.fullName ?? profile?.fullName ?? "";
  const primaryAgency = modelAgencies?.find(a => a.isMotherAgency)?.name ?? modelAgencies?.[0]?.name ?? "";
  const initials = name.trim().split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase() || "?";

  function selectView(v: View) {
    setView(v);
    setMobileNavOpen(false);
  }

  return (
    <CurrentUserProvider user={{ name, title:"Model", org:primaryAgency, email:profile?.email ?? "", phone:profile?.phone ?? "", access:"basic" }}>
      <div className="h-screen flex bg-background overflow-hidden">
        <MobileNavDrawer open={mobileNavOpen} onClose={()=>setMobileNavOpen(false)}>
          <aside className="w-full h-full glass border-r flex flex-col">
            <div className="px-4 min-h-14 flex items-center border-b border-border gap-2.5" style={{ paddingTop: "env(safe-area-inset-top)" }}>
              <div className="w-9 h-9 bg-gold rounded-full flex items-center justify-center shrink-0">
                <span className="text-gold-foreground text-xs font-bold">{initials}</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{name}</div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Model</div>
              </div>
            </div>
            <nav className="flex-1 px-2 py-3 space-y-0.5">
              {NAV.map(item=>{
                const NavIcon = item.Icon;
                return (
                  <button key={item.id} onClick={()=>selectView(item.id)}
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
              <div className="flex items-center justify-center gap-1.5 pt-3 opacity-40">
                <DvureMark size={12}/><DvureSignature size={10}/>
              </div>
            </div>
          </aside>
        </MobileNavDrawer>
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          <TopBar title={NAV.find(n=>n.id===view)?.label ?? ""} sub={`${name} · Model`} onMenuClick={()=>setMobileNavOpen(true)}/>
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {view === "bookings" && <BookingsView/>}
            {view === "earnings" && <EarningsView/>}
            {view === "messages" && <MessagesView/>}
            {view === "profile" && <MyCompCardView/>}
            {view !== "bookings" && view !== "earnings" && view !== "messages" && view !== "profile" && (
              <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-md">
                <div className="text-sm text-muted-foreground">{NAV.find(n=>n.id===view)?.label} · coming soon</div>
              </div>
            )}
          </div>
        </main>
      </div>
    </CurrentUserProvider>
  );
}
