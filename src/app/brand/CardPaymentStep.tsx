import { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Check, Loader2 } from "lucide-react";
import { Btn, TaxesAndFeesLabel } from "../shared/ui";
import { getStripe } from "../../lib/stripeClient";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// The actual card form. Has to live inside <Elements> — useStripe/
// useElements only resolve once Elements has mounted with a clientSecret.
function ConfirmStep({ grossAmount, platformFeePct, platformFeeAmount, totalAmount, onDone, onBack }: {
  grossAmount: number; platformFeePct: number; platformFeeAmount: number; totalAmount: number; onDone: () => void; onBack: () => void;
}) {
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
    if (paymentIntent?.status === "succeeded") {
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
      <div className="rounded-md border border-[#E3DFD5] bg-[#FBFAF7] p-3 text-xs space-y-1">
        <div className="flex justify-between text-[#6E675D]"><span>Subtotal</span><span className="font-mono">{money(grossAmount)}</span></div>
        <div className="flex justify-between text-[#6E675D]"><span><TaxesAndFeesLabel/> ({platformFeePct}%)</span><span className="font-mono">{money(platformFeeAmount)}</span></div>
        <div className="flex justify-between font-semibold pt-1 border-t border-[#E3DFD5] text-[#1E1C1A]"><span>Total charge</span><span className="font-mono">{money(totalAmount)}</span></div>
      </div>
      <PaymentElement options={{ wallets: { link: "never" } }} />
      {error && <div className="text-xs text-[#C0392B]">{error}</div>}
      <div className="flex gap-2">
        <Btn variant="primary" disabled={!stripe || submitting} onClick={handleConfirm}>
          {submitting ? <span className="flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Processing…</span> : `Pay ${money(totalAmount)}`}
        </Btn>
        <Btn variant="outline" disabled={submitting} onClick={onBack}>Back</Btn>
      </div>
    </div>
  );
}

// The one real card-payment surface — mounts Stripe Elements against an
// already-created PaymentIntent's clientSecret, styled to match DVURE's
// own type/color system via the Appearance API. Any caller that has a
// clientSecret (RecordPaymentModal today) renders this directly rather
// than reaching into Stripe/Elements itself.
export default function CardPaymentStep({ clientSecret, grossAmount, platformFeePct, platformFeeAmount, totalAmount, onDone, onBack }: {
  clientSecret: string; grossAmount: number; platformFeePct: number; platformFeeAmount: number; totalAmount: number; onDone: () => void; onBack: () => void;
}) {
  return (
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
      <ConfirmStep grossAmount={grossAmount} platformFeePct={platformFeePct} platformFeeAmount={platformFeeAmount} totalAmount={totalAmount} onBack={onBack} onDone={onDone}/>
    </Elements>
  );
}
