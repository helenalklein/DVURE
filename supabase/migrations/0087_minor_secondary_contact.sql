-- A 16/17-year-old reasonably wants to be reachable too, even though
-- the guardian stays the account holder and the only one who can sign
-- a contract -- that doesn't change here. This is purely an optional,
-- informational second contact point on file (e.g. so a crew
-- coordinating a shoot day can text the model directly), not a second
-- login and not anything that grants signing authority.
alter table model_profiles add column if not exists secondary_email text;
alter table model_profiles add column if not exists secondary_phone text;

-- New params appended to the end don't collide with the 0086 version's
-- signature as far as Postgres's overload resolution is concerned, but
-- would leave it defined as a separate, now-dead overload if not
-- explicitly dropped first.
drop function if exists set_model_intake_details(uuid, text, text, text, text);

create or replace function set_model_intake_details(
  p_model_id uuid,
  p_sex text default null,
  p_guardian_name text default null,
  p_guardian_email text default null,
  p_guardian_relationship text default null,
  p_secondary_email text default null,
  p_secondary_phone text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from agency_model_relationships
    where model_id = p_model_id and agency_org_id = my_org_id() and status = 'active'
  ) then
    raise exception 'No active relationship with this model.';
  end if;

  update model_profiles set
    sex = coalesce(p_sex, sex),
    guardian_name = coalesce(nullif(trim(p_guardian_name), ''), guardian_name),
    guardian_email = coalesce(nullif(trim(p_guardian_email), ''), guardian_email),
    guardian_relationship = coalesce(nullif(trim(p_guardian_relationship), ''), guardian_relationship),
    secondary_email = coalesce(nullif(trim(p_secondary_email), ''), secondary_email),
    secondary_phone = coalesce(nullif(trim(p_secondary_phone), ''), secondary_phone)
  where id = p_model_id;
end;
$$;

revoke all on function set_model_intake_details(uuid, text, text, text, text, text, text) from public;
grant execute on function set_model_intake_details(uuid, text, text, text, text, text, text) to authenticated;
