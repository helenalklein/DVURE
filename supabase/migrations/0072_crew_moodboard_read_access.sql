-- Crew (any tier my_call_sheet_role() grants — producer/creative
-- director, department lead, or plain assigned crew) gets read access
-- to the Model Board, per direct instruction: "no one on crew side
-- needs payments... they definitely need access to the mood board and
-- crew board + call sheet." Crew/Call Sheet already worked for crew
-- (my_call_sheet_role() gates both). Moodboard didn't: submissions is
-- brand+agency-only, and PostgREST evaluates each embedded table's RLS
-- independently, so widening submissions_select alone wouldn't have
-- been enough — the embedded organizations/profiles/model_profiles
-- rows would still resolve to null for a crew caller (the same class
-- of bug 0068/0069 already found and fixed for shoot_days/call_sheets).
-- A single security-definer RPC sidesteps all of that at once, same
-- pattern as fetch_call_sheet_shoot_days.
--
-- Read-only by design — crew never had any write path to submissions
-- and this doesn't add one. Financial fields (invoices, payment
-- status) live on entirely separate tables this RPC never touches.
create or replace function fetch_campaign_submissions_for_crew(p_campaign_id uuid)
returns table (
  model_id uuid,
  full_name text,
  photo_url text,
  location text,
  default_day_rate numeric,
  height text,
  bust text,
  waist text,
  dress text,
  experience text,
  stage submission_stage,
  rate_quoted numeric,
  notes text,
  brand_score smallint,
  submitting_agency_name text
)
language plpgsql security definer set search_path = public as $$
begin
  if my_call_sheet_role(p_campaign_id) is null then
    return;
  end if;

  return query
    select
      mp.id, mp.full_name, mp.photo_url, mp.location, mp.default_day_rate,
      mp.height, mp.bust, mp.waist, mp.dress, mp.experience,
      s.stage, s.rate_quoted, s.notes, s.brand_score,
      o.name
    from submissions s
    join model_profiles mp on mp.id = s.model_id
    left join organizations o on o.id = s.submitting_agency_id
    where s.campaign_id = p_campaign_id;
end;
$$;

revoke all on function fetch_campaign_submissions_for_crew(uuid) from public;
grant execute on function fetch_campaign_submissions_for_crew(uuid) to authenticated;
