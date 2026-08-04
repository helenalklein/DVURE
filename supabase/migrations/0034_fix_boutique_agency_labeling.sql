-- 0003_seed.sql labeled IMG Models — a real, massive global agency — as
-- a "boutique" agency for Zara Okafor, purely as an RLS test fixture
-- (verifying a linked-but-non-submitting agency correctly sees nothing).
-- That was fine for testing RLS in isolation, but it reads as a factual
-- error in the actual product: IMG is not a boutique agency by any
-- reasonable definition. Swaps that relationship onto a real fictional
-- boutique agency instead, and adds two more so the roster has real
-- variety beyond one.

-- organizations.name has no unique constraint, so guard manually rather
-- than an ON CONFLICT clause that has nothing to key off.
insert into organizations (org_type, name)
select 'agency', v.name
from (values ('Kindred Talent'), ('Nomad Models'), ('Bloom Agency')) as v(name)
where not exists (select 1 from organizations o where o.name = v.name);

update agency_model_relationships
set agency_org_id = (select id from organizations where name = 'Kindred Talent')
where agency_org_id = (select id from organizations where name = 'IMG Models')
  and relationship_type = 'boutique';
