import type { OrgInfo } from "./auth";

export type GateReason = "unverified" | "trial_expired" | "payment_locked" | null;

export interface AccessGate {
  gated: boolean;
  reason: GateReason;
}

// Verification is a hard gate regardless of trial status — an
// unverified org can look around, but can't touch money, invite
// anyone, or add teammates. Once verified, the trial covers full
// access on its own; only after trial_ends_at passes without an
// active paid subscription does payment become the second gate.
// payment_locked (an overdue non-circumvention fee invoice, 90+ days
// unpaid — lock_overdue_accounts) checked first and unconditionally,
// since it's a harder stop than the other two: real money is owed,
// not just an account-standing issue. "Operate within the system"
// (browsing, drafting) is never blocked — this only governs the
// specific actions callers explicitly check it for (payments,
// invites, add-user), not general read access.
export function getAccessGate(org: OrgInfo | undefined): AccessGate {
  if (!org) return { gated: false, reason: null };

  if (org.paymentLocked) return { gated: true, reason: "payment_locked" };

  if (org.verificationStatus !== "verified") return { gated: true, reason: "unverified" };

  if (org.subscriptionStatus === "active") return { gated: false, reason: null };

  if (org.subscriptionStatus === "trialing" && org.trialEndsAt && new Date(org.trialEndsAt) > new Date()) {
    return { gated: false, reason: null };
  }

  return { gated: true, reason: "trial_expired" };
}
