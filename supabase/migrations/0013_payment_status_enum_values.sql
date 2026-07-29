-- Split into its own migration deliberately: ALTER TYPE ... ADD VALUE
-- cannot be used in the same transaction that later references the new
-- value (Postgres rejects it — the new value isn't visible until the
-- adding transaction commits). Since each migration file typically runs
-- as one statement/transaction, 0014 (which needs 'failed'/'refunded'
-- in a CASE expression) has to land in a separate migration that runs
-- after this one commits.
alter type payment_status add value 'failed';
alter type payment_status add value 'refunded';
