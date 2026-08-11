import { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Check, Loader2 } from "lucide-react";
import { Btn } from "../shared/ui";
import { getStripe } from "../../lib/stripeClient";

// Same shape as CardPaymentStep — mounts inside <Elements> against a
// SetupIntent's clientSecret instead of a PaymentIntent's, so it's
// confirmSetup here rather than confirmPayment. No amount to show; this
// only ever saves the card, it never moves money.
function ConfirmStep({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  async function handleConfirm() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    setSubmitting(false);
    if (confirmError) {
      setError(confirmError.message ?? "Couldn't save this card.");
      return;
    }
    if (setupIntent?.status === "succeeded") {
      setSucceeded(true);
      setTimeout(onDone, 1200);
    } else {
      setError("Couldn't save this card — please try again.");
    }
  }

  if (succeeded) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <div className="w-12 h-12 rounded-full bg-foreground text-primary-foreground flex items-center justify-center">
          <Check size={22} />
        </div>
        <div className="text-sm font-semibold">Card saved</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PaymentElement options={{ wallets: { link: "never" } }} />
      {error && <div className="text-xs text-[#C0392B]">{error}</div>}
      <div className="flex gap-2">
        <Btn variant="primary" disabled={!stripe || submitting} onClick={handleConfirm}>
          {submitting ? <span className="flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Saving…</span> : "Save Card"}
        </Btn>
        <Btn variant="outline" disabled={submitting} onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

export default function AddCardStep({ clientSecret, onDone, onCancel }: {
  clientSecret: string; onDone: () => void; onCancel: () => void;
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
      <ConfirmStep onDone={onDone} onCancel={onCancel}/>
    </Elements>
  );
}
