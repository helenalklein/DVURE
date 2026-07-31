-- Universal audit trail. Insert-only by design — no update/delete
-- policy exists anywhere below, and never should: a log that can be
-- edited after the fact isn't an audit trail. Every field from the
-- spec is here; ip_address/user_agent/auth_method/session_id are
-- best-effort extractions from the request's own JWT and headers
-- (see record_audit_event() below) — verify these actually populate
-- against this project's real PostgREST/auth configuration once live
-- traffic runs through it, since exact header/claim availability can
-- vary by Supabase project setup.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(), -- timestamptz is always stored/read as UTC
  actor_profile_id uuid references profiles(id),
  org_id uuid references organizations(id),
  campaign_id uuid references campaigns(id),
  object_type text,
  object_id uuid,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  auth_method text,
  session_id text,
  request_id uuid,
  geographic_region text,
  artifact_hash text
);
create index audit_log_actor_idx on audit_log (actor_profile_id);
create index audit_log_org_idx on audit_log (org_id);
create index audit_log_campaign_idx on audit_log (campaign_id);
create index audit_log_object_idx on audit_log (object_type, object_id);
create index audit_log_occurred_at_idx on audit_log (occurred_at);
create index audit_log_action_idx on audit_log (action);

alter table audit_log enable row level security;
-- No policies at all yet, deliberately — not even a read policy.
-- Reads go through a narrow, scoped query function once there's an
-- actual audit-viewing surface (e.g. "this org's own history" or an
-- internal admin tool), not a broad audit_log_select policy that
-- would let any authenticated user browse the whole table.

-- Single universal entry point — every write path that needs auditing
-- calls this, so the shape of an audit row is defined once, not
-- reimplemented per feature. Security definer since callers (other
-- security-definer functions AND authenticated clients directly) need
-- to write here despite audit_log having no INSERT policy of its own.
-- request.headers/jwt claims are read defensively (wrapped so a
-- missing claim never blocks the action being audited from completing
-- — a failed audit-detail extraction should degrade to a null field,
-- not an exception that blocks the underlying action).
create or replace function record_audit_event(
  p_action text,
  p_object_type text default null,
  p_object_id uuid default null,
  p_campaign_id uuid default null,
  p_previous_value jsonb default null,
  p_new_value jsonb default null,
  p_request_id uuid default null,
  p_artifact_hash text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_org_id uuid;
  v_headers json;
  v_jwt json;
begin
  select org_id into v_org_id from org_memberships where profile_id = auth.uid();

  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := null;
  end;

  begin
    v_jwt := auth.jwt();
  exception when others then
    v_jwt := null;
  end;

  insert into audit_log (
    actor_profile_id, org_id, campaign_id, object_type, object_id, action,
    previous_value, new_value, ip_address, user_agent, auth_method, session_id,
    request_id, artifact_hash
  ) values (
    auth.uid(), v_org_id, p_campaign_id, p_object_type, p_object_id, p_action,
    p_previous_value, p_new_value,
    nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), '')::inet,
    v_headers->>'user-agent',
    v_jwt -> 'amr' -> 0 ->> 'method',
    v_jwt ->> 'session_id',
    p_request_id,
    p_artifact_hash
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function record_audit_event(text, text, uuid, uuid, jsonb, jsonb, uuid, text) from public;
grant execute on function record_audit_event(text, text, uuid, uuid, jsonb, jsonb, uuid, text) to authenticated;

-- Wire into the two write paths that are already real, security-definer
-- RPCs today — this is genuine, guaranteed, can't-be-skipped coverage,
-- unlike a client remembering to call record_audit_event separately.

create or replace function complete_org_signup(p_org_name text, p_org_type org_type)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_role profile_role;
  v_org_id uuid;
begin
  select role into v_role from profiles where id = auth.uid();

  if v_role is null then
    raise exception 'complete_org_signup: no profile found for current user';
  end if;

  if v_role not in ('brand_staff', 'agency_staff') then
    raise exception 'complete_org_signup: role % cannot create an organization', v_role;
  end if;

  if (v_role = 'brand_staff' and p_org_type <> 'brand') or (v_role = 'agency_staff' and p_org_type <> 'agency') then
    raise exception 'complete_org_signup: org_type % does not match role %', p_org_type, v_role;
  end if;

  if exists (select 1 from org_memberships where profile_id = auth.uid()) then
    raise exception 'complete_org_signup: caller already belongs to an organization';
  end if;

  insert into organizations (org_type, name, trial_ends_at, subscription_status)
  values (p_org_type, p_org_name, now() + interval '14 days', 'trialing')
  returning id into v_org_id;

  insert into org_memberships (profile_id, org_id, access_level)
  values (auth.uid(), v_org_id, 'administrator');

  if p_org_type = 'brand' then
    insert into campaigns (brand_org_id, name, type, status, due_date, submission_open, submission_close, talent_needed, budget, created_by_profile_id)
    select v_org_id, t.name, t.type, t.status, current_date + t.due_offset_days,
           now() + (t.submission_open_offset_days || ' days')::interval,
           now() + (t.submission_close_offset_days || ' days')::interval,
           t.talent_needed, t.budget, auth.uid()
    from (
      (select * from campaign_templates where type = 'Campaign' order by random() limit 1)
      union all
      (select * from campaign_templates where type = 'Runway' order by random() limit 1)
      union all
      (select * from campaign_templates where type = 'Event' order by random() limit 1)
    ) t;
  end if;

  perform record_audit_event('org.created', 'organization', v_org_id, null, null, jsonb_build_object('org_type', p_org_type, 'name', p_org_name));

  return v_org_id;
end;
$$;

create or replace function record_payment_attempt(
  p_booking_id uuid,
  p_amount numeric,
  p_status transaction_status,
  p_stripe_payment_intent_id text default null,
  p_stripe_charge_id text default null,
  p_failure_reason text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_payment_id uuid;
  v_brand_org_id uuid;
  v_campaign_id uuid;
  v_caller_org_id uuid;
  v_prev_status transaction_status;
begin
  select brand_org_id, campaign_id into v_brand_org_id, v_campaign_id from bookings where id = p_booking_id;
  if v_brand_org_id is null then
    raise exception 'record_payment_attempt: booking % not found', p_booking_id;
  end if;

  select org_id into v_caller_org_id from org_memberships where profile_id = auth.uid();
  if v_caller_org_id is distinct from v_brand_org_id then
    raise exception 'record_payment_attempt: caller does not belong to this booking''s brand org';
  end if;

  select status into v_prev_status from payments where booking_id = p_booking_id order by created_at desc limit 1;

  insert into payments (booking_id, amount, status, stripe_payment_intent_id, stripe_charge_id, failure_reason, authorized_by_profile_id)
  values (p_booking_id, p_amount, p_status, p_stripe_payment_intent_id, p_stripe_charge_id, p_failure_reason, auth.uid())
  returning id into v_payment_id;

  update bookings set payment_status = case p_status
    when 'succeeded' then 'paid'::payment_status
    when 'failed' then 'failed'::payment_status
    when 'refunded' then 'refunded'::payment_status
    when 'processing' then 'processing'::payment_status
    else 'pending'::payment_status
  end
  where id = p_booking_id;

  perform record_audit_event(
    'payment.attempt_recorded', 'payment', v_payment_id, v_campaign_id,
    case when v_prev_status is null then null else jsonb_build_object('status', v_prev_status) end,
    jsonb_build_object('status', p_status, 'amount', p_amount, 'booking_id', p_booking_id)
  );

  return v_payment_id;
end;
$$;
