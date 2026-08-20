-- A day rate has always been a flat number set once at contract
-- creation, never revisited (contracts.ts: createContract sets day_rate,
-- nothing ever updates it after). This adds a real negotiation log —
-- messages and counter-offers — plus the read access an agency needs to
-- actually participate: confirmed directly that contracts has NO agency
-- policy at all today (0032/0083 only ever granted brand + the model
-- their own contract), so an agency currently can't see a contract even
-- exists. That's a real, separate gap this migration also closes,
-- additively (0093/0095's established pattern — a second permissive
-- policy, never touching the existing brand/model ones).

-- An agency can read the contract for any model they submitted to that
-- campaign — mirrors campaigns_select's own agency branch (0002) rather
-- than inventing a new relationship check.
create policy contracts_select_agency on contracts for select using (
  exists (
    select 1 from submissions s
    where s.campaign_id = contracts.campaign_id
      and s.model_id = contracts.model_id
      and s.submitting_agency_id = my_org_id()
  )
);

create table rate_negotiations (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  author_profile_id uuid references profiles(id),
  author_role text not null check (author_role in ('brand','agency','model')),
  kind text not null check (kind in ('message','offer','accept')),
  amount numeric,              -- set for kind in ('offer','accept'); null for plain messages
  text text,                   -- optional note, any kind
  created_at timestamptz not null default now()
);
create index rate_negotiations_contract_idx on rate_negotiations (contract_id);

alter table rate_negotiations enable row level security;

-- Deliberately a plain subquery against contracts, not a security-
-- definer helper — contracts_select_agency above (plus the pre-existing
-- contracts_select/contracts_select_own_model) already encodes exactly
-- the three parties who should see a negotiation thread, so leaning on
-- contracts' own RLS here means this table's policy can't drift out of
-- sync with who can actually see the contract itself.
create policy rate_negotiations_select on rate_negotiations for select using (
  exists (select 1 from contracts c where c.id = contract_id)
);
create policy rate_negotiations_insert on rate_negotiations for insert with check (
  exists (select 1 from contracts c where c.id = contract_id)
  and author_profile_id = auth.uid()
);

-- Append-only — a negotiation log is a record of what was said/offered
-- when, not something anyone should be able to edit or erase after the
-- fact.
grant select, insert on rate_negotiations to authenticated;

-- notifications has no direct insert grant for `authenticated` at all
-- (0065) — every existing notification is either trigger- or RPC-
-- inserted. Mirrors notify_campaign_distributed's own reasoning
-- (comment above it, 0065): a trigger on the insert itself means the
-- agency can never miss a brand's offer because some client code path
-- forgot to also write a notification. Model-side: no parallel
-- notification channel exists anywhere in this app (models aren't
-- org-scoped, which is what notifications is keyed on) — the thread
-- itself, surfaced in ContractsView, is where a model finds out.
create or replace function notify_rate_negotiation()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_agency_org_id uuid;
  v_model_name text;
  v_campaign_id uuid;
  v_brand_name text;
  v_summary text;
begin
  if new.author_role <> 'brand' then
    return new;
  end if;

  select s.submitting_agency_id, c.campaign_id, mp.full_name, o.name
    into v_agency_org_id, v_campaign_id, v_model_name, v_brand_name
  from contracts c
  join submissions s on s.campaign_id = c.campaign_id and s.model_id = c.model_id
  join model_profiles mp on mp.id = c.model_id
  join campaigns cam on cam.id = c.campaign_id
  join organizations o on o.id = cam.brand_org_id
  where c.id = new.contract_id
  limit 1;

  if v_agency_org_id is null then
    return new;
  end if;

  v_summary := case
    when new.kind = 'offer' then coalesce(v_brand_name, 'The brand') || ' offered $' || new.amount || '/day for ' || coalesce(v_model_name, 'your model')
    when new.kind = 'accept' then coalesce(v_brand_name, 'The brand') || ' agreed to $' || new.amount || '/day for ' || coalesce(v_model_name, 'your model')
    else coalesce(v_brand_name, 'The brand') || ' sent a message about ' || coalesce(v_model_name, 'your model') || '''s rate'
  end;

  insert into notifications (org_id, type, title, body, campaign_id)
  values (v_agency_org_id, 'rate_negotiation', v_summary, new.text, v_campaign_id);

  return new;
end;
$$;

create trigger rate_negotiations_notify after insert on rate_negotiations
for each row execute function notify_rate_negotiation();

-- Accepting an offer needs to write contracts.day_rate — but
-- contracts_write (0032) restricts UPDATE to the brand's own
-- administrator/enhanced members, and agencies/models have no update
-- grant on contracts at all. A model or agency accepting the brand's
-- offer (or the brand accepting a model/agency counter) is a completely
-- legitimate action for any of the three parties, so this is a single
-- security-definer path all three go through — re-validates the caller
-- is actually a party to this contract server-side (same posture as
-- sign_contract_as_model, 0083) rather than trusting the client, and
-- keeps "record the acceptance" + "move the live rate" atomic instead
-- of two separate client-side writes that could partially fail.
create or replace function accept_rate_offer(p_contract_id uuid, p_amount numeric, p_document_html text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role profile_role;
  v_campaign_id uuid;
  v_model_id uuid;
  v_authorized boolean;
begin
  select role into v_role from profiles where id = auth.uid();
  select campaign_id, model_id into v_campaign_id, v_model_id from contracts where id = p_contract_id;

  if v_campaign_id is null then
    raise exception 'accept_rate_offer: contract not found';
  end if;

  v_authorized := is_campaigns_brand(v_campaign_id)
    or v_model_id = my_model_id()
    or exists (
      select 1 from submissions s
      where s.campaign_id = v_campaign_id and s.model_id = v_model_id and s.submitting_agency_id = my_org_id()
    );
  if not v_authorized then
    raise exception 'accept_rate_offer: not a party to this contract';
  end if;

  insert into rate_negotiations (contract_id, author_profile_id, author_role, kind, amount)
  values (
    p_contract_id, auth.uid(),
    case when is_campaigns_brand(v_campaign_id) then 'brand' when v_model_id = my_model_id() then 'model' else 'agency' end,
    'accept', p_amount
  );

  update contracts set day_rate = p_amount, document_html = coalesce(p_document_html, document_html) where id = p_contract_id;
end;
$$;

revoke all on function accept_rate_offer(uuid, numeric, text) from public;
grant execute on function accept_rate_offer(uuid, numeric, text) to authenticated;
