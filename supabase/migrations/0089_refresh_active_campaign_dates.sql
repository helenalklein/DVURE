-- Demo/pitch refresh: active + draft campaigns have been sitting still
-- while real calendar time keeps moving, so their due dates, submission
-- windows, shoot days, etc. have drifted into "why is this overdue"
-- territory. Shifts every date-bearing field tied to a non-archived
-- campaign forward by one shared delta (computed from how far the
-- earliest one has drifted, not hardcoded) so the whole set reads as
-- currently in progress again — relative spacing between campaigns is
-- preserved, only archived (real, completed) campaigns are left alone
-- as genuine history.
do $$
declare
  v_days int;
begin
  select (current_date - min(due_date)) + 3 into v_days
  from campaigns
  where status in ('active', 'drafts') and due_date is not null;

  if v_days is null or v_days <= 0 then
    raise notice 'Nothing to shift — no active/draft campaign is overdue.';
    return;
  end if;

  raise notice 'Shifting active/draft campaign dates forward by % days', v_days;

  update campaigns set
    due_date = due_date + v_days,
    submission_open = submission_open + make_interval(days => v_days),
    submission_close = submission_close + make_interval(days => v_days)
  where status in ('active', 'drafts');

  update shoot_days sd set event_date = sd.event_date + v_days
  from campaigns c
  where sd.campaign_id = c.id and c.status in ('active', 'drafts');

  update castings ca set event_date = ca.event_date + v_days
  from campaigns c
  where ca.campaign_id = c.id and c.status in ('active', 'drafts');

  update bookings b set shoot_date = b.shoot_date + v_days
  from campaigns c
  where b.campaign_id = c.id and c.status in ('active', 'drafts') and b.shoot_date is not null;

  update deliverables d set due_date = d.due_date + v_days
  from campaigns c
  where d.campaign_id = c.id and c.status in ('active', 'drafts') and d.due_date is not null;

  update contracts ct set
    sent_at = ct.sent_at + make_interval(days => v_days),
    executed_at = ct.executed_at + make_interval(days => v_days)
  from campaigns c
  where ct.campaign_id = c.id and c.status in ('active', 'drafts');

  update campaign_submission_extensions cse set new_close_date = cse.new_close_date + make_interval(days => v_days)
  from campaigns c
  where cse.campaign_id = c.id and c.status in ('active', 'drafts');

  -- A submission_close pushed back into the future can leave a board
  -- that already auto-finalized (0088) looking stuck in a "finalized"
  -- state that now contradicts its own (also-pushed) window — clear it
  -- so the finalize cron just re-evaluates against the refreshed dates.
  update campaigns set board_finalized_at = null
  where status in ('active', 'drafts') and board_finalized_at is not null;
end $$;
