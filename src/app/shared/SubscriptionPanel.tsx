import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Btn, Badge, DvureWordmark } from "./ui";
import { useAuth } from "./auth";
import AddCardStep from "./AddCardStep";
import {
  listSubscriptionPlan, createSubscription, createSetupIntent, listPaymentMethods,
  type SubscriptionPlan, type SavedCard,
} from "../../lib/queries/stripe";

function money(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });
}

const STATUS_BADGE: Record<string, { label: string; variant: "success"|"warning"|"info"|"default" }> = {
  active: { label: "Active", variant: "success" },
  trialing: { label: "On free trial", variant: "info" },
  past_due: { label: "Payment past due", variant: "warning" },
  canceled: { label: "Canceled", variant: "default" },
};

// Shared between BrandApp and AgencyApp's Settings, but only agencies
// actually pay a DVURE platform subscription — a brand's only real cost
// on DVURE is the campaign payments they make to models/agencies
// (invoices), which is where DVURE's platform fee is already collected.
// A "Brand Pilot Subscription" Stripe price exists from an earlier,
// incorrect assumption that brands would pay too; it's never called
// from here now (this component short-circuits before ever hitting
// list-subscription-plan for a brand org) — safe to archive in the
// Stripe dashboard whenever, nothing in the app references it anymore.
export default function SubscriptionPanel() {
  const { org, refreshIdentity } = useAuth();
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addCardSecret, setAddCardSecret] = useState<string | null>(null);
  const [addCardLoading, setAddCardLoading] = useState(false);

  const isBrand = org?.orgType === "brand";

  async function reloadCards() {
    setCardsLoading(true);
    const { cards: fetched } = await listPaymentMethods();
    setCards(fetched);
    setCardsLoading(false);
  }

  useEffect(() => {
    if (isBrand) { setPlanLoading(false); setCardsLoading(false); return; }
    listSubscriptionPlan().then(({ plan, error }) => { setPlan(plan); setPlanError(error); setPlanLoading(false); });
    reloadCards();
  }, [isBrand]);

  if (isBrand) {
    return (
      <div className="glass-subtle border rounded-md p-5 text-sm text-muted-foreground">
        DVURE doesn't charge brands a platform subscription. Your only cost is taxes and fees, already included when you pay a model or agency through a project.
      </div>
    );
  }

  // organizations.subscription_status defaults to "trialing" for every
  // org from signup (0014) — that's also the only state where a
  // subscription genuinely hasn't been created yet, so it's what gates
  // whether the Subscribe flow shows at all vs. a status summary.
  const alreadySubscribed = org?.subscriptionStatus && org.subscriptionStatus !== "trialing";

  async function startAddCard() {
    setError(null);
    setAddCardLoading(true);
    const { clientSecret, error: err } = await createSetupIntent();
    setAddCardLoading(false);
    if (err || !clientSecret) { setError(err ?? "Couldn't start card setup."); return; }
    setAddCardSecret(clientSecret);
  }

  async function handleSubscribe() {
    if (cards.length === 0) { startAddCard(); return; }
    setSubscribing(true);
    setError(null);
    const { error: err } = await createSubscription(cards[0].id);
    setSubscribing(false);
    if (err) { setError(err); return; }
    await refreshIdentity();
  }

  const orgLabel = org?.orgType === "agency" ? "Agency" : "Brand";
  const statusInfo = org?.subscriptionStatus ? STATUS_BADGE[org.subscriptionStatus] : undefined;

  if (planLoading || cardsLoading) {
    return <div className="text-sm text-muted-foreground py-6">Loading…</div>;
  }

  if (addCardSecret) {
    return (
      <div className="glass-subtle border rounded-md p-5 space-y-3">
        <div className="text-sm font-semibold">Add a card to subscribe</div>
        <AddCardStep
          clientSecret={addCardSecret}
          onCancel={() => setAddCardSecret(null)}
          onDone={async () => { setAddCardSecret(null); await reloadCards(); }}
        />
      </div>
    );
  }

  if (addCardLoading) {
    return <div className="glass-subtle border rounded-md p-5 text-sm text-muted-foreground text-center py-10">Preparing secure card form…</div>;
  }

  if (!plan) {
    return (
      <div className="glass-subtle border border-dashed rounded-md p-5 text-sm text-muted-foreground">
        {planError ?? `The ${orgLabel} Pilot Subscription isn't set up in Stripe yet — check back soon.`}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="glass-subtle border rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold"><DvureWordmark size={11}/> {orgLabel}</div>
            <div className="text-xs text-muted-foreground">{plan.productName}{plan.interval ? ` · Billed ${plan.interval}ly` : ""}</div>
          </div>
          <div className="flex items-center gap-1.5">
            {org?.foundingMember && <Badge label="Founding Member" variant="info"/>}
            {statusInfo && <Badge label={statusInfo.label} variant={statusInfo.variant}/>}
          </div>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm">
          {[
            ["Plan", plan.productName],
            [plan.interval ? `${plan.interval[0].toUpperCase()}${plan.interval.slice(1)}ly price` : "Price", money(plan.unitAmount, plan.currency)],
            ...(org?.trialEndsAt ? [["Trial ends", new Date(org.trialEndsAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-border last:border-0 pb-3 last:pb-0">
              <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
            </div>
          ))}
          {org?.foundingMember && (
            <div className="text-[10px] text-muted-foreground bg-secondary rounded-md px-3 py-2">
              As a founding member, this rate is locked in for your organization even after pricing changes for new agencies.
            </div>
          )}
        </div>
      </div>

      {!alreadySubscribed && (
        <div className="space-y-2">
          {error && <div className="text-xs text-[#C0392B]">{error}</div>}
          <Btn variant="primary" disabled={subscribing} onClick={handleSubscribe}>
            {subscribing
              ? <span className="flex items-center gap-1.5"><Loader2 size={13} className="animate-spin"/> Subscribing…</span>
              : cards.length === 0 ? "Add a card to subscribe" : `Subscribe · ${money(plan.unitAmount, plan.currency)}/${plan.interval ?? "mo"}`}
          </Btn>
          {cards.length > 0 && (
            <div className="text-[10px] text-muted-foreground">Charged to your saved {cards[0].brand.toUpperCase()} card ending {cards[0].last4}.</div>
          )}
        </div>
      )}
    </div>
  );
}
