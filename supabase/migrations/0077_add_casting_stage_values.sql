-- Widening submission_stage from 4 values (submitted/approved/rejected/
-- booked) to the fuller casting pipeline from the project spec:
-- candidate, submitted, shortlisted, selected, booked, declined,
-- released. Old values submitted->submitted and booked->booked are
-- unchanged; approved->selected and rejected->declined is the intended
-- rename (done via data backfill in 0078, not here).
--
-- Deliberately using ADD VALUE (in-place, same type OID) rather than
-- the rename-old-type/create-new-type/cast-column dance used for
-- campaign_type in 0017. Two RPCs that write to submissions --
-- submit_talent and create_booking -- aren't in this migration history
-- (missing file, confirmed via full-repo search) so their exact bodies
-- can't be verified from here. ADD VALUE never changes the type's OID,
-- so any function anywhere that references submission_stage by name --
-- visible or not -- keeps resolving to the exact same type without
-- needing to be recreated. The rename-dance would have silently broken
-- fetch_campaign_submissions_for_crew (0072's RETURNS TABLE (stage
-- submission_stage, ...) binds by OID at CREATE FUNCTION time) and
-- possibly the two unverifiable RPCs too -- not worth the risk for a
-- purely additive change. approved/rejected stay valid-but-unused
-- enum members going forward (easier to remove later once fully
-- confirmed dead than to have guessed wrong here).
--
-- Postgres can't use a value added by ALTER TYPE ... ADD VALUE inside
-- the same transaction it was added in, so the actual backfill
-- (UPDATE ... SET stage = 'selected' ...) is a separate migration,
-- 0078, not appended here.
alter type submission_stage add value 'candidate' before 'submitted';
alter type submission_stage add value 'shortlisted' after 'submitted';
alter type submission_stage add value 'selected' after 'shortlisted';
alter type submission_stage add value 'declined';
alter type submission_stage add value 'released';
