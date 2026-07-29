-- Own migration for the same reason as 0013 — a new enum value can't be
-- referenced in the same transaction that adds it. 0017 (which sets
-- role = 'crew' inside handle_new_user()) has to land after this commits.
alter type profile_role add value 'crew';
