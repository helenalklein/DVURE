import type { OrgInfo } from "./auth";

export type GateReason = "unverified" | "trial_expired" | "payment_locked" | null;

export interface AccessGate {
  gated: boolean;
  reason: GateReason;
}

// Verification is a hard gate regardless of trial status — an
// unverified org can look around, but can't touch money, invite
// anyone, or add teammates. payment_locked (an overdue non-circumvention
// fee invoice, 90+ days unpaid — lock_overdue_accounts) is checked first
// and unconditionally, since it's a harder stop than the others: real
// money is owed, not just an account-standing issue. "Operate within
// the system" (browsing, drafting) is never blocked — this only governs
// the specific actions callers explicitly check it for (payments,
// invites, add-user), not general read access.
//
// Brands never pay a DVURE platform subscription — only agencies do.
// A brand's own campaign payments to models/agencies flow through
// invoices, not a subscription, and that's DVURE's actual revenue
// from brands. So the trial/subscription gate below only ever applies
// to agencies; a verified brand is never blocked on subscription
// grounds, trial expired or not.
export function getAccessGate(org: OrgInfo | undefined): AccessGate {
  if (!org) return { gated: false, reason: null };

  if (org.paymentLocked) return { gated: true, reason: "payment_locked" };

  if (org.verificationStatus !== "verified") return { gated: true, reason: "unverified" };

  if (org.orgType === "brand") return { gated: false, reason: null };

  if (org.subscriptionStatus === "active") return { gated: false, reason: null };

  if (org.subscriptionStatus === "trialing" && org.trialEndsAt && new Date(org.trialEndsAt) > new Date()) {
    return { gated: false, reason: null };
  }

  return { gated: true, reason: "trial_expired" };
}

// A separate, single-purpose check — not folded into getAccessGate
// above, which is a different-shaped gate already shared by three
// unrelated reasons (payment/verification/trial) across several
// call sites. This one governs exactly two actions: creating a project
// and sending a contract (the latter already enforced inside
// ContractModal itself, which can't send with zero templates to choose
// from) — never general browsing, matching this app's existing gate
// philosophy. Agencies/models never see this; only a brand needs to
// pick a template before using their account for real work.
export function needsContractTemplate(org: OrgInfo | undefined): boolean {
  return !!org && org.orgType === "brand" && !org.defaultContractTemplateId;
}
