-- Per-org secret token for the "subscribe in Apple/Google Calendar" .ics
-- feed. The feed endpoint (supabase/functions/ics-feed) has no
-- interactive session to check — calendar apps just poll a URL on their
-- own schedule — so the token itself is the credential, the same
-- private "secret address" pattern Google/Apple's own calendar exports
-- use. Not sensitive enough to warrant admin-only column access beyond
-- what organizations_update's row-level policy (0002/0019) already
-- requires: any admin of the org can regenerate it, matching the
-- existing self-editable `name` column precedent from 0019.
alter table organizations add column calendar_feed_token uuid not null default gen_random_uuid();
grant update (calendar_feed_token) on organizations to authenticated;
