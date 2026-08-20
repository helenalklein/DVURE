import { useEffect, useState } from "react";
import { LogOut, Briefcase, Calendar, FileCheck, CreditCard, User, MessageSquare, ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { cx, Badge, TopBar, Stat, CurrentUserProvider, DvureMark, DvureSignature, MobileNavDrawer, Btn, isMinor, RichTextEditor, NegotiationThread } from "../shared/ui";
import { CAMPAIGNS, CAMPAIGN_AGENCY_THREADS } from "../shared/mockData";
import { useAuth } from "../shared/auth";
import { fetchPendingConfirmationsForModel, fetchInvoicesForModel, type Invoice, type InvoiceStatus } from "../../lib/queries/payments";
import { fetchBookingsForModel, type ModelBooking } from "../../lib/queries/bookings";
import { fetchContractsForModel, signContractAsModel, type ModelContract, type ContractStatus } from "../../lib/queries/contracts";
import { postOffer } from "../../lib/queries/rateNegotiations";
import { updateMyPronouns } from "../../lib/queries/roster";
import PaymentConfirmQueue from "../shared/PaymentConfirmQueue";
import { CompCard } from "../shared/CompCard";
import type { Talent } from "../shared/types";

type View = "bookings" | "schedule" | "contracts" | "earnings" | "profile" | "messages";

const NAV: { id: View; label: string; Icon: typeof Briefcase }[] = [
  { id:"bookings",     label:"My Bookings",   Icon:Briefcase  },
  { id:"schedule",     label:"Schedule",      Icon:Calendar   },
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

// A real month-grid calendar built on the model's own real bookings —
// same fetchBookingsForModel data BookingsView already uses, just laid
// out visually the same way CampaignCalendar's MonthGrid does for
// brands/agencies (grid-cols-7, today marker, event chips) so it reads
// as the same product, not a different mini-feature.
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function ScheduleView() {
  const { modelProfile } = useAuth();
  const [bookings, setBookings] = useState<ModelBooking[] | null>(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });

  useEffect(() => {
    if (!modelProfile) { setBookings([]); return; }
    fetchBookingsForModel(modelProfile.id).then(setBookings);
  }, [modelProfile?.id]);

  if (bookings === null) return <div className="text-sm text-muted-foreground">Loading...</div>;

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
  const upcoming = bookings
    .filter(b => parseISODate(b.shootDate) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .sort((a, b) => parseISODate(a.shootDate).getTime() - parseISODate(b.shootDate).getTime());
  const nextShoot = upcoming[0] ?? null;

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">Your confirmed shoot days, drawn from your bookings.</p>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Upcoming shoot days" value={upcoming.length}/>
        <Stat label="Total booked days" value={bookings.length}/>
      </div>
      <div className="glass-subtle border rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="text-sm font-semibold">{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
          <div className="flex items-center gap-1">
            <button onClick={()=>setCursor(c=>new Date(c.getFullYear(), c.getMonth()-1, 1))} className="p-1 rounded hover:bg-secondary cursor-pointer text-muted-foreground hover:text-foreground"><ChevronLeft size={15}/></button>
            <button onClick={()=>{ const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); setCursor(d); }} className="px-2 py-1 text-[10px] font-mono uppercase tracking-wide rounded hover:bg-secondary cursor-pointer text-muted-foreground hover:text-foreground">Today</button>
            <button onClick={()=>setCursor(c=>new Date(c.getFullYear(), c.getMonth()+1, 1))} className="p-1 rounded hover:bg-secondary cursor-pointer text-muted-foreground hover:text-foreground"><ChevronRight size={15}/></button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-t border-l border-border">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} className="border-r border-b border-border px-2 py-1.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground bg-secondary/40">{d}</div>
          ))}
          {cells.map(({ date, inMonth }, i) => {
            const dayBookings = bookings.filter(b => sameDay(parseISODate(b.shootDate), date));
            const isToday = sameDay(date, today);
            return (
              <div key={i} className={cx("border-r border-b border-border min-h-[76px] p-1.5", !inMonth && "bg-secondary/20")}>
                <div className={cx("text-[11px] font-mono mb-1 inline-flex items-center justify-center",
                  isToday ? "w-5 h-5 rounded-full bg-foreground text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/50")}>
                  {date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayBookings.map((b,j)=>(
                    <div key={j} title={`${b.campaignName} · ${b.brandName}`}
                      className="flex items-center gap-1 text-[10px] px-1 py-0.5 rounded-sm bg-secondary truncate">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-foreground"/>
                      <span className="truncate">{b.campaignName}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-subtle border rounded-md p-4">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Next Shoot</div>
        {nextShoot ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">{nextShoot.campaignName}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {nextShoot.brandName}{nextShoot.agencyName ? ` · via ${nextShoot.agencyName}` : ""}
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-mono">
                {parseISODate(nextShoot.shootDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                {" · "}{nextShoot.days} day{nextShoot.days>1?"s":""}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Day rate</div>
              <div className="text-sm font-mono font-semibold">${nextShoot.dayRate.toLocaleString()}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No upcoming shoots on the books.</div>
        )}
      </div>
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

const CONTRACT_STATUS_BADGE: Record<ContractStatus, { label: string; variant: "default"|"active"|"pending"|"draft" }> = {
  draft: { label: "Draft", variant: "draft" },
  awaiting_signature: { label: "Awaiting your signature", variant: "pending" },
  fully_executed: { label: "Fully executed", variant: "active" },
};

// The model's own real in-app signature — sign_contract_as_model (0083)
// re-validates ownership/status server-side, so this is just a typed
// legal name against an awaiting_signature contract. Distinct from
// markContractExecuted's brand-side external-attestation path (paper/
// DocuSign/email) — that one never touches model_signature_name, so a
// contract executed that way shows "Executed" here with no claim that
// the model signed it in-app.
// A typed name that doesn't match the model's own profile name is
// almost always a typo, not an intentional legal name change — this is
// a real e-signature, not a free-text field, so it's worth a hard stop
// rather than trusting whatever got typed. Whitespace/case-insensitive
// so "elena marsh" or "Elena  Marsh" still pass.
function normalizeName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function ContractSignBox({ contract, onSigned, onCountered }: { contract: ModelContract; onSigned: () => void; onCountered: () => void }) {
  const { profile, modelProfile } = useAuth();
  const [typedName, setTypedName] = useState("");
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countering, setCountering] = useState(false);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterNote, setCounterNote] = useState("");
  const [sendingCounter, setSendingCounter] = useState(false);

  const minor = isMinor(modelProfile?.dateOfBirth);
  const expectedName = minor ? modelProfile?.guardianName : modelProfile?.fullName;

  async function submit() {
    if (!typedName.trim()) { setError(`Type ${minor ? "the parent/guardian's" : "your"} full legal name to sign.`); return; }
    if (expectedName && normalizeName(typedName) !== normalizeName(expectedName)) {
      setError(`That doesn't match ${minor ? "the parent/guardian on file" : "your profile name"} (${expectedName}) — check the spelling and try again.`);
      return;
    }
    setSigning(true);
    setError(null);
    const { error } = await signContractAsModel(contract.id, typedName.trim());
    setSigning(false);
    if (error) { setError(error); return; }
    onSigned();
  }

  async function submitCounter() {
    const amount = Number(counterAmount);
    if (!amount || amount <= 0 || !profile) { setError("Enter a counter rate to send."); return; }
    setSendingCounter(true);
    setError(null);
    const { error } = await postOffer(contract.id, profile.id, "model", amount, counterNote.trim() || undefined);
    setSendingCounter(false);
    if (error) { setError(error); return; }
    setCountering(false);
    setCounterAmount(""); setCounterNote("");
    onCountered();
  }

  if (minor && !modelProfile?.guardianName) {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <div className="text-xs text-red-500">No parent or guardian is on file yet — your agency needs to add one before this contract can be signed.</div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2">
      {countering ? (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Propose a different rate instead of signing — sent to the brand and your agency.</div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-border rounded-md bg-input-background px-2 w-28 shrink-0">
              <span className="text-sm text-muted-foreground">$</span>
              <input value={counterAmount} onChange={e=>setCounterAmount(e.target.value.replace(/[^0-9]/g,""))} placeholder={String(contract.dayRate)}
                className="w-full bg-transparent px-1 py-1.5 text-sm focus:outline-none"/>
            </div>
            <input value={counterNote} onChange={e=>setCounterNote(e.target.value)} placeholder="Optional note"
              className="flex-1 border border-border rounded-md px-3 py-1.5 text-sm bg-input-background focus:outline-none focus:border-foreground"/>
          </div>
          <div className="flex gap-2">
            <Btn size="sm" onClick={submitCounter} disabled={sendingCounter}>{sendingCounter ? "Sending…" : "Send Counter"}</Btn>
            <Btn size="sm" variant="outline" onClick={()=>setCountering(false)}>Cancel</Btn>
          </div>
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            {minor
              ? "This model is a minor — type the parent or guardian's full legal name to sign this contract electronically."
              : "Type your full legal name to sign this contract electronically."}
          </div>
          <div className="flex items-center gap-2">
            <input value={typedName} onChange={e=>setTypedName(e.target.value)} placeholder={minor ? "Parent/guardian's full legal name" : "Full legal name"}
              className="flex-1 border border-border rounded-md px-3 py-1.5 text-base bg-input-background focus:outline-none focus:border-foreground"
              style={{ fontFamily: "cursive" }}/>
            <Btn size="sm" onClick={submit} disabled={signing} icon={<PenLine size={13}/>}>{signing ? "Signing…" : "Sign"}</Btn>
            <Btn size="sm" variant="outline" onClick={()=>setCountering(true)}>Counter</Btn>
          </div>
        </>
      )}
      {error && <div className="text-xs text-red-500">{error}</div>}
    </div>
  );
}

function ContractsView() {
  const { profile, modelProfile } = useAuth();
  const [contracts, setContracts] = useState<ModelContract[] | null>(null);
  // NegotiationThread owns its own message list internally and only
  // refetches it on mount or after its own send/accept — a counter sent
  // through ContractSignBox (a sibling, not the thread's own input) has
  // no way to tell it a new message exists. Bumping this and folding it
  // into the thread's key forces a remount (and so a fresh fetch)
  // whenever anything on this screen reloads, not just the thread's own
  // actions.
  const [reloadNonce, setReloadNonce] = useState(0);

  function reload() {
    if (!modelProfile) { setContracts([]); return; }
    fetchContractsForModel(modelProfile.id).then(setContracts);
    setReloadNonce(n => n + 1);
  }

  useEffect(reload, [modelProfile?.id]);

  if (contracts === null) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-muted-foreground mb-2">Contracts your bookings generate. Sign in-app once a contract is ready for your signature.</p>
      {contracts.map(c=>(
        <div key={c.id} className="glass-subtle border rounded-md p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="text-sm font-semibold">{c.campaignName}</div>
              <div className="text-xs text-muted-foreground">{c.brandName} · {c.contractNumber}</div>
            </div>
            <div className="text-right shrink-0">
              <Badge {...CONTRACT_STATUS_BADGE[c.status]}/>
              {c.sentAt && <div className="text-[10px] text-muted-foreground mt-1">Sent {new Date(c.sentAt).toLocaleDateString()}</div>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-xs">
            <div><div className="text-muted-foreground">{c.status==="fully_executed" ? "Agreed Rate" : "Offered Rate"}</div><div className="font-mono font-medium">${c.dayRate.toLocaleString()}</div></div>
            <div><div className="text-muted-foreground">Territory</div><div className="font-medium">{c.territory}</div></div>
            <div><div className="text-muted-foreground">Duration</div><div className="font-medium">{c.duration}</div></div>
          </div>
          {c.status === "awaiting_signature" && profile && (
            <div className="mt-3 pt-3 border-t border-border">
              <NegotiationThread key={`${c.id}-${reloadNonce}`} contractId={c.id} campaignId={c.campaignId} viewerRole="model" viewerProfileId={profile.id}
                currentRate={c.dayRate} onRateChanged={reload}/>
            </div>
          )}
          {/* The actual contract text — deal terms above are the summary,
              this is what's actually being signed. Read-only: a model
              can review it but never edit the document they're about to
              sign. */}
          {c.documentHtml && (
            <div className="mt-3 pt-3 border-t border-border">
              <RichTextEditor value={c.documentHtml} readOnly minHeight="0px" className="max-h-56"/>
            </div>
          )}
          {c.status === "awaiting_signature" && <ContractSignBox contract={c} onSigned={reload} onCountered={reload}/>}
          {c.status === "fully_executed" && (
            <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
              {c.modelSignatureName
                ? <>Signed electronically by <span className="font-medium text-foreground">{c.modelSignatureName}</span> on {c.signedByModelAt ? new Date(c.signedByModelAt).toLocaleDateString() : ""}</>
                : <>Executed{c.executedAt ? ` on ${new Date(c.executedAt).toLocaleDateString()}` : ""}</>}
            </div>
          )}
        </div>
      ))}
      {contracts.length===0 && (
        <div className="flex items-center justify-center h-40 border border-dashed border-border rounded-md">
          <div className="text-sm text-muted-foreground">No contracts yet</div>
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
const SEX_LABEL: Record<string, string> = { male: "Male", female: "Female", non_binary: "Non-binary", other: "Other" };
const PRONOUN_PRESETS = ["She/her", "He/him", "They/them"];

// The one field on this whole profile the model sets for themselves —
// sex and everything else here comes from the agency at intake.
function PronounsEditor() {
  const { modelProfile, refreshIdentity } = useAuth();
  const current = modelProfile?.pronouns ?? "";
  const isCustom = !!current && !PRONOUN_PRESETS.includes(current);
  const [selection, setSelection] = useState(isCustom ? "Other" : current);
  const [custom, setCustom] = useState(isCustom ? current : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(value: string) {
    setSaving(true);
    setSaved(false);
    const { error } = await updateMyPronouns(value);
    setSaving(false);
    if (!error) { setSaved(true); await refreshIdentity(); }
  }

  return (
    <div className="flex items-center gap-2">
      <select value={selection}
        onChange={e=>{ const v = e.target.value; setSelection(v); if (v !== "Other") save(v); }}
        className="border border-border rounded-md px-2 py-1.5 text-xs bg-input-background focus:outline-none focus:border-foreground cursor-pointer">
        <option value="">Not set</option>
        {PRONOUN_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
        <option value="Other">Other…</option>
      </select>
      {selection === "Other" && (
        <input value={custom} onChange={e=>setCustom(e.target.value)} onBlur={()=>custom.trim() && save(custom.trim())}
          placeholder="Type your own" className="border border-border rounded-md px-2 py-1.5 text-xs bg-input-background focus:outline-none focus:border-foreground w-32"/>
      )}
      {saving && <span className="text-[10px] text-muted-foreground">Saving…</span>}
      {saved && !saving && <span className="text-[10px] text-muted-foreground">Saved</span>}
    </div>
  );
}

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
      <div className="mt-4 space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Sex</span>
          <span className="font-medium">{modelProfile.sex ? SEX_LABEL[modelProfile.sex] ?? modelProfile.sex : "Not set — ask your agency"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Pronouns</span>
          <PronounsEditor/>
        </div>
      </div>
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
            {view === "schedule" && <ScheduleView/>}
            {view === "contracts" && <ContractsView/>}
            {view === "earnings" && <EarningsView/>}
            {view === "messages" && <MessagesView/>}
            {view === "profile" && <MyCompCardView/>}
          </div>
        </main>
      </div>
    </CurrentUserProvider>
  );
}
