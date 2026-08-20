-- organizations has never had a real address column — nothing in the
-- schema or signup flow ever captured one, despite the brand contract
-- template having a {{brand_address}} tag that's been permanently blank
-- since it was introduced (0097). org_memberships.title has existed
-- since 0001 and is already editable post-signup (Settings → Team,
-- BrandApp.tsx), but complete_org_signup() has only ever inserted
-- (profile_id, org_id, access_level) — title stays null forever unless a
-- human fills it in afterward. Both are now required at signup so a
-- brand's own contract signature block can auto-fill real values instead
-- of asking every sender to type their name/title into a blank template.

alter table organizations add column address text;

-- Deliberately a NEW, separate RPC rather than `create or replace
-- function complete_org_signup(...)` — that function has grown real
-- logic since its 0004/0010/0014/0017/0018 history (trial defaults, seed
-- campaign creation) that this migration's author hasn't seen the live
-- text of (same caution 0066 already documented for the same function —
-- "a blind create or replace risks silently reverting whatever main
-- added later"). This call runs client-side immediately after
-- complete_org_signup() succeeds, as a second, independent, additive
-- step — it only ever writes two specific columns on rows the caller
-- just created (org_memberships.profile_id = auth.uid() is always
-- exactly the org they just provisioned), so it can't touch anyone
-- else's data regardless of what complete_org_signup's current body
-- does or doesn't do.
create or replace function set_signup_title_and_address(p_title text, p_org_address text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from org_memberships where profile_id = auth.uid();
  if v_org_id is null then
    raise exception 'set_signup_title_and_address: caller has no organization yet';
  end if;

  update org_memberships set title = p_title where profile_id = auth.uid();
  update organizations set address = p_org_address where id = v_org_id;
end;
$$;

revoke all on function set_signup_title_and_address(text, text) from public;
grant execute on function set_signup_title_and_address(text, text) to authenticated;
