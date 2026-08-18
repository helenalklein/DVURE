-- Two-phase campaign finalization: while submissions are open, the Model
-- Board stays the 3-column Submitted/Hold/Booked kanban. Once finalized
-- (manually, or automatically finalization_hours after submission_close),
-- every remaining Submitted-stage candidate is auto-declined and the
-- board becomes a clean, permanent, label-free view of Booked models —
-- Hold-stage (contract-pending) people are untouched and keep landing on
-- that clean board live as they sign, finalized or not.
alter table campaigns add column finalization_hours integer;
alter table campaigns add column board_finalized_at timestamptz;

alter table organizations add column default_finalization_hours integer not null default 48;

-- board_finalized_at must only ever change through finalize_campaign_board
-- / auto_finalize_campaign_boards below (security definer, both run the
-- auto-decline in the same transaction as the flag) — never a raw client
-- write, which could set the flag without actually declining anyone.
-- campaigns otherwise has a blanket authenticated grant (0007), so this
-- has to be explicitly carved back out, same shape as payment_locked
-- (0061) being service_role-only on organizations.
revoke update (board_finalized_at) on campaigns from authenticated;

-- finalization_hours (per-campaign override) and default_finalization_hours
-- (org default) are ordinary settings a brand admin/enhanced staffer can
-- edit directly — campaigns already grants this broadly; organizations
-- needs the same one-column carve-out logo_url got in 0048.
grant update (default_finalization_hours) on organizations to authenticated;

-- Shared by both the manual "Finalize" button and the hourly cron sweep
-- below — idempotent (a second call on an already-finalized campaign is
-- a no-op) so neither caller has to worry about racing the other.
create or replace function finalize_campaign_board(p_campaign_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_brand_org_id uuid;
  v_already_finalized boolean;
begin
  select brand_org_id, board_finalized_at is not null
    into v_brand_org_id, v_already_finalized
    from campaigns where id = p_campaign_id;

  if v_brand_org_id is null then
    raise exception 'finalize_campaign_board: campaign % not found', p_campaign_id;
  end if;
  if v_brand_org_id is distinct from my_org_id() then
    raise exception 'finalize_campaign_board: caller does not belong to this campaign''s brand org';
  end if;
  if my_access_level() not in ('administrator', 'enhanced') then
    raise exception 'finalize_campaign_board: insufficient access level';
  end if;
  if v_already_finalized then
    return;
  end if;

  update campaigns set board_finalized_at = now() where id = p_campaign_id;

  -- "submitted" and "candidate" are the same untriaged bucket everywhere
  -- else in the app (Moodboard's Submitted column, campaigns.ts's tile
  -- counts) — shortlisted/selected (Hold) and booked are left alone.
  update submissions set
    stage = 'declined',
    decline_reason = 'Auto-declined: campaign board finalized',
    reviewed_at = now(),
    updated_at = now()
  where campaign_id = p_campaign_id and stage in ('submitted', 'candidate');
end;
$$;

revoke all on function finalize_campaign_board(uuid) from public;
grant execute on function finalize_campaign_board(uuid) to authenticated;

-- Cron-only sweep — no caller session to check my_org_id() against, so
-- this scans every campaign directly instead of taking a single id.
-- Deadline = submission_close + (this campaign's own override, or its
-- brand's org-wide default) hours.
create or replace function auto_finalize_campaign_boards()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
begin
  select array_agg(c.id) into v_ids
  from campaigns c
  join organizations o on o.id = c.brand_org_id
  where c.board_finalized_at is null
    and c.submission_close is not null
    and now() > c.submission_close + make_interval(hours => coalesce(c.finalization_hours, o.default_finalization_hours));

  if v_ids is null then
    return;
  end if;

  update campaigns set board_finalized_at = now() where id = any(v_ids);

  update submissions set
    stage = 'declined',
    decline_reason = 'Auto-declined: campaign board finalized',
    reviewed_at = now(),
    updated_at = now()
  where campaign_id = any(v_ids) and stage in ('submitted', 'candidate');
end;
$$;

revoke all on function auto_finalize_campaign_boards() from public;
grant execute on function auto_finalize_campaign_boards() to service_role;

create extension if not exists pg_cron;
-- Hourly, not daily like lock_overdue_accounts (0061) -- a 48h-scale
-- deadline needs finer precision than a 90-day one does.
select cron.schedule('auto-finalize-campaign-boards-hourly', '5 * * * *', $$select auto_finalize_campaign_boards();$$);
