-- Fixes a real gap found while verifying the brand's Moodboard: brand
-- staff could see a submission and the model's own profile (model_profiles
-- already grants brand visibility for any model they've received a
-- submission for), but NOT the model's agency_model_relationships rows —
-- so the "Mother: / Boutique:" fields on every candidate card had nothing
-- to read, since agency_model_relationships_select (0002_rls.sql) only
-- allows the model themself or the specific agency in that relationship,
-- never the brand. This mirrors the same "brand can see it if they've
-- received a submission for this model" clause model_profiles_select
-- already uses.

create policy agency_model_relationships_select_brand on agency_model_relationships for select using (
  exists (
    select 1 from submissions s
    where s.model_id = agency_model_relationships.model_id and is_campaigns_brand(s.campaign_id)
  )
);
