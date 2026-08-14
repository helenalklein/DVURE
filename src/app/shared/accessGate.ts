import type { OrgInfo } from "./auth";

export type GateReason = "unverified" | "trial_expired" | null;

export interface AccessGate {
  gated: boolean;
  reason: GateReason;
}

// Brands don't pay a platform subscription — DVURE monetizes brand
// activity through the transaction fee on bookings instead (see
// DEFAULT_PLATFORM_PCT in bookings.ts), so a brand org is simply never
// gated here. This is deliberately narrower than partner-invite access
// (see has_partner_access() in 0035_partner_invites.sql), which still
// requires a brand to be identity-verified — that's a separate,
// abuse-prevention check enforced server-side, not this general gate.
//
// Verification is a hard gate for agencies regardless of trial status —
// an unverified agency can look around, but can't touch money, invite
// anyone, or add teammates. Once verified, the trial covers full
// access on its own; only after trial_ends_at passes without an
// active paid subscription does payment become the second gate.
// "Operate within the system" (browsing, drafting) is never blocked —
// this only governs the specific actions callers explicitly check it
// for (payments, invites, add-user), not general read access.
export function getAccessGate(org: OrgInfo | undefined): AccessGate {
  if (!org) return { gated: false, reason: null };

  if (org.orgType === "brand") return { gated: false, reason: null };

  if (org.verificationStatus !== "verified") return { gated: true, reason: "unverified" };

  if (org.subscriptionStatus === "active") return { gated: false, reason: null };

  if (org.subscriptionStatus === "trialing" && org.trialEndsAt && new Date(org.trialEndsAt) > new Date()) {
    return { gated: false, reason: null };
  }

  return { gated: true, reason: "trial_expired" };
}
