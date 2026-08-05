-- Acne Studios (Marcus Webb) is the primary brand account used to
-- exercise every brand-side feature in this build, not a throwaway
-- demo org — but every org defaults to verification_status='unverified'
-- (0015) with no self-service escalation path (0019 deliberately closed
-- that off; verifying an org is an ops-only action by design). Without
-- this, getAccessGate() correctly-but-unhelpfully blocks messaging and
-- payments for the one account meant to demonstrate full functionality.
update organizations
set verification_status = 'verified',
    subscription_status = 'active'
where name = 'Acne Studios';
