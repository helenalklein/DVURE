import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Btn, FieldLabel } from "./ui";
import { confirmInvoicePayment, type ManualPaymentMethod, type PendingConfirmation } from "../../lib/queries/payments";
import { createNoncircumventionInvoice } from "../../lib/queries/stripe";

const MANUAL_METHOD_LABEL: Record<ManualPaymentMethod, string> = { check: "Check", wire: "Wire", cash: "Cash" };

// Shared by Agency, Model, and Crew — each just supplies its own
// payee-scoped fetch (fetchPendingConfirmationsForAgency/Model/Crew).
// Confirming here is the payee's own attestation that money actually
// arrived, gated behind a typed-name signature (required server-side by
// confirm_invoice_payment itself, not just this form) rather than a
// bare button tap, since this is what triggers DVURE's non-circumvention
// invoice on the brand.
export default function PaymentConfirmQueue({ fetchPending }: { fetchPending: () => Promise<PendingConfirmation[]> }) {
  const [pending, setPending] = useState<PendingConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [signTarget, setSignTarget] = useState<PendingConfirmation | null>(null);

  async function reload() {
    setLoading(true);
    setPending(await fetchPending());
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  if (loading || pending.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Awaiting your confirmation</div>
      {pending.map(p=>(
        <div key={p.paymentId} className="glass-subtle border border-[#D4A017]/30 bg-[#D4A017]/5 rounded-md p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{p.campaignName}</div>
            <div className="text-xs text-muted-foreground">{MANUAL_METHOD_LABEL[p.method]}{p.referenceNote ? ` · ${p.referenceNote}` : ""}</div>
          </div>
          <div className="font-mono text-sm font-semibold shrink-0">${p.amount.toLocaleString()}</div>
          <Btn variant="primary" size="sm" onClick={()=>setSignTarget(p)}>Confirm Received</Btn>
        </div>
      ))}
      {signTarget && (
        <SignatureModal payment={signTarget} onClose={()=>setSignTarget(null)} onDone={()=>{ setSignTarget(null); reload(); }}/>
      )}
    </div>
  );
}

function SignatureModal({ payment, onClose, onDone }: { payment: PendingConfirmation; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [attested, setAttested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = name.trim().length > 1 && attested;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await confirmInvoicePayment(payment.paymentId, name.trim());
    if (err) { setSubmitting(false); setError(err); return; }
    // Best-effort, same tier as audit logging — the confirmation itself
    // already succeeded either way. Bills DVURE's platform fee via a
    // real Stripe Invoice, since no charge exists to collect it from
    // directly (no-ops for card/ach, which collect the fee in-charge).
    createNoncircumventionInvoice(payment.paymentId).then(({ error }) => {
      if (error) console.error("Non-circumvention invoice failed:", error);
    });
    setSubmitting(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-card border border-border rounded-md w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="text-heading text-sm">Confirm receipt</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={16}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-sm">
            You're confirming you received <span className="font-mono font-semibold">${payment.amount.toLocaleString()}</span> via {MANUAL_METHOD_LABEL[payment.method]} for <span className="font-medium">{payment.campaignName}</span>.
          </div>
          <div>
            <FieldLabel>Type your full legal name to sign</FieldLabel>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Jane Doe" autoFocus
              className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground"/>
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={attested} onChange={e=>setAttested(e.target.checked)} className="mt-0.5 shrink-0"/>
            <span className="text-xs text-muted-foreground leading-relaxed">
              By typing my name above and checking this box, I'm confirming I actually received this payment. This is my electronic signature.
            </span>
          </label>
          {error && <div className="text-xs text-red-500">{error}</div>}
          <Btn variant="primary" fullWidth disabled={!canSubmit || submitting} onClick={handleSubmit}>
            {submitting ? "Confirming…" : "Confirm & Sign"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
