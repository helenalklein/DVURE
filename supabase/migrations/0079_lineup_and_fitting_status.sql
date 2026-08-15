-- Runway: Lineup (walk order + cues) and Fitting status on Looks.
-- Both are planning/static data, not day-of live tracking, so neither
-- is Relay scope -- same bucket as Looks itself (0075). Extends the
-- existing looks table rather than a new one: Lineup is the same rows
-- as Looks, viewed through a different lens (sequence/choreography
-- instead of garment/styling assignment), matching the shared-entity
-- principle from the project spec (one Project, workflow/UI differs).
create type fitting_status as enum ('not_scheduled', 'scheduled', 'complete');

alter table looks add column fitting_status fitting_status not null default 'not_scheduled';
alter table looks add column quick_change_note text;
alter table looks add column music_cue text;
alter table looks add column lighting_cue text;
alter table looks add column backstage_note text;
