-- Two real gaps found while checking why a brand's real campaigns looked
-- empty/broken: (1) model_profiles.photo_url was never populated for the
-- 12 models seeded in 0028 — Talent had no photo field at all until this
-- session's BrandApp/submissions.ts changes added one, so every card
-- rendered the generic "no image" placeholder regardless of real vs mock
-- data; (2) none of the 12 models had ever actually been submitted to any
-- of Vellani's 3 real campaigns, so Submissions/Moodboard was correctly
-- showing empty, not broken — there was just nothing real to show yet.
-- Also drops "Spring Draft Test", an empty leftover draft campaign with
-- zero distributions/submissions/bookings (confirmed before writing this).
--
-- Photos use pravatar.cc — real face photos, a well-established free
-- placeholder-photo service with no attribution/licensing concerns for
-- dev/demo use, standard practice for exactly this kind of seed data.
do $$
declare
  v_marcus uuid;
  v_diana uuid;
  v_priya uuid;
  v_sophie uuid;
  v_aw25 uuid;
  v_holiday uuid;
  v_winter uuid;
  v_row record;
begin
  delete from campaigns c using organizations o
  where o.id = c.brand_org_id and o.name = 'Vellani' and c.name = 'Spring Draft Test';

  update model_profiles set photo_url = 'https://i.pravatar.cc/400?img=' || img
  from (values
    ('elena.marsh92@example.com', 47), ('jordan.vale@example.com', 12), ('talia.reyes01@example.com', 44), ('owen.blackwood@example.com', 13),
    ('camille.fontaine@example.com', 45), ('mateo.rousseau@example.com', 14), ('ingrid.solberg@example.com', 48), ('rafael.duarte7@example.com', 15),
    ('freya.ashworth@example.com', 49), ('kai.nakamura@example.com', 16), ('delphine.moreau3@example.com', 43), ('theo.whitfield@example.com', 17)
  ) as t(email, img)
  where model_profiles.email = t.email;

  select id into v_marcus from profiles where email = 'marcus@acnestudios.example';
  select id into v_diana from profiles where email = 'diana@meridianmodels.example';
  select id into v_priya from profiles where email = 'priya@solenne.example';
  select id into v_sophie from profiles where email = 'sophie@vantagemodels.example';
  select c.id into v_aw25 from campaigns c join organizations o on o.id = c.brand_org_id where o.name = 'Vellani' and c.name = 'AW25 Womenswear Campaign';
  select c.id into v_holiday from campaigns c join organizations o on o.id = c.brand_org_id where o.name = 'Vellani' and c.name = 'Holiday 2026 Lookbook';
  select c.id into v_winter from campaigns c join organizations o on o.id = c.brand_org_id where o.name = 'Vellani' and c.name = 'Winter Editorial 2026';

  for v_row in
    select * from (values
      -- campaign,   model email,                    agency staff,  stage
      (v_aw25,    'elena.marsh92@example.com',    v_diana,  'submitted'),
      (v_aw25,    'jordan.vale@example.com',      v_diana,  'approved'),
      (v_aw25,    'freya.ashworth@example.com',   v_sophie, 'booked'),
      (v_aw25,    'kai.nakamura@example.com',     v_sophie, 'submitted'),
      (v_holiday, 'talia.reyes01@example.com',    v_diana,  'submitted'),
      (v_holiday, 'camille.fontaine@example.com', v_priya,  'approved'),
      (v_holiday, 'delphine.moreau3@example.com', v_sophie, 'submitted'),
      (v_winter,  'owen.blackwood@example.com',   v_diana,  'approved'),
      (v_winter,  'mateo.rousseau@example.com',   v_priya,  'submitted'),
      (v_winter,  'ingrid.solberg@example.com',   v_priya,  'booked'),
      (v_winter,  'theo.whitfield@example.com',   v_sophie, 'submitted')
    ) as t(campaign_id, model_email, staff_id, stage)
  loop
    insert into submissions (
      campaign_id, model_id, submitting_agency_id, submitted_by_profile_id,
      stage, rate_quoted, reviewed_by_profile_id, reviewed_at
    )
    select
      v_row.campaign_id, mp.id, amr.agency_org_id, v_row.staff_id,
      v_row.stage::submission_stage, mp.default_day_rate,
      case when v_row.stage in ('approved', 'booked') then v_marcus end,
      case when v_row.stage in ('approved', 'booked') then now() end
    from model_profiles mp
    join agency_model_relationships amr on amr.model_id = mp.id
    where mp.email = v_row.model_email;
  end loop;
end $$;
