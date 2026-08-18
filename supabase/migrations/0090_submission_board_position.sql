-- Real drag-to-reorder within a Model Board column (Submitted/Hold) —
-- previously dropping a card back into the same column did nothing
-- visible, since nothing tracked where within the column it should
-- sit. board_position is that ordering, persisted per submission so a
-- manual arrangement survives a reload instead of resetting to
-- whatever order the query happened to return.
--
-- Backfilled by created_at, spaced by 100 per campaign+stage bucket —
-- existing boards start in their current, already-familiar order
-- rather than shuffling on first load, and the gaps leave room for
-- future inserts to land on the midpoint between two neighbors
-- without needing to renumber the whole column.
-- numeric, not integer — repeatedly dropping onto the same spot keeps
-- halving the gap to its neighbor (100, 150, 175, 187.5, ...), which an
-- integer column would eventually round away into a collision.
alter table submissions add column board_position numeric;

update submissions s set board_position = sub.rn * 100
from (
  select id, row_number() over (partition by campaign_id, stage order by created_at) as rn
  from submissions
) sub
where s.id = sub.id;
