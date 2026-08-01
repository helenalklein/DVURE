-- Two real authorization gaps found in a review prompted by an upcoming
-- paid pilot — both are "an org can escalate its own privileges," not
-- cross-tenant leaks (a broader read across every SELECT policy found no
-- case where one org can read another's private data), but both are
-- exploitable today via a direct authenticated REST call, no UI needed.

-- ─── GAP 1: an org can self-verify and self-activate its own billing ────
-- organizations_update (0002_rls.sql) only restricts WHICH row an admin
-- can touch (their own), not WHICH COLUMNS — and organizations never got
-- the column-level grant restriction profiles did (0002_rls.sql: "column-
-- level GRANT/REVOKE is the robust way to make a column immutable
-- regardless of RLS"). Concretely: any org's own administrator can PATCH
-- their own organizations row via the normal authenticated REST API and
-- set verification_status='verified', subscription_status='active',
-- extend trial_ends_at indefinitely, or fabricate a stripe_customer_id —
-- fully bypassing getAccessGate()'s entire point (payments/messaging
-- blocked until verified + paid). This is the exact mechanism the access
-- gate exists to enforce, so it's the most important fix in this file.
--
-- Only `name` is left self-editable (a legitimate "rename my company"
-- ability). Everything else — org_type, status, verification_status,
-- subscription_status, trial_ends_at, stripe_customer_id,
-- stripe_subscription_id — becomes RPC-only (complete_org_signup and
-- future security-definer verification/billing-webhook functions run as
-- the function owner and bypass GRANT/RLS, same as every other
-- RPC-gated write in this schema).
revoke update on organizations from authenticated;
grant update (name) on organizations to authenticated;

-- ─── GAP 2: an agency can forge its own submission's review outcome ─────
-- submissions_update_agency's USING clause required reviewed_at is null,
-- but its WITH CHECK didn't re-assert that (or restrict `stage`) on the
-- resulting row — so within that same allowed window, an agency could
-- set stage='approved'/'booked' and/or reviewed_at themselves on their
-- own submission, self-forging a brand's approval before any brand ever
-- looked at it. No app code path does this today (updateSubmissionStage
-- in submissions.ts is brand-only), so this closes an unused-but-present
-- hole rather than fixing a live bug.
drop policy submissions_update_agency on submissions;
create policy submissions_update_agency on submissions for update using (
  submitting_agency_id = my_org_id() and reviewed_at is null and stage = 'submitted'
) with check (
  submitting_agency_id = my_org_id() and reviewed_at is null and stage = 'submitted'
);
