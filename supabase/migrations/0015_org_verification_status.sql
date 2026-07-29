-- Distinct from org_status (active/suspended — an admin moderation
-- lever). verification_status is the KYB gate: whether this org has
-- been confirmed as a real registered business (Middesk or similar,
-- wired in separately once that integration exists). 'unverified' is
-- the default for every new signup — nothing here runs verification
-- automatically yet, this is the column the future check writes to.
create type verification_status as enum ('unverified', 'pending', 'verified', 'failed');

alter table organizations
  add column verification_status verification_status not null default 'unverified';
