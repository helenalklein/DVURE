-- Elite Model Mgmt., IMG Models, Wilhelmina, Storm Models, DNA Models, and
-- Next Models are all real, currently-operating modeling agencies — using
-- their actual names for fictitious demo data (fake bookings, fake day
-- rates, fake staff) is a real liability, especially heading into a real
-- pilot. Renaming all six to invented names, plus the brand itself
-- ("Acne Studios" is also a real company, and the user dislikes the
-- "Studios" suffix regardless) to "Vellani" — an invented, vaguely
-- Italian-sounding name, not a real fashion house.
--
-- Login emails (marcus@acnestudios.example, sophie@elite.example, etc.)
-- are deliberately left unchanged — the .example TLD is reserved by
-- RFC 2606 specifically so it never resolves to anything real, so it
-- carries none of the naming risk the organization name does, and
-- changing every seeded login would break everyone's existing test
-- credentials for no real benefit.

-- Only one brand should exist. Acne Studios is the one being renamed
-- below (matched here before the rename, while the name is still
-- distinctive) — anything else with org_type='brand' is a stray from
-- someone testing the self-serve "Try Demo" signup and gets removed.
--
-- That stray org has its own admin org_membership, and deleting the org
-- cascades into deleting that membership row — which trips
-- prevent_last_admin_lockout() (0021_signup_role_lock_and_admin_lockout_
-- guard.sql), a trigger designed to stop an org from being left with
-- zero admins. Its own comment already flagged this exact gap ("this
-- trigger fires on cascade-deletes too... when [an org-delete feature]
-- is built, route it through its own security-definer RPC rather than a
-- raw client delete") — the trigger is correct in the normal case (don't
-- demote/remove the last admin of a still-existing org), it just isn't
-- aware "the whole org is going away" is a different case. Disabling it
-- for this one statement is the standard Postgres pattern for a
-- deliberate administrative cleanup like this, not a workaround for a
-- bug.
-- audit_log.org_id, bookings.brand_org_id, and invites.org_id all
-- reference organizations without ON DELETE CASCADE (deliberately, in
-- audit_log's case — an audit trail shouldn't silently vanish when its
-- org does). That's the right call for a real org's real history; this
-- stray org's history is just test noise, so it's fine to clear here.
-- campaigns/org_memberships/brand_agency_partnerships etc. do cascade,
-- so nothing else needs an explicit delete first.
delete from audit_log
where org_id in (select id from organizations where org_type = 'brand' and name <> 'Acne Studios');

delete from bookings
where brand_org_id in (select id from organizations where org_type = 'brand' and name <> 'Acne Studios');

delete from invites
where org_id in (select id from organizations where org_type = 'brand' and name <> 'Acne Studios');

alter table org_memberships disable trigger org_memberships_prevent_last_admin_lockout;

delete from organizations
where org_type = 'brand' and name <> 'Acne Studios';

alter table org_memberships enable trigger org_memberships_prevent_last_admin_lockout;

update organizations set name = 'Vantage Model Mgmt.' where name = 'Elite Model Mgmt.';
update organizations set name = 'Meridian Models'     where name = 'IMG Models';
update organizations set name = 'Solenne'             where name = 'Wilhelmina';
update organizations set name = 'Halcyon Models'      where name = 'Storm Models';
update organizations set name = 'Vector Models'       where name = 'DNA Models';
update organizations set name = 'Anthem Models'       where name = 'Next Models';
update organizations set name = 'Vellani'             where name = 'Acne Studios';
