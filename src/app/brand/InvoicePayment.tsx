import { useEffect, useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Check, Loader2, Landmark, CreditCard } from "lucide-react";
import { cx, Btn, Badge } from "../shared/ui";
import { getStripe } from "../../lib/stripeClient";
import { fetchUnpaidBookings, type UnpaidBooking, PLATFORM_FEE_PCT_BY_METHOD } from "../../lib/queries/bookings";
import { createInvoicePayment } from "../../lib/queries/stripe";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// The actual card form. Has to live inside <Elements> — useStripe/
// useElements only resolve once Elements has mounted with a clientSecret.
function ConfirmStep({ totalCents, onDone, onBack }: { totalCents: number; onDone: () => void; onBack: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  async function handleConfirm() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    // redirect: "if_required" — the vast majority of card payments
    // resolve right here without ever leaving DVURE; Stripe only sends
    // the browser away for the rare payment method that legally requires
    // an off-site step (e.g. certain bank redirects, some 3D Secure
    // flows), and returns it right back when done.
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setSubmitting(false);
    if (confirmError) {
      setError(confirmError.message ?? "Payment failed.");
      return;
    }
    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
      setSucceeded(true);
      setTimeout(onDone, 1800);
    } else {
      setError("Payment did not complete — please try again.");
    }
  }

  if (succeeded) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <div className="w-12 h-12 rounded-full bg-foreground text-primary-foreground flex items-center justify-center">
          <Check size={22} />
        </div>
        <div className="text-sm font-semibold">Payment sent</div>
        <div className="text-xs text-muted-foreground">Agencies will be paid out as their Connect accounts confirm.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && <div className="text-xs text-[#C0392B]">{error}</div>}
      <div className="flex gap-2">
        <Btn variant="primary" disabled={!stripe || submitting} onClick={handleConfirm}>
          {submitting ? <span className="flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Processing…</span> : `Pay ${money(totalCents / 100)}`}
        </Btn>
        <Btn variant="outline" disabled={submitting} onClick={onBack}>Back</Btn>
      </div>
    </div>
  );
}

// Payment method has to be picked before the PaymentIntent even exists
// — the platform fee (and so the actual amount charged) depends on it,
// and locking that in after the fact would mean either recomputing an
// already-created charge or letting the brand switch methods inside
// Stripe's own picker after the amount was fixed for the other one.
function MethodStep({ grossCents, onContinue, onBack, creating, error }: {
  grossCents: number; onContinue: (method: "ach" | "card") => void; onBack: () => void; creating: boolean; error: string | null;
}) {
  const [method, setMethod] = useState<"ach" | "card">("ach");
  const feePct = PLATFORM_FEE_PCT_BY_METHOD[method];
  const feeCents = Math.round(grossCents * feePct / 100);
  const totalCents = grossCents + feeCents;

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">Choose how you'd like to pay — this fixes the platform fee for this charge.</div>
      <div className="space-y-2">
        {([
          { id: "ach" as const, label: "Bank transfer (ACH)", Icon: Landmark, note: "Recommended — cheaper to process" },
          { id: "card" as const, label: "Card", Icon: CreditCard, note: null },
        ]).map(opt => (
          <button key={opt.id} onClick={() => setMethod(opt.id)}
            className={cx("w-full flex items-center gap-3 p-3 rounded-md border transition-colors text-left cursor-pointer",
              method === opt.id ? "border-foreground bg-secondary" : "border-border hover:border-foreground/40")}>
            <opt.Icon size={16} className="text-muted-foreground shrink-0"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium flex items-center gap-1.5">{opt.label} {opt.id === "ach" && <Badge label="Recommended" variant="success"/>}</div>
              {opt.note && <div className="text-[11px] text-muted-foreground">{opt.note}</div>}
            </div>
            <div className="text-xs font-mono text-muted-foreground shrink-0">{PLATFORM_FEE_PCT_BY_METHOD[opt.id]}% fee</div>
          </button>
        ))}
      </div>
      <div className="border-t border-border pt-3 space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span className="font-mono">{money(grossCents / 100)}</span></div>
        <div className="flex justify-between text-xs text-muted-foreground"><span>Platform fee ({feePct}%)</span><span className="font-mono">{money(feeCents / 100)}</span></div>
        <div className="flex justify-between text-sm font-semibold"><span>Total</span><span className="font-mono">{money(totalCents / 100)}</span></div>
      </div>
      {error && <div className="text-xs text-[#C0392B]">{error}</div>}
      <div className="flex gap-2">
        <Btn variant="primary" disabled={creating} onClick={() => onContinue(method)}>
          {creating ? "Preparing payment…" : `Continue with ${method === "ach" ? "bank transfer" : "card"}`}
        </Btn>
        <Btn variant="outline" disabled={creating} onClick={onBack}>Back</Btn>
      </div>
    </div>
  );
}

export default function InvoicePaymentPanel({ campaignId, onPaid }: { campaignId: string; onPaid?: () => void }) {
  const [bookings, setBookings] = useState<UnpaidBooking[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // "full" is the default and stays pre-filled/selected on load — matches
  // every other booking's own day rate, no editing required to pay the
  // whole thing. Switching to "select" is the explicit opt-in for paying
  // only certain people; switching back re-selects everything.
  const [mode, setMode] = useState<"full" | "select">("full");
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"select" | "method" | "confirm">("select");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [totalCents, setTotalCents] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const data = await fetchUnpaidBookings(campaignId);
      if (!active) return;
      setBookings(data);
      setSelected(new Set(data.map((b) => b.id)));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [campaignId]);

  function toggle(id: string) {
    if (mode !== "select") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function setMode_(next: "full" | "select") {
    setMode(next);
    if (next === "full") setSelected(new Set(bookings.map((b) => b.id)));
  }

  const selectedBookings = bookings.filter((b) => selected.has(b.id));
  const grossCents = Math.round(selectedBookings.reduce((sum, b) => sum + b.grossAmount, 0) * 100);

  async function startPayment(method: "ach" | "card") {
    setCreating(true);
    setError(null);
    const { clientSecret: secret, totalAmount, error: err } = await createInvoicePayment(Array.from(selected), method, campaignId);
    setCreating(false);
    if (err || !secret) { setError(err ?? "Couldn't start payment."); return; }
    setClientSecret(secret);
    setTotalCents(Math.round((totalAmount ?? grossCents / 100) * 100));
    setStep("confirm");
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading bookings…</div>;

  if (bookings.length === 0) {
    return <div className="p-6 text-sm text-muted-foreground">No outstanding bookings to pay on this campaign right now.</div>;
  }

  if (step === "confirm" && clientSecret) {
    return (
      <div className="max-w-md p-6">
        <div className="text-heading text-sm mb-1">Confirm payment</div>
        <div className="text-xs text-muted-foreground mb-4">
          {selectedBookings.length} {selectedBookings.length === 1 ? "booking" : "bookings"} · {money(totalCents / 100)} total
        </div>
        <Elements stripe={getStripe()} options={{
          clientSecret,
          appearance: {
            theme: "flat",
            variables: {
              colorPrimary: "#1E1C1A",
              colorBackground: "#FBFAF7",
              colorText: "#1E1C1A",
              colorTextSecondary: "#6E675D",
              colorDanger: "#C0392B",
              fontFamily: "\"Libre Franklin\", ui-sans-serif, sans-serif",
              borderRadius: "3px",
              spacingUnit: "4px",
            },
            rules: {
              ".Input": { border: "1px solid #E3DFD5", boxShadow: "none" },
              ".Input:focus": { border: "1px solid #1E1C1A", boxShadow: "none" },
              ".Label": { fontSize: "12px", color: "#6E675D" },
              ".Tab": { border: "1px solid #E3DFD5" },
              ".Tab--selected": { border: "1px solid #1E1C1A" },
            },
          },
        }}>
          <ConfirmStep totalCents={totalCents} onBack={() => { setStep("method"); setClientSecret(null); }} onDone={() => { onPaid?.(); }} />
        </Elements>
      </div>
    );
  }

  if (step === "method") {
    return (
      <div className="max-w-md p-6">
        <div className="text-heading text-sm mb-1">Pay {selectedBookings.length} {selectedBookings.length === 1 ? "booking" : "bookings"}</div>
        <MethodStep grossCents={grossCents} creating={creating} error={error} onBack={() => setStep("select")} onContinue={startPayment}/>
      </div>
    );
  }

  return (
    <div className="max-w-md p-6 space-y-4">
      <div>
        <div className="text-heading text-sm mb-1">Pay bookings</div>
        <div className="text-xs text-muted-foreground">Everything is charged in one invoice, split out to each agency automatically. A platform fee applies on top, based on how you pay.</div>
      </div>
      <div className="flex border border-border rounded-md p-0.5 gap-0.5">
        <button
          onClick={() => setMode_("full")}
          className={cx("flex-1 text-xs font-medium py-1.5 rounded-[3px] transition-colors cursor-pointer",
            mode === "full" ? "bg-foreground text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >Pay in full</button>
        <button
          onClick={() => setMode_("select")}
          className={cx("flex-1 text-xs font-medium py-1.5 rounded-[3px] transition-colors cursor-pointer",
            mode === "select" ? "bg-foreground text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >Select bookings</button>
      </div>
      <div className="space-y-2">
        {bookings.map((b) => (
          <label key={b.id} className={cx(
            "flex items-center gap-3 border rounded-md px-3 py-2.5 transition-colors",
            mode === "select" ? "cursor-pointer" : "cursor-default",
            selected.has(b.id) ? "border-foreground/30 bg-secondary" : "border-border"
          )}>
            <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} disabled={mode === "full"} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{b.modelName}</div>
              <div className="text-xs text-muted-foreground truncate">{b.agencyName} · {b.days} day{b.days === 1 ? "" : "s"} @ {money(b.dayRate)}/day</div>
            </div>
            <div className="text-sm font-mono shrink-0">{money(b.grossAmount)}</div>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="text-xs text-muted-foreground">Subtotal</div>
        <div className="text-base font-semibold">{money(grossCents / 100)}</div>
      </div>
      <Btn variant="primary" disabled={selected.size === 0} onClick={() => setStep("method")}>
        Continue to payment
      </Btn>
    </div>
  );
}
