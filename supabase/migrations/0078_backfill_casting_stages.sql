-- Backfill existing rows onto the new casting-stage vocabulary from
-- 0077. Separate migration because the new enum values can't be used
-- in the same transaction they were added in.
--
-- approved -> selected: "approved" was always the single gate right
-- before booking in this app's actual workflow (Model Board's
-- Submitted -> Approved -> Booked columns), which maps to "selected"
-- in the spec's Candidate/Submitted/Shortlisted/Selected/Booked/
-- Declined/Released list, not "shortlisted" (an earlier narrowing step
-- that's new -- no existing rows use it, nothing needs backfilling
-- into it).
-- rejected -> declined: direct equivalent, brand actively passed on
-- the candidate.
update submissions set stage = 'selected' where stage = 'approved';
update submissions set stage = 'declined' where stage = 'rejected';
