import { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Check, Loader2 } from "lucide-react";
import { Btn, Badge } from "./ui";
import { useAuth } from "./auth";
import { getStripe } from "../../lib/stripeClient";
import { createSubscriptionCheckout } from "../../lib/queries/stripe";

// Same number as create-subscription-checkout's PLAN_BY_ORG_TYPE —
// display-only here (the client can't read the server's constant), the
// server is what actually sets the price Stripe charges. Keep in sync.
// Agency only — brands are free, see accessGate.ts's own comment.
const PLAN_NAME = "DVURE Agency Professional";
const PLAN_PRICE_LABEL = "$99 / month";

function ConfirmStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  async function handleConfirm() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
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
        <div className="text-sm font-semibold">Subscribed</div>
        <div className="text-xs text-muted-foreground">Confirming with Stripe — this updates in a moment.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && <div className="text-xs text-[#C0392B]">{error}</div>}
      <div className="flex gap-2">
        <Btn variant="primary" disabled={!stripe || submitting} onClick={handleConfirm}>
          {submitting ? <span className="flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Processing…</span> : "Subscribe"}
        </Btn>
        <Btn variant="outline" disabled={submitting} onClick={onBack}>Back</Btn>
      </div>
    </div>
  );
}

// Real, billable subscription checkout — agency only (Agency Profile
// view). Stripe Elements throughout (never a hosted Checkout redirect),
// matching the pattern already established for invoice payments.
export default function SubscriptionCheckout() {
  const { org, refreshIdentity } = useAuth();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!org) return null;

  async function startCheckout() {
    setStarting(true);
    setError(null);
    const { clientSecret: secret, error: err } = await createSubscriptionCheckout();
    setStarting(false);
    if (err || !secret) { setError(err ?? "Couldn't start checkout."); return; }
    setClientSecret(secret);
  }

  if (org.subscriptionStatus === "active") {
    return (
      <div className="glass-subtle border rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{PLAN_NAME}</div>
            <div className="text-xs text-muted-foreground">{PLAN_PRICE_LABEL} · Billed monthly</div>
          </div>
          <Badge label={org.foundingMember ? "Founding Member" : "Active"} variant="success" />
        </div>
        <div className="px-5 py-3 text-xs text-muted-foreground">
          {org.foundingMember
            ? "You joined during the pilot — your rate is locked in at $99/mo for as long as you stay subscribed, even as pricing changes for new agencies."
            : "Your subscription is active and billed automatically each month."}
        </div>
      </div>
    );
  }

  if (clientSecret) {
    return (
      <div className="glass-subtle border rounded-md p-5">
        <div className="text-sm font-semibold mb-1">Confirm subscription</div>
        <div className="text-xs text-muted-foreground mb-4">{PLAN_NAME} · {PLAN_PRICE_LABEL}</div>
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
          <ConfirmStep onBack={() => setClientSecret(null)} onDone={() => { refreshIdentity(); setClientSecret(null); }} />
        </Elements>
      </div>
    );
  }

  return (
    <div className="glass-subtle border rounded-md overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{PLAN_NAME}</div>
          <div className="text-xs text-muted-foreground">{PLAN_PRICE_LABEL} · Billed monthly</div>
        </div>
        <Badge label={org.subscriptionStatus === "past_due" ? "Past Due" : org.subscriptionStatus === "canceled" ? "Canceled" : "Trial"} variant={org.subscriptionStatus === "past_due" ? "warning" : "default"} />
      </div>
      <div className="px-5 py-4 space-y-3">
        {org.trialEndsAt && new Date(org.trialEndsAt) > new Date() && org.subscriptionStatus === "trialing" && (
          <div className="text-xs text-muted-foreground">
            Your trial runs until {new Date(org.trialEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Add a payment method now, or any time before then.
          </div>
        )}
        {error && <div className="text-xs text-urgent bg-urgent/5 border border-urgent rounded-md px-3 py-2">{error}</div>}
        <Btn variant="primary" size="sm" disabled={starting} onClick={startCheckout}>
          {starting ? "Starting…" : "Add payment method"}
        </Btn>
      </div>
    </div>
  );
}
