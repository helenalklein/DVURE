-- Real bug found by testing 0034 live: Zara Okafor's card went from
-- "Boutique: IMG Models" to "Boutique: None" instead of "Boutique:
-- Kindred Talent". The relationship row updated correctly, but
-- organizations_select (0002) never had a path for a brand to see an
-- agency merely linked (mother or boutique) to a model who submitted
-- to one of their campaigns — IMG only ever worked because it also
-- happened to have a brand_agency_partnerships row with Acne Studios.
-- Kindred Talent doesn't (a boutique isn't who a brand distributes a
-- campaign to), so the join silently returned null and the UI's own
-- fallback ("Boutique: None") papered over what should have been
-- visible data — not a fluke of this one org, a structural gap that'd
-- hit any boutique agency without a direct brand partnership.
create policy organizations_select_via_submission on organizations for select using (
  exists (
    select 1
    from agency_model_relationships amr
    join submissions s on s.model_id = amr.model_id
    join campaigns c on c.id = s.campaign_id
    where amr.agency_org_id = organizations.id
      and c.brand_org_id = my_org_id()
  )
);
