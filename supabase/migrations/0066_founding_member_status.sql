-- Founding-member status — every agency that subscribes during the
-- pilot keeps its current rate forever, even after a later price
-- increase. This was already decided (see the user's explicit "include
-- them" instruction on 2026-08-14 during the branch reconciliation) but
-- never actually landed in main — this migration is purely additive and
-- safe to run regardless of current state (backfills every EXISTING
-- agency as a founding member, matching that instruction).
--
-- Deliberately does NOT touch complete_org_signup() to auto-set this for
-- future signups yet — main's own version of that function has grown
-- real logic since the original (seed campaign creation, subscription
-- defaults) that this migration's author hasn't seen the current text
-- of, and a blind `create or replace` risks silently reverting whatever
-- main added later. That part needs the live function definition first
-- (same pattern as the earlier complete_org_signup fix this session —
-- paste `select pg_get_functiondef('complete_org_signup'::regproc)`).
alter table organizations add column if not exists founding_member boolean not null default false;

update organizations set founding_member = true where org_type = 'agency' and founding_member = false;
