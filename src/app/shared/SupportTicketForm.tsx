import { useState } from "react";
import { Check } from "lucide-react";
import { Btn, FieldLabel, TextInput, Textarea, FSelect } from "./ui";
import { submitSupportTicket, type SupportTicketCategory } from "../../lib/queries/support";

const CATEGORY_LABELS: { label: string; value: SupportTicketCategory }[] = [
  { label: "Delete my organization", value: "delete_organization" },
  { label: "Billing", value: "billing" },
  { label: "Something's not working", value: "bug" },
  { label: "Other", value: "other" },
];

// Real ticket submission, not a mailto link dressed up — lands in
// support_tickets for a human (Helena) to follow up on directly; no
// help center/FAQ, that's explicitly out of scope for now. Org deletion
// routes through here on purpose rather than a self-service delete
// button — a person reviews it before anything is torn down.
export default function SupportTicketForm({ defaultCategory }: { defaultCategory?: SupportTicketCategory }) {
  const [categoryLabel, setCategoryLabel] = useState(
    CATEGORY_LABELS.find(c => c.value === defaultCategory)?.label ?? CATEGORY_LABELS[0].label
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    const category = CATEGORY_LABELS.find(c => c.label === categoryLabel)?.value ?? "other";
    setSubmitting(true);
    setError(null);
    const { error: err } = await submitSupportTicket(category, subject, message);
    setSubmitting(false);
    if (err) { setError(err); return; }
    setSent(true);
    setSubject("");
    setMessage("");
  }

  return (
    <div className="glass-subtle border rounded-md p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold">Contact Support</div>
        <div className="text-xs text-muted-foreground">
          We'll follow up by email. For anything urgent, reach us directly at <span className="text-foreground font-medium">support@dvure.com</span>.
        </div>
      </div>
      <FSelect label="What's this about?" options={CATEGORY_LABELS.map(c => c.label)} value={categoryLabel} onChange={setCategoryLabel}/>
      <div>
        <FieldLabel>Subject</FieldLabel>
        <TextInput placeholder="e.g. Please delete our organization" value={subject} onChange={e=>setSubject(e.target.value)}/>
      </div>
      <div>
        <FieldLabel>Message</FieldLabel>
        <Textarea placeholder="Give us the details — the more context, the faster we can help." rows={4} value={message} onChange={e=>setMessage(e.target.value)}/>
      </div>
      {error && <div className="text-xs text-urgent bg-urgent/5 border border-urgent rounded-md px-3 py-2">{error}</div>}
      {sent && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Check size={12}/> Sent — we'll be in touch.</div>}
      <Btn variant="primary" size="sm" disabled={!subject || !message || submitting} onClick={handleSubmit}>
        {submitting ? "Sending…" : "Submit"}
      </Btn>
    </div>
  );
}
