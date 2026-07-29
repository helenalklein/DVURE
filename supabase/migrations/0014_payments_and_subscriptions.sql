-- Part A: a real transaction ledger. Today bookings.payment_status is a
-- single enum column with no history and nothing to hang a Stripe id
-- on — it can't represent "declined, then retried, then succeeded" or
-- a later refund. payments is that ledger: one row per charge attempt
-- against a booking, mirroring Stripe's own PaymentIntent status
-- vocabulary 1:1 so the future webhook handler can just map statuses
-- across without translation. bookings.payment_status stays as the
-- coarse "is this booking paid" summary a list view actually wants;
-- record_payment_attempt() below is what keeps the two in sync, rather
-- than a trigger, matching how the rest of this schema favors explicit
-- RPCs over implicit trigger side effects.
create type transaction_status as enum (
  'pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded'
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  amount numeric not null,
  currency text not null default 'usd',
  status transaction_status not null default 'pending',
  stripe_payment_intent_id text,
  stripe_charge_id text,
  failure_reason text,
  authorized_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_booking_idx on payments (booking_id);
create index payments_stripe_pi_idx on payments (stripe_payment_intent_id);

-- Single entry point for recording a charge attempt and keeping
-- bookings.payment_status in lockstep — called by the client today with
-- a manufactured status (no Stripe yet), and by the future webhook
-- handler once real PaymentIntents exist. Security definer because
-- payments has no direct-write policy of its own (see below); callers
-- still need a real org relationship to the booking, checked here
-- rather than via RLS on this table.
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
  v_caller_org_id uuid;
begin
  select brand_org_id into v_brand_org_id from bookings where id = p_booking_id;
  if v_brand_org_id is null then
    raise exception 'record_payment_attempt: booking % not found', p_booking_id;
  end if;

  select org_id into v_caller_org_id from org_memberships where profile_id = auth.uid();
  if v_caller_org_id is distinct from v_brand_org_id then
    raise exception 'record_payment_attempt: caller does not belong to this booking''s brand org';
  end if;

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

  return v_payment_id;
end;
$$;

revoke all on function record_payment_attempt(uuid, numeric, transaction_status, text, text, text) from public;
grant execute on function record_payment_attempt(uuid, numeric, transaction_status, text, text, text) to authenticated;

-- No table-level policies on payments (same posture as invites/
-- model_profiles/campaign_guest_access) — every write goes through
-- record_payment_attempt() above; reads go through a narrow query
-- function once the Payments screens are wired to this table, not a
-- broad payments_select policy.
alter table payments enable row level security;

-- Part C: trial/subscription state. Every org (brand or agency — the
-- signup modal's own "14-day free trial" copy already promises this to
-- both) gets a trial clock started the moment complete_org_signup()
-- creates it. The actual Stripe subscription object doesn't exist
-- until Stripe is wired in — stripe_customer_id/stripe_subscription_id
-- stay null until then; a gate reading trial_ends_at/subscription_status
-- can be built against this today without waiting on that.
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

alter table organizations
  add column trial_ends_at timestamptz,
  add column subscription_status subscription_status not null default 'trialing',
  add column stripe_customer_id text,
  add column stripe_subscription_id text;

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
    select
      v_org_id,
      t.name,
      t.type,
      t.status,
      current_date + t.due_offset_days,
      now() + (t.submission_open_offset_days || ' days')::interval,
      now() + (t.submission_close_offset_days || ' days')::interval,
      t.talent_needed,
      t.budget,
      auth.uid()
    from campaign_templates t
    order by random()
    limit 3;
  end if;

  return v_org_id;
end;
$$;
