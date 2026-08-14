-- Consolidated schema baseline, replacing every migration numbered 0027
-- and above from both this branch and main. Two independent development
-- tracks reused the same version numbers for entirely different work
-- after this branch forked from main at 208d9c4 — main's own 0027-0064
-- (crew persistent login variants, contracts/shoot_days/castings,
-- independent models, the full payments/Stripe subsystem) were applied
-- directly via SQL at some point outside the CLI's own tracking, while
-- this branch's 0027-0032 (representation relationships, campaign
-- territory, multi-agency submissions, model documents) were pushed
-- through it — so the live database has always held the union of both,
-- but no single migration file sequence, from either side, could
-- reproduce that union from a fresh database.
--
-- This file is a full schema-only dump of the actual live database as
-- of 2026-08-13 (`supabase db dump`, public + auth-referencing objects,
-- plus `-s storage` for the two custom storage.objects policies below —
-- Supabase's own storage.*/auth.* platform tables are provisioned per
-- project already and aren't recreated here). It IS the real, current,
-- working schema, not a reconstruction from reading old files.
--
-- It opens by dropping and recreating the public schema rather than
-- being appended after 0001-0026: those files already create most base
-- objects (e.g. the original agency_relationship_type enum), and this
-- dump — being a snapshot of the FINAL state — sometimes replaces
-- rather than extends them (that enum doesn't exist in the live
-- database at all anymore; relationship_type is free text now).
-- Computing a precise hand-written delta between "what 0001-0026 built"
-- and "what's actually live today" across 33 tables/44 functions/61
-- policies is exactly the kind of manual reconciliation this baseline
-- exists to replace with something mechanically verified instead: drop
-- everything 0001-0026 built, rebuild it exactly as pg_dump captured it
-- from the real database. Verified end to end by applying 0001-0026 to
-- a fresh local Postgres, dumping that state, diffing it against this
-- live dump to confirm every change was intentional (not a copy/paste
-- gap), then replaying the full 0001-0030 sequence locally start to
-- finish before this ever touched the live database's migration ledger.
drop schema public cascade;
create schema public;
comment on schema public is 'standard public schema';
grant usage on schema public to postgres, anon, authenticated, service_role;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."agency_relationship_status" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."agency_relationship_status" OWNER TO "postgres";


CREATE TYPE "public"."agency_relationship_type" AS ENUM (
    'mother',
    'boutique'
);


ALTER TYPE "public"."agency_relationship_type" OWNER TO "postgres";


CREATE TYPE "public"."campaign_status" AS ENUM (
    'active',
    'drafts',
    'archived'
);


ALTER TYPE "public"."campaign_status" OWNER TO "postgres";


CREATE TYPE "public"."campaign_type" AS ENUM (
    'Campaign',
    'Runway',
    'Event',
    'Other'
);


ALTER TYPE "public"."campaign_type" OWNER TO "postgres";


CREATE TYPE "public"."contract_status" AS ENUM (
    'draft',
    'awaiting_signature',
    'fully_executed'
);


ALTER TYPE "public"."contract_status" OWNER TO "postgres";


CREATE TYPE "public"."crew_discipline" AS ENUM (
    'photographer',
    'director',
    'stylist',
    'hair',
    'makeup_artist',
    'set_designer',
    'retoucher',
    'casting_director',
    'location_scout',
    'gaffer',
    'digital_tech',
    'assistant',
    'other'
);


ALTER TYPE "public"."crew_discipline" OWNER TO "postgres";


CREATE TYPE "public"."crew_role" AS ENUM (
    'hair',
    'makeup',
    'dresser',
    'photographer',
    'production',
    'security',
    'transportation'
);


ALTER TYPE "public"."crew_role" OWNER TO "postgres";


CREATE TYPE "public"."document_category" AS ENUM (
    'headshot',
    'digital',
    'comp_card',
    'portfolio',
    'measurements',
    'bio',
    'other_public',
    'representation_agreement',
    'commission_agreement',
    'amendment',
    'management_agreement',
    'placement_agreement',
    'tax_document',
    'identity_document',
    'other_restricted'
);


ALTER TYPE "public"."document_category" OWNER TO "postgres";


CREATE TYPE "public"."document_visibility" AS ENUM (
    'public',
    'restricted'
);


ALTER TYPE "public"."document_visibility" OWNER TO "postgres";


CREATE TYPE "public"."invite_status" AS ENUM (
    'pending',
    'accepted',
    'expired',
    'revoked'
);


ALTER TYPE "public"."invite_status" OWNER TO "postgres";


CREATE TYPE "public"."invoice_balance_status" AS ENUM (
    'outstanding',
    'partially_paid',
    'paid'
);


ALTER TYPE "public"."invoice_balance_status" OWNER TO "postgres";


CREATE TYPE "public"."membership_access_level" AS ENUM (
    'administrator',
    'enhanced',
    'basic'
);


ALTER TYPE "public"."membership_access_level" OWNER TO "postgres";


CREATE TYPE "public"."membership_status" AS ENUM (
    'invited',
    'active',
    'suspended'
);


ALTER TYPE "public"."membership_status" OWNER TO "postgres";


CREATE TYPE "public"."model_availability" AS ENUM (
    'available',
    'pending',
    'unavailable'
);


ALTER TYPE "public"."model_availability" OWNER TO "postgres";


CREATE TYPE "public"."org_status" AS ENUM (
    'active',
    'suspended'
);


ALTER TYPE "public"."org_status" OWNER TO "postgres";


CREATE TYPE "public"."org_type" AS ENUM (
    'brand',
    'agency'
);


ALTER TYPE "public"."org_type" OWNER TO "postgres";


CREATE TYPE "public"."partnership_status" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."partnership_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_lifecycle_status" AS ENUM (
    'initiated',
    'pending',
    'paid',
    'accepted',
    'failed',
    'refunded',
    'voided',
    'disputed'
);


ALTER TYPE "public"."payment_lifecycle_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'processing',
    'paid',
    'failed',
    'refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."profile_role" AS ENUM (
    'brand_staff',
    'agency_staff',
    'model',
    'crew'
);


ALTER TYPE "public"."profile_role" OWNER TO "postgres";


CREATE TYPE "public"."representation_exclusivity" AS ENUM (
    'exclusive',
    'non_exclusive',
    'limited',
    'not_specified'
);


ALTER TYPE "public"."representation_exclusivity" OWNER TO "postgres";


CREATE TYPE "public"."submission_stage" AS ENUM (
    'submitted',
    'approved',
    'rejected',
    'booked'
);


ALTER TYPE "public"."submission_stage" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."transaction_status" AS ENUM (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'canceled',
    'refunded'
);


ALTER TYPE "public"."transaction_status" OWNER TO "postgres";


CREATE TYPE "public"."verification_status" AS ENUM (
    'unverified',
    'pending',
    'verified',
    'failed'
);


ALTER TYPE "public"."verification_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_new_model_to_roster"("p_full_name" "text", "p_email" "text", "p_location" "text", "p_default_day_rate" numeric, "p_height" "text", "p_experience" "text", "p_date_of_birth" "date", "p_phone" "text", "p_representation_type" "text", "p_is_mother_agency" boolean, "p_territories" "text"[], "p_exclusivity" "public"."representation_exclusivity", "p_effective_start_date" "date", "p_effective_end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("model_id" "uuid", "relationship_id" "uuid", "overlap_warning" "text", "duplicate_confidence" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_model_id uuid;
  v_rel_result record;
  v_dup_confidence text;
begin
  if my_org_type() <> 'agency' or my_access_level() not in ('administrator', 'enhanced') then
    raise exception 'add_new_model_to_roster: not authorized';
  end if;

  select match_confidence into v_dup_confidence
    from check_possible_model_duplicate(p_full_name, p_email, p_phone, p_date_of_birth, p_location)
    limit 1;

  insert into model_profiles (full_name, email, location, default_day_rate, height, experience, date_of_birth, phone)
  values (p_full_name, p_email, p_location, p_default_day_rate, p_height, p_experience, p_date_of_birth, p_phone)
  returning id into v_model_id;

  select * into v_rel_result from create_representation_relationship(
    v_model_id, p_representation_type, p_is_mother_agency, p_territories, p_exclusivity,
    p_effective_start_date, p_effective_end_date
  );

  return query select v_model_id, v_rel_result.relationship_id, v_rel_result.overlap_warning, v_dup_confidence;
end;
$$;


ALTER FUNCTION "public"."add_new_model_to_roster"("p_full_name" "text", "p_email" "text", "p_location" "text", "p_default_day_rate" numeric, "p_height" "text", "p_experience" "text", "p_date_of_birth" "date", "p_phone" "text", "p_representation_type" "text", "p_is_mother_agency" boolean, "p_territories" "text"[], "p_exclusivity" "public"."representation_exclusivity", "p_effective_start_date" "date", "p_effective_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agency_distributed_on"("p_campaign_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from campaign_agency_distributions
    where campaign_id = p_campaign_id and agency_org_id = my_org_id()
  );
$$;


ALTER FUNCTION "public"."agency_distributed_on"("p_campaign_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agency_has_model"("p_model_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from agency_model_relationships
    where model_id = p_model_id and agency_org_id = my_org_id() and status = 'active'
  );
$$;


ALTER FUNCTION "public"."agency_has_model"("p_model_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agency_is_mother"("p_model_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from agency_model_relationships
    where model_id = p_model_id and agency_org_id = my_org_id()
      and is_mother_agency and status = 'active'
  );
$$;


ALTER FUNCTION "public"."agency_is_mother"("p_model_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_call_sheet_role"("p_campaign_id" "uuid", "p_role_key" "text", "p_crew_payee_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_slot_id uuid;
  v_perm text;
begin
  v_perm := my_call_sheet_role(p_campaign_id, p_role_key);
  if v_perm not in ('admin', 'producer', 'lead') then
    raise exception 'assign_call_sheet_role: not authorized for this role';
  end if;

  insert into campaign_crew_slots (campaign_id, role_key, crew_payee_id, assigned_by_profile_id, assigned_at)
  values (p_campaign_id, p_role_key, p_crew_payee_id, auth.uid(), now())
  on conflict (campaign_id, role_key)
    do update set crew_payee_id = excluded.crew_payee_id, assigned_by_profile_id = excluded.assigned_by_profile_id, assigned_at = excluded.assigned_at
  returning id into v_slot_id;

  perform record_audit_event(
    'call_sheet.role_assigned', 'campaign_crew_slot', v_slot_id, p_campaign_id,
    null, jsonb_build_object('role_key', p_role_key, 'crew_payee_id', p_crew_payee_id, 'assigned_by_role', v_perm)
  );

  return v_slot_id;
end;
$$;


ALTER FUNCTION "public"."assign_call_sheet_role"("p_campaign_id" "uuid", "p_role_key" "text", "p_crew_payee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_possible_model_duplicate"("p_full_name" "text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_date_of_birth" "date" DEFAULT NULL::"date", "p_location" "text" DEFAULT NULL::"text") RETURNS TABLE("match_confidence" "text", "existing_model_id" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email text := nullif(lower(btrim(p_email)), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_name text := lower(regexp_replace(btrim(p_full_name), '\s+', ' ', 'g'));
begin
  if v_email is not null then
    return query
      select 'high', mp.id from model_profiles mp
      where lower(mp.email) = v_email
      limit 1;
    if found then return; end if;
  end if;

  if v_phone is not null then
    return query
      select 'high', mp.id from model_profiles mp
      where mp.phone = v_phone
      limit 1;
    if found then return; end if;
  end if;

  if p_date_of_birth is not null then
    return query
      select 'high', mp.id from model_profiles mp
      where mp.date_of_birth = p_date_of_birth
        and similarity(lower(mp.full_name), v_name) > 0.6
      limit 1;
    if found then return; end if;
  end if;

  return query
    select 'high', mp.id from model_profiles mp
    where mp.identity_verification_status = 'verified'
      and similarity(lower(mp.full_name), v_name) > 0.6
    limit 1;
  if found then return; end if;

  return query
    select 'low', null::uuid from model_profiles mp
    where similarity(lower(mp.full_name), v_name) > 0.5
      and (p_location is null or mp.location ilike '%' || split_part(p_location, ',', 1) || '%')
    limit 1;
end;
$$;


ALTER FUNCTION "public"."check_possible_model_duplicate"("p_full_name" "text", "p_email" "text", "p_phone" "text", "p_date_of_birth" "date", "p_location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_call_sheet_role"("p_campaign_id" "uuid", "p_role_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_perm text;
begin
  v_perm := my_call_sheet_role(p_campaign_id, p_role_key);
  if v_perm not in ('admin', 'producer', 'lead') then
    raise exception 'clear_call_sheet_role: not authorized for this role';
  end if;
  update campaign_crew_slots set crew_payee_id = null, is_department_lead = false
  where campaign_id = p_campaign_id and role_key = p_role_key;
end;
$$;


ALTER FUNCTION "public"."clear_call_sheet_role"("p_campaign_id" "uuid", "p_role_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_org_signup"("p_org_name" "text", "p_org_type" "public"."org_type") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."complete_org_signup"("p_org_name" "text", "p_org_type" "public"."org_type") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_invoice_payment"("p_payment_id" "uuid", "p_signature_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invoice_id uuid;
  v_status payment_lifecycle_status;
  v_method text;
  v_my_org uuid := my_org_id();
  v_my_model uuid := my_model_id();
  v_my_crew uuid := my_crew_payee_id();
begin
  if p_signature_name is null or trim(p_signature_name) = '' then
    raise exception 'confirm_invoice_payment: a signature (typed full name) is required';
  end if;

  select invoice_id, status, payment_method into v_invoice_id, v_status, v_method
  from invoice_payments where id = p_payment_id;
  if v_invoice_id is null then
    raise exception 'confirm_invoice_payment: payment % not found', p_payment_id;
  end if;
  if v_method = 'card' then
    raise exception 'confirm_invoice_payment: card payments are not manually confirmed';
  end if;
  if v_status <> 'pending' then
    raise exception 'confirm_invoice_payment: payment is % — only a pending payment can be confirmed', v_status;
  end if;
  if not exists (
    select 1 from invoice_line_items
    where invoice_id = v_invoice_id
      and (payee_org_id = v_my_org or payee_model_id = v_my_model or payee_crew_payee_id = v_my_crew)
  ) then
    raise exception 'confirm_invoice_payment: caller is not a payee on this invoice';
  end if;

  update invoice_payments
  set status = 'accepted', accepted_at = now(), paid_at = now(),
      payee_confirmed_by_profile_id = auth.uid(),
      signature_name = trim(p_signature_name), signature_captured_at = now()
  where id = p_payment_id;
end;
$$;


ALTER FUNCTION "public"."confirm_invoice_payment"("p_payment_id" "uuid", "p_signature_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_model_document"("p_model_id" "uuid", "p_relationship_id" "uuid", "p_visibility" "public"."document_visibility", "p_category" "public"."document_category", "p_file_name" "text", "p_mime_type" "text" DEFAULT NULL::"text", "p_attested_authority" boolean DEFAULT NULL::boolean, "p_attested_upload_rights" boolean DEFAULT NULL::boolean, "p_attested_accurate" boolean DEFAULT NULL::boolean, "p_attested_will_update" boolean DEFAULT NULL::boolean) RETURNS TABLE("document_id" "uuid", "storage_bucket" "text", "storage_path" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_agency_id uuid := my_org_id();
  v_doc_id uuid := gen_random_uuid();
  v_bucket text := case p_visibility when 'public' then 'model-public-assets' else 'model-restricted-docs' end;
  v_path text := p_model_id::text || '/' || v_doc_id::text || '/' || p_file_name;
begin
  if not agency_has_model(p_model_id) then
    raise exception 'create_model_document: your agency has no active relationship with this model';
  end if;
  if p_visibility = 'restricted' and not (
    coalesce(p_attested_authority, false) and coalesce(p_attested_upload_rights, false)
    and coalesce(p_attested_accurate, false) and coalesce(p_attested_will_update, false)
  ) then
    raise exception 'create_model_document: all four attestations are required for restricted documents';
  end if;

  insert into model_documents (
    id, model_id, relationship_id, uploading_agency_org_id, uploaded_by_profile_id, visibility, category,
    storage_bucket, storage_path, file_name, mime_type,
    attested_authority_to_represent, attested_authorized_to_upload_materials, attested_info_accurate,
    attested_will_update_on_change, attested_at, attested_by_profile_id
  ) values (
    v_doc_id, p_model_id, p_relationship_id, v_agency_id, auth.uid(), p_visibility, p_category,
    v_bucket, v_path, p_file_name, p_mime_type,
    p_attested_authority, p_attested_upload_rights, p_attested_accurate, p_attested_will_update,
    case when p_visibility = 'restricted' then now() end,
    case when p_visibility = 'restricted' then auth.uid() end
  );

  perform record_audit_event(
    'document.created', 'model_document', v_doc_id, null,
    null, jsonb_build_object('model_id', p_model_id, 'visibility', p_visibility, 'category', p_category)
  );

  return query select v_doc_id, v_bucket, v_path;
end;
$$;


ALTER FUNCTION "public"."create_model_document"("p_model_id" "uuid", "p_relationship_id" "uuid", "p_visibility" "public"."document_visibility", "p_category" "public"."document_category", "p_file_name" "text", "p_mime_type" "text", "p_attested_authority" boolean, "p_attested_upload_rights" boolean, "p_attested_accurate" boolean, "p_attested_will_update" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_representation_relationship"("p_model_id" "uuid", "p_representation_type" "text", "p_is_mother_agency" boolean, "p_territories" "text"[], "p_exclusivity" "public"."representation_exclusivity", "p_effective_start_date" "date", "p_effective_end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("relationship_id" "uuid", "overlap_warning" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_agency_id uuid := my_org_id();
  v_rel_id uuid;
  v_overlap boolean;
begin
  if my_org_type() <> 'agency' or my_access_level() not in ('administrator', 'enhanced') then
    raise exception 'create_representation_relationship: not authorized';
  end if;

  insert into agency_model_relationships (
    model_id, agency_org_id, relationship_type, is_mother_agency, territories,
    exclusivity, effective_start_date, effective_end_date
  ) values (
    p_model_id, v_agency_id, p_representation_type, p_is_mother_agency, p_territories,
    p_exclusivity, p_effective_start_date, p_effective_end_date
  ) returning id into v_rel_id;

  v_overlap := representation_overlap_exists(
    p_model_id, v_rel_id, v_agency_id, p_territories, p_exclusivity,
    p_effective_start_date, p_effective_end_date
  );

  perform record_audit_event(
    'relationship.created', 'agency_model_relationship', v_rel_id, null,
    null, jsonb_build_object(
      'model_id', p_model_id, 'representation_type', p_representation_type,
      'is_mother_agency', p_is_mother_agency, 'territories', p_territories,
      'exclusivity', p_exclusivity, 'overlap_detected', v_overlap
    )
  );

  return query select v_rel_id,
    case when v_overlap then
      'This model has another active exclusive representation relationship covering one or more of the same territories. Please confirm you are authorized to represent this model here before proceeding.'
    else null end;
end;
$$;


ALTER FUNCTION "public"."create_representation_relationship"("p_model_id" "uuid", "p_representation_type" "text", "p_is_mother_agency" boolean, "p_territories" "text"[], "p_exclusivity" "public"."representation_exclusivity", "p_effective_start_date" "date", "p_effective_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_representation_relationship"("p_relationship_id" "uuid", "p_effective_end_date" "date" DEFAULT CURRENT_DATE) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (
    select 1 from agency_model_relationships
    where id = p_relationship_id and agency_org_id = my_org_id()
  ) or my_access_level() not in ('administrator', 'enhanced') then
    raise exception 'end_representation_relationship: not authorized';
  end if;

  update agency_model_relationships
    set status = 'inactive',
        ended_at = now(),
        effective_end_date = coalesce(effective_end_date, p_effective_end_date)
    where id = p_relationship_id;

  perform record_audit_event(
    'relationship.ended', 'agency_model_relationship', p_relationship_id, null,
    null, jsonb_build_object('effective_end_date', p_effective_end_date)
  );
end;
$$;


ALTER FUNCTION "public"."end_representation_relationship"("p_relationship_id" "uuid", "p_effective_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_org_audit_log"("p_limit" integer DEFAULT 200, "p_before" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("id" "uuid", "occurred_at" timestamp with time zone, "actor_name" "text", "actor_email" "text", "action" "text", "object_type" "text", "object_id" "uuid", "campaign_id" "uuid", "campaign_name" "text", "previous_value" "jsonb", "new_value" "jsonb", "ip_address" "text", "user_agent" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if my_access_level() is distinct from 'administrator' then
    raise exception 'fetch_org_audit_log: administrator access required';
  end if;

  return query
    select al.id, al.occurred_at, p.full_name, p.email, al.action, al.object_type, al.object_id,
           al.campaign_id, c.name, al.previous_value, al.new_value, al.ip_address::text, al.user_agent
    from audit_log al
    left join profiles p on p.id = al.actor_profile_id
    left join campaigns c on c.id = al.campaign_id
    where al.org_id = my_org_id()
      and (p_before is null or al.occurred_at < p_before)
    order by al.occurred_at desc
    limit least(p_limit, 500);
end;
$$;


ALTER FUNCTION "public"."fetch_org_audit_log"("p_limit" integer, "p_before" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invite_by_token"("p_token" "uuid") RETURNS TABLE("invite_id" "uuid", "email" "text", "role" "public"."profile_role", "org_name" "text", "model_full_name" "text", "status" "public"."invite_status", "expires_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select i.id, i.email, i.role, o.name, mp.full_name, i.status, i.expires_at
  from invites i
  left join organizations o on o.id = i.org_id
  left join model_profiles mp on mp.id = i.model_id
  where i.token = p_token;
$$;


ALTER FUNCTION "public"."get_invite_by_token"("p_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invite invites%rowtype;
begin
  if new.raw_user_meta_data ? 'role'
     and (new.raw_user_meta_data->>'role')::profile_role in ('brand_staff', 'agency_staff') then
    insert into profiles (id, role, full_name, email)
    values (new.id, (new.raw_user_meta_data->>'role')::profile_role, new.raw_user_meta_data->>'full_name', new.email);
    return new;
  end if;

  if new.raw_user_meta_data ? 'role'
     and (new.raw_user_meta_data->>'role') = 'model'
     and (new.raw_user_meta_data->>'independent')::boolean is true then
    insert into profiles (id, role, full_name, email)
    values (new.id, 'model', new.raw_user_meta_data->>'full_name', new.email);

    insert into model_profiles (profile_id, full_name, email, is_independent, attested_independent_at)
    values (new.id, new.raw_user_meta_data->>'full_name', new.email, true, now());

    return new;
  end if;

  if new.raw_user_meta_data ? 'invite_id' then
    select * into v_invite
    from invites
    where id = (new.raw_user_meta_data->>'invite_id')::uuid
      and email = new.email and status = 'pending' and expires_at > now();
  end if;

  if not found then
    select * into v_invite
    from invites
    where email = new.email and status = 'pending' and expires_at > now()
    order by created_at desc
    limit 1;
  end if;

  if found then
    insert into profiles (id, role, full_name, email)
    values (new.id, v_invite.role, new.raw_user_meta_data->>'full_name', new.email);

    if v_invite.role = 'model' and v_invite.model_id is not null then
      update model_profiles set profile_id = new.id where id = v_invite.model_id;
    elsif v_invite.role = 'crew' and v_invite.crew_payee_id is not null then
      update crew_payees set profile_id = new.id where id = v_invite.crew_payee_id;
    elsif v_invite.role not in ('model', 'crew') then
      insert into org_memberships (profile_id, org_id, access_level)
      values (new.id, v_invite.org_id, 'basic');
    end if;

    update invites set status = 'accepted' where id = v_invite.id;
    return new;
  end if;

  raise exception 'handle_new_user: no role metadata or pending invite found for %', new.email;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_crew_to_call_sheet"("p_campaign_id" "uuid", "p_role_key" "text", "p_full_name" "text", "p_email" "text", "p_discipline" "public"."crew_discipline" DEFAULT NULL::"public"."crew_discipline") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_payee_id uuid;
  v_slot_id uuid;
  v_perm text;
begin
  v_perm := my_call_sheet_role(p_campaign_id, p_role_key);
  if v_perm not in ('admin', 'producer', 'lead') then
    raise exception 'invite_crew_to_call_sheet: not authorized for this role';
  end if;

  insert into crew_payees (email, full_name, discipline)
  values (lower(trim(p_email)), p_full_name, p_discipline)
  on conflict (email) do update set full_name = excluded.full_name
  returning id into v_payee_id;

  insert into invites (email, role, crew_payee_id, invited_by_profile_id, expires_at)
  select lower(trim(p_email)), 'crew', v_payee_id, auth.uid(), now() + interval '30 days'
  where not exists (
    select 1 from invites where crew_payee_id = v_payee_id and status = 'pending' and expires_at > now()
  );

  insert into campaign_crew_slots (campaign_id, role_key, crew_payee_id, assigned_by_profile_id, assigned_at)
  values (p_campaign_id, p_role_key, v_payee_id, auth.uid(), now())
  on conflict (campaign_id, role_key)
    do update set crew_payee_id = excluded.crew_payee_id, assigned_by_profile_id = excluded.assigned_by_profile_id, assigned_at = excluded.assigned_at
  returning id into v_slot_id;

  perform record_audit_event(
    'call_sheet.role_invited', 'campaign_crew_slot', v_slot_id, p_campaign_id,
    null, jsonb_build_object('role_key', p_role_key, 'crew_payee_id', v_payee_id, 'email', p_email, 'invited_by_role', v_perm)
  );

  return v_slot_id;
end;
$$;


ALTER FUNCTION "public"."invite_crew_to_call_sheet"("p_campaign_id" "uuid", "p_role_key" "text", "p_full_name" "text", "p_email" "text", "p_discipline" "public"."crew_discipline") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoice_brand_org"("p_invoice_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select brand_org_id from invoices where id = p_invoice_id;
$$;


ALTER FUNCTION "public"."invoice_brand_org"("p_invoice_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoice_has_payee"("p_invoice_id" "uuid", "p_org_id" "uuid", "p_model_id" "uuid", "p_crew_payee_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from invoice_line_items li
    where li.invoice_id = p_invoice_id
      and ((p_org_id is not null and li.payee_org_id = p_org_id)
        or (p_model_id is not null and li.payee_model_id = p_model_id)
        or (p_crew_payee_id is not null and li.payee_crew_payee_id = p_crew_payee_id))
  );
$$;


ALTER FUNCTION "public"."invoice_has_payee"("p_invoice_id" "uuid", "p_org_id" "uuid", "p_model_id" "uuid", "p_crew_payee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoice_has_payee_org"("p_invoice_id" "uuid", "p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from invoice_line_items li where li.invoice_id = p_invoice_id and li.payee_org_id = p_org_id
  );
$$;


ALTER FUNCTION "public"."invoice_has_payee_org"("p_invoice_id" "uuid", "p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_campaigns_brand"("p_campaign_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from campaigns
    where id = p_campaign_id and brand_org_id = my_org_id()
  );
$$;


ALTER FUNCTION "public"."is_campaigns_brand"("p_campaign_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lock_overdue_accounts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update organizations o set payment_locked = true
  where payment_locked = false and exists (
    select 1 from invoice_payments ip join invoices i on i.id = ip.invoice_id
    where i.brand_org_id = o.id
      and ip.noncircumvention_invoice_created_at is not null
      and ip.noncircumvention_invoice_paid_at is null
      and ip.noncircumvention_invoice_created_at < now() - interval '90 days'
  );
  update organizations o set payment_locked = false
  where payment_locked = true and not exists (
    select 1 from invoice_payments ip join invoices i on i.id = ip.invoice_id
    where i.brand_org_id = o.id
      and ip.noncircumvention_invoice_created_at is not null
      and ip.noncircumvention_invoice_paid_at is null
      and ip.noncircumvention_invoice_created_at < now() - interval '90 days'
  );
end;
$$;


ALTER FUNCTION "public"."lock_overdue_accounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_access_level"() RETURNS "public"."membership_access_level"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select access_level from org_memberships where profile_id = auth.uid() and status = 'active';
$$;


ALTER FUNCTION "public"."my_access_level"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_call_sheet_role"("p_campaign_id" "uuid", "p_role_key" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_crew_payee_id uuid;
  v_is_producer boolean;
  v_is_lead boolean;
  v_has_any_slot boolean;
  v_has_grant boolean;
begin
  if is_campaigns_brand(p_campaign_id) and my_access_level() = 'administrator' then
    return 'admin';
  end if;

  select id into v_crew_payee_id from crew_payees where profile_id = auth.uid();

  if v_crew_payee_id is not null then
    select exists (
      select 1 from campaign_crew_slots ccs
      where ccs.campaign_id = p_campaign_id and ccs.crew_payee_id = v_crew_payee_id
        and ccs.role_key in ('executive_producer', 'producer', 'production_manager')
    ) into v_is_producer;
    if v_is_producer then return 'producer'; end if;

    if p_role_key is not null then
      select exists (
        select 1 from campaign_crew_slots lead_slot
        join call_sheet_role_categories lead_cat on lead_cat.role_key = lead_slot.role_key
        join call_sheet_role_categories target_cat on target_cat.role_key = p_role_key
        where lead_slot.campaign_id = p_campaign_id and lead_slot.crew_payee_id = v_crew_payee_id
          and lead_slot.is_department_lead and lead_cat.category_key = target_cat.category_key
      ) into v_is_lead;
      if v_is_lead then return 'lead'; end if;
    else
      select exists (
        select 1 from campaign_crew_slots ccs
        where ccs.campaign_id = p_campaign_id and ccs.crew_payee_id = v_crew_payee_id and ccs.is_department_lead
      ) into v_is_lead;
      if v_is_lead then return 'lead'; end if;
    end if;

    select exists (
      select 1 from campaign_crew_slots ccs where ccs.campaign_id = p_campaign_id and ccs.crew_payee_id = v_crew_payee_id
    ) into v_has_any_slot;
    select exists (
      select 1 from campaign_guest_access g where g.campaign_id = p_campaign_id and g.crew_payee_id = v_crew_payee_id
    ) into v_has_grant;
    if v_has_any_slot or v_has_grant then return 'viewer'; end if;

    return null;
  end if;

  if is_campaigns_brand(p_campaign_id) then return 'viewer'; end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."my_call_sheet_role"("p_campaign_id" "uuid", "p_role_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_crew_payee_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id from crew_payees where profile_id = auth.uid();
$$;


ALTER FUNCTION "public"."my_crew_payee_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_document_access"("p_document_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_doc model_documents%rowtype;
begin
  select * into v_doc from model_documents where id = p_document_id;
  if v_doc.id is null then return null; end if;

  if v_doc.uploading_agency_org_id = my_org_id() then
    return 'owner';
  end if;

  if v_doc.visibility = 'public' then
    if agency_has_model(v_doc.model_id)
      or my_model_id() = v_doc.model_id
      or exists (
        select 1 from submissions s
        where s.model_id = v_doc.model_id and is_campaigns_brand(s.campaign_id)
      )
    then
      return 'viewer';
    end if;
  end if;

  return null; -- restricted docs never resolve beyond 'owner'
end;
$$;


ALTER FUNCTION "public"."my_document_access"("p_document_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_model_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id from model_profiles where profile_id = auth.uid();
$$;


ALTER FUNCTION "public"."my_model_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select org_id from org_memberships where profile_id = auth.uid() and status = 'active';
$$;


ALTER FUNCTION "public"."my_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_org_type"() RETURNS "public"."org_type"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select org_type from organizations where id = my_org_id();
$$;


ALTER FUNCTION "public"."my_org_type"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_role"() RETURNS "public"."profile_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role from profiles where id = auth.uid();
$$;


ALTER FUNCTION "public"."my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_last_admin_lockout"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_org_id uuid;
  v_remaining_admins int;
begin
  if old.access_level = 'administrator' and old.status = 'active' then
    v_org_id := old.org_id;

    select count(*) into v_remaining_admins
    from org_memberships
    where org_id = v_org_id and access_level = 'administrator' and status = 'active' and id <> old.id;

    if TG_OP = 'UPDATE' and new.access_level = 'administrator' and new.status = 'active' then
      v_remaining_admins := v_remaining_admins + 1;
    end if;

    if v_remaining_admins = 0 then
      raise exception 'prevent_last_admin_lockout: cannot remove or demote the last active administrator of an organization';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;


ALTER FUNCTION "public"."prevent_last_admin_lockout"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_invoice_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invoice_id uuid := coalesce(new.invoice_id, old.invoice_id);
  v_total numeric;
  v_accepted numeric;
begin
  select total_amount into v_total from invoices where id = v_invoice_id;
  select coalesce(sum(amount), 0) into v_accepted
  from invoice_payments where invoice_id = v_invoice_id and status = 'accepted';

  update invoices set status = (case
    when v_accepted <= 0 then 'outstanding'
    when v_accepted >= v_total then 'paid'
    else 'partially_paid'
  end)::invoice_balance_status
  where id = v_invoice_id;

  return null;
end;
$$;


ALTER FUNCTION "public"."recompute_invoice_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_audit_event"("p_action" "text", "p_object_type" "text" DEFAULT NULL::"text", "p_object_id" "uuid" DEFAULT NULL::"uuid", "p_campaign_id" "uuid" DEFAULT NULL::"uuid", "p_previous_value" "jsonb" DEFAULT NULL::"jsonb", "p_new_value" "jsonb" DEFAULT NULL::"jsonb", "p_request_id" "uuid" DEFAULT NULL::"uuid", "p_artifact_hash" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."record_audit_event"("p_action" "text", "p_object_type" "text", "p_object_id" "uuid", "p_campaign_id" "uuid", "p_previous_value" "jsonb", "p_new_value" "jsonb", "p_request_id" "uuid", "p_artifact_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_invoice_payment"("p_campaign_id" "uuid", "p_invoice_total" numeric, "p_amount" numeric, "p_method" "text", "p_reference_note" "text" DEFAULT NULL::"text", "p_agency_org_id" "uuid" DEFAULT NULL::"uuid", "p_model_id" "uuid" DEFAULT NULL::"uuid", "p_crew_payee_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_brand_org_id uuid;
  v_invoice_id uuid;
  v_total numeric;
  v_remaining numeric;
  v_payee_count int;
  v_is_independent boolean;
  v_payment_id uuid;
begin
  if p_method not in ('check','wire','cash') then
    raise exception 'record_invoice_payment: % is not a manual payment method', p_method;
  end if;
  if p_amount <= 0 then
    raise exception 'record_invoice_payment: amount must be positive';
  end if;
  if p_invoice_total <= 0 then
    raise exception 'record_invoice_payment: invoice total must be positive';
  end if;

  v_payee_count := (p_agency_org_id is not null)::int + (p_model_id is not null)::int + (p_crew_payee_id is not null)::int;
  if v_payee_count <> 1 then
    raise exception 'record_invoice_payment: exactly one payee must be specified';
  end if;

  if p_model_id is not null then
    select is_independent into v_is_independent from model_profiles where id = p_model_id;
    if v_is_independent is not true then
      raise exception 'record_invoice_payment: model % is not independent — pay through their agency', p_model_id;
    end if;
  end if;

  select brand_org_id into v_brand_org_id from campaigns where id = p_campaign_id;
  if v_brand_org_id is null then
    raise exception 'record_invoice_payment: campaign % not found', p_campaign_id;
  end if;
  if v_brand_org_id is distinct from my_org_id() then
    raise exception 'record_invoice_payment: caller does not belong to this campaign''s brand org';
  end if;
  if exists (select 1 from organizations where id = v_brand_org_id and payment_locked) then
    raise exception 'record_invoice_payment: this account is locked — pay the outstanding platform fee invoice to resume making payments';
  end if;

  select i.id, i.total_amount into v_invoice_id, v_total
  from invoices i
  join invoice_line_items li on li.invoice_id = i.id
  where i.campaign_id = p_campaign_id
    and i.brand_org_id = v_brand_org_id
    and i.status <> 'paid'
    and (
      (p_agency_org_id is not null and li.payee_org_id = p_agency_org_id)
      or (p_model_id is not null and li.payee_model_id = p_model_id)
      or (p_crew_payee_id is not null and li.payee_crew_payee_id = p_crew_payee_id)
    )
  order by i.created_at asc
  limit 1;

  if v_invoice_id is null then
    insert into invoices (brand_org_id, campaign_id, total_amount, created_by_profile_id)
    values (v_brand_org_id, p_campaign_id, p_invoice_total, auth.uid())
    returning id, total_amount into v_invoice_id, v_total;

    insert into invoice_line_items (invoice_id, payee_org_id, payee_model_id, payee_crew_payee_id, gross_amount, payout_amount, transfer_status)
    values (v_invoice_id, p_agency_org_id, p_model_id, p_crew_payee_id, p_invoice_total, p_invoice_total, 'pending');
  end if;

  select v_total - coalesce(sum(amount), 0) into v_remaining
  from invoice_payments where invoice_id = v_invoice_id and status in ('pending', 'accepted');

  if p_amount > v_remaining then
    raise exception 'record_invoice_payment: amount % exceeds remaining balance %', p_amount, v_remaining;
  end if;

  insert into invoice_payments (invoice_id, amount, payment_method, reference_note, status, created_by_profile_id, pending_at)
  values (v_invoice_id, p_amount, p_method, nullif(trim(p_reference_note), ''), 'pending', auth.uid(), now())
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;


ALTER FUNCTION "public"."record_invoice_payment"("p_campaign_id" "uuid", "p_invoice_total" numeric, "p_amount" numeric, "p_method" "text", "p_reference_note" "text", "p_agency_org_id" "uuid", "p_model_id" "uuid", "p_crew_payee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_payment_attempt"("p_booking_id" "uuid", "p_amount" numeric, "p_status" "public"."transaction_status", "p_stripe_payment_intent_id" "text" DEFAULT NULL::"text", "p_stripe_charge_id" "text" DEFAULT NULL::"text", "p_failure_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."record_payment_attempt"("p_booking_id" "uuid", "p_amount" numeric, "p_status" "public"."transaction_status", "p_stripe_payment_intent_id" "text", "p_stripe_charge_id" "text", "p_failure_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_crew_access"("p_access_code" "uuid") RETURNS TABLE("grant_id" "uuid", "payee_name" "text", "payee_discipline" "public"."crew_discipline", "campaign_id" "uuid", "campaign_name" "text", "campaign_status" "public"."campaign_status", "brand_name" "text", "due_date" "date", "expires_at" timestamp with time zone, "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_grant campaign_guest_access%rowtype;
begin
  select * into v_grant from campaign_guest_access where access_code = p_access_code;

  if not found then
    raise exception 'redeem_crew_access: invalid access code';
  end if;
  if v_grant.revoked_at is not null then
    raise exception 'redeem_crew_access: this access code has been revoked';
  end if;

  update campaign_guest_access set last_used_at = now() where id = v_grant.id;

  return query
    select
      g.id, cp.full_name, cp.discipline, c.id, c.name, c.status, o.name, c.due_date, g.expires_at,
      (g.expires_at > now())
    from campaign_guest_access g
    join crew_payees cp on cp.id = g.crew_payee_id
    join campaigns c on c.id = g.campaign_id
    join organizations o on o.id = c.brand_org_id
    where g.id = v_grant.id;
end;
$$;


ALTER FUNCTION "public"."redeem_crew_access"("p_access_code" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."representation_overlap_exists"("p_model_id" "uuid", "p_new_relationship_id" "uuid", "p_agency_org_id" "uuid", "p_territories" "text"[], "p_exclusivity" "public"."representation_exclusivity", "p_effective_start_date" "date", "p_effective_end_date" "date") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from agency_model_relationships other
    where other.model_id = p_model_id
      and other.agency_org_id <> p_agency_org_id
      and other.status = 'active'
      and other.id <> p_new_relationship_id
      and (other.exclusivity = 'exclusive' or p_exclusivity = 'exclusive')
      and other.effective_start_date <= coalesce(p_effective_end_date, 'infinity'::date)
      and coalesce(other.effective_end_date, 'infinity'::date) >= p_effective_start_date
      and exists (
        select 1 from unnest(other.territories) ot, unnest(p_territories) pt
        where lower(ot) = lower(pt) or lower(ot) = 'worldwide' or lower(pt) = 'worldwide'
      )
  );
$$;


ALTER FUNCTION "public"."representation_overlap_exists"("p_model_id" "uuid", "p_new_relationship_id" "uuid", "p_agency_org_id" "uuid", "p_territories" "text"[], "p_exclusivity" "public"."representation_exclusivity", "p_effective_start_date" "date", "p_effective_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_invoice_for_card_payment"("p_campaign_id" "uuid", "p_invoice_total" numeric, "p_agency_org_id" "uuid" DEFAULT NULL::"uuid", "p_model_id" "uuid" DEFAULT NULL::"uuid", "p_crew_payee_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("out_invoice_id" "uuid", "remaining_amount" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_brand_org_id uuid;
  v_invoice_id uuid;
  v_total numeric;
  v_remaining numeric;
  v_payee_count int;
  v_is_independent boolean;
begin
  if p_invoice_total <= 0 then
    raise exception 'reserve_invoice_for_card_payment: invoice total must be positive';
  end if;

  v_payee_count := (p_agency_org_id is not null)::int + (p_model_id is not null)::int + (p_crew_payee_id is not null)::int;
  if v_payee_count <> 1 then
    raise exception 'reserve_invoice_for_card_payment: exactly one payee must be specified';
  end if;

  if p_model_id is not null then
    select is_independent into v_is_independent from model_profiles where id = p_model_id;
    if v_is_independent is not true then
      raise exception 'reserve_invoice_for_card_payment: model % is not independent — pay through their agency', p_model_id;
    end if;
  end if;

  select brand_org_id into v_brand_org_id from campaigns where id = p_campaign_id;
  if v_brand_org_id is null then
    raise exception 'reserve_invoice_for_card_payment: campaign % not found', p_campaign_id;
  end if;
  if v_brand_org_id is distinct from my_org_id() then
    raise exception 'reserve_invoice_for_card_payment: caller does not belong to this campaign''s brand org';
  end if;
  if exists (select 1 from organizations where id = v_brand_org_id and payment_locked) then
    raise exception 'reserve_invoice_for_card_payment: this account is locked — pay the outstanding platform fee invoice to resume making payments';
  end if;

  select i.id, i.total_amount into v_invoice_id, v_total
  from invoices i
  join invoice_line_items li on li.invoice_id = i.id
  where i.campaign_id = p_campaign_id
    and i.brand_org_id = v_brand_org_id
    and i.status <> 'paid'
    and (
      (p_agency_org_id is not null and li.payee_org_id = p_agency_org_id)
      or (p_model_id is not null and li.payee_model_id = p_model_id)
      or (p_crew_payee_id is not null and li.payee_crew_payee_id = p_crew_payee_id)
    )
  order by i.created_at asc
  limit 1;

  if v_invoice_id is null then
    insert into invoices (brand_org_id, campaign_id, total_amount, created_by_profile_id)
    values (v_brand_org_id, p_campaign_id, p_invoice_total, auth.uid())
    returning id, total_amount into v_invoice_id, v_total;

    insert into invoice_line_items (invoice_id, payee_org_id, payee_model_id, payee_crew_payee_id, gross_amount, payout_amount, transfer_status)
    values (v_invoice_id, p_agency_org_id, p_model_id, p_crew_payee_id, p_invoice_total, p_invoice_total, 'pending');
  end if;

  select v_total - coalesce(sum(amount), 0) into v_remaining
  from invoice_payments where invoice_id = v_invoice_id and status in ('pending', 'accepted');

  if v_remaining <= 0 then
    raise exception 'reserve_invoice_for_card_payment: this invoice has no remaining balance — it may already be fully paid or reserved by another payment in progress';
  end if;

  return query select v_invoice_id, v_remaining;
end;
$$;


ALTER FUNCTION "public"."reserve_invoice_for_card_payment"("p_campaign_id" "uuid", "p_invoice_total" numeric, "p_agency_org_id" "uuid", "p_model_id" "uuid", "p_crew_payee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_contract_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.contract_number is null then
    new.contract_number := 'CF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('contract_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_contract_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_department_lead"("p_campaign_id" "uuid", "p_role_key" "text", "p_is_lead" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_perm text;
begin
  v_perm := my_call_sheet_role(p_campaign_id, p_role_key);
  if v_perm not in ('admin', 'producer') then
    raise exception 'set_department_lead: only an admin or producer can set department leads';
  end if;
  update campaign_crew_slots set is_department_lead = p_is_lead
  where campaign_id = p_campaign_id and role_key = p_role_key;
end;
$$;


ALTER FUNCTION "public"."set_department_lead"("p_campaign_id" "uuid", "p_role_key" "text", "p_is_lead" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_independent_model"("p_campaign_id" "uuid", "p_model_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_brand_org_id uuid;
  v_is_independent boolean;
  v_submission_id uuid;
begin
  select brand_org_id into v_brand_org_id from campaigns where id = p_campaign_id;
  if v_brand_org_id is null then
    raise exception 'submit_independent_model: campaign % not found', p_campaign_id;
  end if;
  if v_brand_org_id is distinct from my_org_id() then
    raise exception 'submit_independent_model: caller does not belong to this campaign''s brand org';
  end if;

  select is_independent into v_is_independent from model_profiles where id = p_model_id;
  if v_is_independent is not true then
    raise exception 'submit_independent_model: model % is not independent', p_model_id;
  end if;

  insert into submissions (campaign_id, model_id, submitting_agency_id, submitted_by_profile_id, stage)
  values (p_campaign_id, p_model_id, null, auth.uid(), 'submitted')
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;


ALTER FUNCTION "public"."submit_independent_model"("p_campaign_id" "uuid", "p_model_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_talent"("p_campaign_id" "uuid", "p_model_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("submission_id" "uuid", "duplicate_submission" boolean, "overlap_warning" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_agency_id uuid := my_org_id();
  v_submission_id uuid;
  v_campaign_territory text;
  v_existing_stage submission_stage;
  v_other_count int;
  v_applicable_rel_count int;
  v_overlap_warning text;
  v_duplicate boolean;
begin
  if not agency_has_model(p_model_id) then
    raise exception 'submit_talent: your agency has no active relationship with this model';
  end if;
  if not agency_distributed_on(p_campaign_id) then
    raise exception 'submit_talent: your agency is not invited to this campaign';
  end if;

  select stage into v_existing_stage from submissions
    where campaign_id = p_campaign_id and model_id = p_model_id and submitting_agency_id = v_agency_id;
  if v_existing_stage = 'rejected' then
    raise exception 'submit_talent: this model was already declined for this campaign and cannot be resubmitted';
  end if;

  select territory into v_campaign_territory from campaigns where id = p_campaign_id;

  insert into submissions (campaign_id, model_id, submitting_agency_id, submitted_by_profile_id, notes)
  values (p_campaign_id, p_model_id, v_agency_id, auth.uid(), p_notes)
  on conflict (campaign_id, model_id, submitting_agency_id)
    do update set notes = excluded.notes, updated_at = now()
  returning id into v_submission_id;

  select count(*) into v_other_count from submissions
    where campaign_id = p_campaign_id and model_id = p_model_id and submitting_agency_id <> v_agency_id;
  v_duplicate := v_other_count > 0;

  -- "Which relationship looks applicable" per spec §15-17: active,
  -- in-date, territory-matching relationships held by a DIFFERENT
  -- agency than the one submitting right now.
  select count(*) into v_applicable_rel_count from agency_model_relationships r
    where r.model_id = p_model_id and r.status = 'active' and r.agency_org_id <> v_agency_id
      and r.effective_start_date <= current_date
      and (r.effective_end_date is null or r.effective_end_date >= current_date)
      and (
        v_campaign_territory is null
        or exists (
          select 1 from unnest(r.territories) t
          where lower(t) = lower(v_campaign_territory) or lower(t) = 'worldwide'
        )
      );

  if v_duplicate and v_applicable_rel_count > 0 then
    v_overlap_warning := 'Another agency also has an active representation relationship covering this campaign''s territory for this model. Please confirm your submission is authorized.';
  elsif v_duplicate then
    v_overlap_warning := 'This model has been submitted to this campaign by more than one agency.';
  end if;

  perform record_audit_event(
    'submission.created', 'submission', v_submission_id, p_campaign_id,
    null, jsonb_build_object(
      'model_id', p_model_id, 'duplicate_submission', v_duplicate,
      'overlap_flagged', v_overlap_warning is not null
    )
  );

  return query select v_submission_id, v_duplicate, v_overlap_warning;
end;
$$;


ALTER FUNCTION "public"."submit_talent"("p_campaign_id" "uuid", "p_model_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_crew_slot_rate"("p_campaign_id" "uuid", "p_role_key" "text", "p_rate" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not is_campaigns_brand(p_campaign_id) then
    raise exception 'update_crew_slot_rate: caller does not belong to this campaign''s brand org';
  end if;
  if p_rate is not null and p_rate < 0 then
    raise exception 'update_crew_slot_rate: rate cannot be negative';
  end if;

  update campaign_crew_slots set rate = p_rate
  where campaign_id = p_campaign_id and role_key = p_role_key;

  if not found then
    raise exception 'update_crew_slot_rate: no slot % on campaign %', p_role_key, p_campaign_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."update_crew_slot_rate"("p_campaign_id" "uuid", "p_role_key" "text", "p_rate" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_invoice_payment"("p_payment_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invoice_id uuid;
  v_brand_org_id uuid;
  v_status payment_lifecycle_status;
  v_method text;
begin
  select invoice_id, status, payment_method into v_invoice_id, v_status, v_method
  from invoice_payments where id = p_payment_id;
  if v_invoice_id is null then
    raise exception 'void_invoice_payment: payment % not found', p_payment_id;
  end if;

  select brand_org_id into v_brand_org_id from invoices where id = v_invoice_id;
  if v_brand_org_id is distinct from my_org_id() then
    raise exception 'void_invoice_payment: caller does not belong to this invoice''s brand org';
  end if;
  if v_method = 'card' then
    raise exception 'void_invoice_payment: card payments are not voided this way';
  end if;
  if v_status <> 'pending' then
    raise exception 'void_invoice_payment: payment is % — only a pending (unconfirmed) payment can be voided', v_status;
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'void_invoice_payment: a reason is required';
  end if;

  update invoice_payments
  set status = 'voided', voided_at = now(), voided_by_profile_id = auth.uid(), void_reason = trim(p_reason)
  where id = p_payment_id;
end;
$$;


ALTER FUNCTION "public"."void_invoice_payment"("p_payment_id" "uuid", "p_reason" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agency_model_relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "model_id" "uuid" NOT NULL,
    "agency_org_id" "uuid" NOT NULL,
    "relationship_type" "text" NOT NULL,
    "status" "public"."agency_relationship_status" DEFAULT 'active'::"public"."agency_relationship_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "is_mother_agency" boolean DEFAULT false NOT NULL,
    "territories" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "exclusivity" "public"."representation_exclusivity" DEFAULT 'not_specified'::"public"."representation_exclusivity" NOT NULL,
    "effective_start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "effective_end_date" "date",
    "primary_document_id" "uuid",
    CONSTRAINT "agency_model_relationships_effective_dates_order" CHECK ((("effective_end_date" IS NULL) OR ("effective_end_date" >= "effective_start_date"))),
    CONSTRAINT "agency_model_relationships_territories_not_empty" CHECK (("array_length"("territories", 1) > 0)),
    CONSTRAINT "agency_model_relationships_type_not_blank" CHECK (("btrim"("relationship_type") <> ''::"text"))
);


ALTER TABLE "public"."agency_model_relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_profile_id" "uuid",
    "org_id" "uuid",
    "campaign_id" "uuid",
    "object_type" "text",
    "object_id" "uuid",
    "action" "text" NOT NULL,
    "previous_value" "jsonb",
    "new_value" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "auth_method" "text",
    "session_id" "text",
    "request_id" "uuid",
    "geographic_region" "text",
    "artifact_hash" "text"
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_number" "text",
    "campaign_id" "uuid" NOT NULL,
    "submission_id" "uuid",
    "brand_org_id" "uuid" NOT NULL,
    "agency_org_id" "uuid",
    "model_id" "uuid" NOT NULL,
    "day_rate" numeric NOT NULL,
    "days" integer DEFAULT 1 NOT NULL,
    "shoot_date" "date",
    "agency_pct" numeric NOT NULL,
    "platform_pct" numeric NOT NULL,
    "payment_status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."booking_breakdown_v" AS
 SELECT "id" AS "booking_id",
    ("day_rate" * ("days")::numeric) AS "gross_booking_value",
    (("day_rate" * ("days")::numeric) * (((1)::numeric - "agency_pct") - "platform_pct")) AS "model_fee",
    (("day_rate" * ("days")::numeric) * "agency_pct") AS "agency_fee",
    (("day_rate" * ("days")::numeric) * "platform_pct") AS "platform_fee"
   FROM "public"."bookings";


ALTER VIEW "public"."booking_breakdown_v" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_agency_partnerships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_org_id" "uuid" NOT NULL,
    "agency_org_id" "uuid" NOT NULL,
    "status" "public"."partnership_status" DEFAULT 'active'::"public"."partnership_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brand_agency_partnerships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."call_sheet_role_categories" (
    "role_key" "text" NOT NULL,
    "category_key" "text" NOT NULL
);


ALTER TABLE "public"."call_sheet_role_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_agency_distributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "agency_org_id" "uuid" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invited_by_profile_id" "uuid"
);


ALTER TABLE "public"."campaign_agency_distributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_crew_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "role_key" "text" NOT NULL,
    "crew_payee_id" "uuid",
    "assigned_by_profile_id" "uuid",
    "assigned_at" timestamp with time zone,
    "is_department_lead" boolean DEFAULT false NOT NULL,
    "rate" numeric
);


ALTER TABLE "public"."campaign_crew_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_guest_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "access_code" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issued_by_profile_id" "uuid",
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "last_used_at" timestamp with time zone,
    "crew_payee_id" "uuid" NOT NULL
);


ALTER TABLE "public"."campaign_guest_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_submission_extension_agencies" (
    "extension_id" "uuid" NOT NULL,
    "agency_org_id" "uuid" NOT NULL
);


ALTER TABLE "public"."campaign_submission_extension_agencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_submission_extensions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "new_close_date" timestamp with time zone NOT NULL,
    "applies_to_all_agencies" boolean DEFAULT false NOT NULL,
    "granted_by_profile_id" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."campaign_submission_extensions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."campaign_type" NOT NULL,
    "status" "public"."campaign_status" NOT NULL,
    "due_offset_days" integer,
    "submission_open_offset_days" integer,
    "submission_close_offset_days" integer,
    "talent_needed" integer,
    "budget" numeric
);


ALTER TABLE "public"."campaign_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."campaign_type" NOT NULL,
    "status" "public"."campaign_status" DEFAULT 'drafts'::"public"."campaign_status" NOT NULL,
    "due_date" "date",
    "submission_open" timestamp with time zone,
    "submission_close" timestamp with time zone,
    "talent_needed" integer,
    "budget" numeric,
    "runway_show_id" "uuid",
    "created_by_profile_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "territory" "text"
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."casting_entries" (
    "model_id" "uuid" NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "confirmed" boolean DEFAULT false NOT NULL,
    "optioned" boolean DEFAULT false NOT NULL,
    "fitting_complete" boolean DEFAULT false NOT NULL,
    "rehearsal_complete" boolean DEFAULT false NOT NULL,
    "checked_in" boolean DEFAULT false NOT NULL,
    "walked" boolean DEFAULT false NOT NULL,
    "wrap_complete" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."casting_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."castings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "event_date" "date" NOT NULL,
    "title" "text",
    "note" "text",
    "created_by_profile_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."castings" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."contract_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."contract_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "model_id" "uuid" NOT NULL,
    "contract_number" "text" NOT NULL,
    "day_rate" numeric NOT NULL,
    "agency_pct" numeric DEFAULT 0.20 NOT NULL,
    "territory" "text" DEFAULT 'United States'::"text" NOT NULL,
    "duration" "text" DEFAULT '1 year'::"text" NOT NULL,
    "status" "public"."contract_status" DEFAULT 'draft'::"public"."contract_status" NOT NULL,
    "sent_at" timestamp with time zone,
    "executed_at" timestamp with time zone,
    "created_by_profile_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crew_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "role" "public"."crew_role" NOT NULL
);


ALTER TABLE "public"."crew_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crew_payees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "discipline" "public"."crew_discipline",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_id" "uuid"
);


ALTER TABLE "public"."crew_payees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."profile_role" NOT NULL,
    "org_id" "uuid",
    "agency_relationship_type" "public"."agency_relationship_type",
    "invited_by_profile_id" "uuid",
    "status" "public"."invite_status" DEFAULT 'pending'::"public"."invite_status" NOT NULL,
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "model_id" "uuid",
    "crew_payee_id" "uuid"
);


ALTER TABLE "public"."invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_card_payment_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_payment_intent_id" "text" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "gross_amount" numeric NOT NULL,
    "payout_amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoice_card_payment_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "payee_org_id" "uuid",
    "gross_amount" numeric NOT NULL,
    "payout_amount" numeric NOT NULL,
    "stripe_transfer_id" "text",
    "transfer_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payee_model_id" "uuid",
    "payee_crew_payee_id" "uuid",
    "transferred_at" timestamp with time zone,
    CONSTRAINT "invoice_line_items_one_payee" CHECK (((((("payee_org_id" IS NOT NULL))::integer + (("payee_model_id" IS NOT NULL))::integer) + (("payee_crew_payee_id" IS NOT NULL))::integer) = 1))
);


ALTER TABLE "public"."invoice_line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "payment_method" "text" NOT NULL,
    "reference_note" "text",
    "status" "public"."payment_lifecycle_status" DEFAULT 'pending'::"public"."payment_lifecycle_status" NOT NULL,
    "created_by_profile_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pending_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "payee_confirmed_by_profile_id" "uuid",
    "voided_at" timestamp with time zone,
    "voided_by_profile_id" "uuid",
    "void_reason" "text",
    "stripe_payment_intent_id" "text",
    "stripe_noncircumvention_invoice_id" "text",
    "signature_name" "text",
    "signature_captured_at" timestamp with time zone,
    "noncircumvention_invoice_created_at" timestamp with time zone,
    "noncircumvention_invoice_paid_at" timestamp with time zone,
    CONSTRAINT "invoice_payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "invoice_payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['card'::"text", 'ach'::"text", 'check'::"text", 'wire'::"text", 'cash'::"text"])))
);


ALTER TABLE "public"."invoice_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_org_id" "uuid" NOT NULL,
    "campaign_id" "uuid",
    "total_amount" numeric NOT NULL,
    "created_by_profile_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."invoice_balance_status" DEFAULT 'outstanding'::"public"."invoice_balance_status" NOT NULL
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."looks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "look_number" integer,
    "garments" "text",
    "shoes" "text",
    "jewelry" "text",
    "accessories" "text",
    "stylist_notes" "text",
    "dressing_notes" "text",
    "assigned_model_id" "uuid",
    "assigned_hair_id" "uuid",
    "assigned_makeup_id" "uuid",
    "assigned_dresser_id" "uuid"
);


ALTER TABLE "public"."looks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."model_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "model_id" "uuid" NOT NULL,
    "relationship_id" "uuid",
    "uploading_agency_org_id" "uuid" NOT NULL,
    "uploaded_by_profile_id" "uuid",
    "visibility" "public"."document_visibility" NOT NULL,
    "category" "public"."document_category" NOT NULL,
    "storage_bucket" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "file_size_bytes" bigint,
    "attested_authority_to_represent" boolean,
    "attested_authorized_to_upload_materials" boolean,
    "attested_info_accurate" boolean,
    "attested_will_update_on_change" boolean,
    "attested_at" timestamp with time zone,
    "attested_by_profile_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "model_documents_category_matches_visibility" CHECK (((("visibility" = 'public'::"public"."document_visibility") AND ("category" = ANY (ARRAY['headshot'::"public"."document_category", 'digital'::"public"."document_category", 'comp_card'::"public"."document_category", 'portfolio'::"public"."document_category", 'measurements'::"public"."document_category", 'bio'::"public"."document_category", 'other_public'::"public"."document_category"]))) OR (("visibility" = 'restricted'::"public"."document_visibility") AND ("category" = ANY (ARRAY['representation_agreement'::"public"."document_category", 'commission_agreement'::"public"."document_category", 'amendment'::"public"."document_category", 'management_agreement'::"public"."document_category", 'placement_agreement'::"public"."document_category", 'tax_document'::"public"."document_category", 'identity_document'::"public"."document_category", 'other_restricted'::"public"."document_category"]))))),
    CONSTRAINT "model_documents_restricted_attestations" CHECK ((("visibility" = 'public'::"public"."document_visibility") OR ("attested_authority_to_represent" AND "attested_authorized_to_upload_materials" AND "attested_info_accurate" AND "attested_will_update_on_change" AND ("attested_at" IS NOT NULL))))
);


ALTER TABLE "public"."model_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."model_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "full_name" "text" NOT NULL,
    "location" "text",
    "default_day_rate" numeric,
    "height" "text",
    "bust" "text",
    "waist" "text",
    "dress" "text",
    "experience" "text",
    "general_availability" "public"."model_availability" DEFAULT 'available'::"public"."model_availability" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "photo_url" "text",
    "is_independent" boolean DEFAULT false NOT NULL,
    "attested_independent_at" timestamp with time zone,
    "suspended_at" timestamp with time zone,
    "suspended_by_profile_id" "uuid",
    "suspension_reason" "text",
    "date_of_birth" "date",
    "phone" "text",
    "verified_email" boolean DEFAULT false NOT NULL,
    "verified_phone" boolean DEFAULT false NOT NULL,
    "identity_verification_status" "public"."verification_status" DEFAULT 'unverified'::"public"."verification_status" NOT NULL
);


ALTER TABLE "public"."model_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "title" "text",
    "access_level" "public"."membership_access_level" DEFAULT 'basic'::"public"."membership_access_level" NOT NULL,
    "group_name" "text",
    "status" "public"."membership_status" DEFAULT 'active'::"public"."membership_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."org_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_type" "public"."org_type" NOT NULL,
    "name" "text" NOT NULL,
    "status" "public"."org_status" DEFAULT 'active'::"public"."org_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "subscription_status" "public"."subscription_status" DEFAULT 'trialing'::"public"."subscription_status" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "verification_status" "public"."verification_status" DEFAULT 'unverified'::"public"."verification_status" NOT NULL,
    "stripe_connect_account_id" "text",
    "stripe_connect_charges_enabled" boolean DEFAULT false NOT NULL,
    "stripe_connect_payouts_enabled" boolean DEFAULT false NOT NULL,
    "calendar_feed_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "logo_url" "text",
    "payment_locked" boolean DEFAULT false NOT NULL,
    "self_described_services" "text"
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "status" "public"."transaction_status" DEFAULT 'pending'::"public"."transaction_status" NOT NULL,
    "stripe_payment_intent_id" "text",
    "stripe_charge_id" "text",
    "failure_reason" "text",
    "authorized_by_profile_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "public"."profile_role" NOT NULL,
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."runway_shows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "venue" "text",
    "show_date" "date",
    "show_time" time without time zone,
    "time_zone" "text",
    "season" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."runway_shows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shoot_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "date_label" "text",
    "hours" "text",
    "talent_note" "text",
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_date" "date"
);


ALTER TABLE "public"."shoot_days" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submission_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "author_profile_id" "uuid",
    "author_org_id" "uuid",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."submission_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "model_id" "uuid" NOT NULL,
    "submitting_agency_id" "uuid",
    "submitted_by_profile_id" "uuid",
    "stage" "public"."submission_stage" DEFAULT 'submitted'::"public"."submission_stage" NOT NULL,
    "availability" "public"."model_availability" DEFAULT 'available'::"public"."model_availability" NOT NULL,
    "rate_quoted" numeric,
    "notes" "text",
    "brand_score" smallint,
    "decline_reason" "text",
    "reviewed_by_profile_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "submissions_brand_score_check" CHECK ((("brand_score" >= 1) AND ("brand_score" <= 5)))
);


ALTER TABLE "public"."submissions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agency_model_relationships"
    ADD CONSTRAINT "agency_model_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_booking_number_key" UNIQUE ("booking_number");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_submission_id_key" UNIQUE ("submission_id");



ALTER TABLE ONLY "public"."brand_agency_partnerships"
    ADD CONSTRAINT "brand_agency_partnerships_brand_org_id_agency_org_id_key" UNIQUE ("brand_org_id", "agency_org_id");



ALTER TABLE ONLY "public"."brand_agency_partnerships"
    ADD CONSTRAINT "brand_agency_partnerships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_sheet_role_categories"
    ADD CONSTRAINT "call_sheet_role_categories_pkey" PRIMARY KEY ("role_key");



ALTER TABLE ONLY "public"."campaign_agency_distributions"
    ADD CONSTRAINT "campaign_agency_distributions_campaign_id_agency_org_id_key" UNIQUE ("campaign_id", "agency_org_id");



ALTER TABLE ONLY "public"."campaign_agency_distributions"
    ADD CONSTRAINT "campaign_agency_distributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_crew_slots"
    ADD CONSTRAINT "campaign_crew_slots_campaign_id_role_key_key" UNIQUE ("campaign_id", "role_key");



ALTER TABLE ONLY "public"."campaign_crew_slots"
    ADD CONSTRAINT "campaign_crew_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_guest_access"
    ADD CONSTRAINT "campaign_guest_access_code_unique" UNIQUE ("access_code");



ALTER TABLE ONLY "public"."campaign_guest_access"
    ADD CONSTRAINT "campaign_guest_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_submission_extension_agencies"
    ADD CONSTRAINT "campaign_submission_extension_agencies_pkey" PRIMARY KEY ("extension_id", "agency_org_id");



ALTER TABLE ONLY "public"."campaign_submission_extensions"
    ADD CONSTRAINT "campaign_submission_extensions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_templates"
    ADD CONSTRAINT "campaign_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."casting_entries"
    ADD CONSTRAINT "casting_entries_pkey" PRIMARY KEY ("model_id", "campaign_id");



ALTER TABLE ONLY "public"."castings"
    ADD CONSTRAINT "castings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_campaign_id_model_id_key" UNIQUE ("campaign_id", "model_id");



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_contract_number_key" UNIQUE ("contract_number");



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crew_members"
    ADD CONSTRAINT "crew_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crew_payees"
    ADD CONSTRAINT "crew_payees_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."crew_payees"
    ADD CONSTRAINT "crew_payees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crew_payees"
    ADD CONSTRAINT "crew_payees_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_card_payment_lines"
    ADD CONSTRAINT "invoice_card_payment_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_invoice_id_booking_id_key" UNIQUE ("invoice_id", "booking_id");



ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."looks"
    ADD CONSTRAINT "looks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."model_documents"
    ADD CONSTRAINT "model_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."model_documents"
    ADD CONSTRAINT "model_documents_storage_bucket_storage_path_key" UNIQUE ("storage_bucket", "storage_path");



ALTER TABLE ONLY "public"."model_profiles"
    ADD CONSTRAINT "model_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."model_profiles"
    ADD CONSTRAINT "model_profiles_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."org_memberships"
    ADD CONSTRAINT "org_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_memberships"
    ADD CONSTRAINT "org_memberships_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."runway_shows"
    ADD CONSTRAINT "runway_shows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shoot_days"
    ADD CONSTRAINT "shoot_days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submission_comments"
    ADD CONSTRAINT "submission_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_campaign_model_agency_key" UNIQUE ("campaign_id", "model_id", "submitting_agency_id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");



CREATE INDEX "agency_model_relationships_agency_idx" ON "public"."agency_model_relationships" USING "btree" ("agency_org_id");



CREATE INDEX "agency_model_relationships_model_idx" ON "public"."agency_model_relationships" USING "btree" ("model_id");



CREATE INDEX "audit_log_action_idx" ON "public"."audit_log" USING "btree" ("action");



CREATE INDEX "audit_log_actor_idx" ON "public"."audit_log" USING "btree" ("actor_profile_id");



CREATE INDEX "audit_log_campaign_idx" ON "public"."audit_log" USING "btree" ("campaign_id");



CREATE INDEX "audit_log_object_idx" ON "public"."audit_log" USING "btree" ("object_type", "object_id");



CREATE INDEX "audit_log_occurred_at_idx" ON "public"."audit_log" USING "btree" ("occurred_at");



CREATE INDEX "audit_log_org_idx" ON "public"."audit_log" USING "btree" ("org_id");



CREATE INDEX "bookings_agency_idx" ON "public"."bookings" USING "btree" ("agency_org_id");



CREATE INDEX "bookings_brand_idx" ON "public"."bookings" USING "btree" ("brand_org_id");



CREATE INDEX "bookings_campaign_idx" ON "public"."bookings" USING "btree" ("campaign_id");



CREATE INDEX "bookings_model_idx" ON "public"."bookings" USING "btree" ("model_id");



CREATE INDEX "campaign_agency_distributions_agency_idx" ON "public"."campaign_agency_distributions" USING "btree" ("agency_org_id");



CREATE INDEX "campaign_crew_slots_campaign_idx" ON "public"."campaign_crew_slots" USING "btree" ("campaign_id");



CREATE INDEX "campaign_crew_slots_payee_idx" ON "public"."campaign_crew_slots" USING "btree" ("crew_payee_id");



CREATE INDEX "campaign_guest_access_campaign_idx" ON "public"."campaign_guest_access" USING "btree" ("campaign_id");



CREATE INDEX "campaign_guest_access_code_idx" ON "public"."campaign_guest_access" USING "btree" ("access_code");



CREATE INDEX "campaign_submission_extensions_campaign_idx" ON "public"."campaign_submission_extensions" USING "btree" ("campaign_id");



CREATE INDEX "campaigns_brand_org_idx" ON "public"."campaigns" USING "btree" ("brand_org_id");



CREATE INDEX "campaigns_runway_show_idx" ON "public"."campaigns" USING "btree" ("runway_show_id");



CREATE INDEX "castings_campaign_idx" ON "public"."castings" USING "btree" ("campaign_id");



CREATE INDEX "crew_members_campaign_idx" ON "public"."crew_members" USING "btree" ("campaign_id");



CREATE INDEX "invites_email_idx" ON "public"."invites" USING "btree" ("email");



CREATE INDEX "invoice_card_payment_lines_pi_idx" ON "public"."invoice_card_payment_lines" USING "btree" ("stripe_payment_intent_id");



CREATE INDEX "invoice_line_items_booking_idx" ON "public"."invoice_line_items" USING "btree" ("booking_id");



CREATE INDEX "invoice_line_items_invoice_idx" ON "public"."invoice_line_items" USING "btree" ("invoice_id");



CREATE INDEX "invoice_line_items_payee_idx" ON "public"."invoice_line_items" USING "btree" ("payee_org_id");



CREATE INDEX "invoice_payments_invoice_idx" ON "public"."invoice_payments" USING "btree" ("invoice_id");



CREATE UNIQUE INDEX "invoice_payments_noncirc_invoice_idx" ON "public"."invoice_payments" USING "btree" ("stripe_noncircumvention_invoice_id") WHERE ("stripe_noncircumvention_invoice_id" IS NOT NULL);



CREATE INDEX "invoice_payments_stripe_pi_idx" ON "public"."invoice_payments" USING "btree" ("stripe_payment_intent_id");



CREATE INDEX "invoices_brand_idx" ON "public"."invoices" USING "btree" ("brand_org_id");



CREATE INDEX "invoices_campaign_idx" ON "public"."invoices" USING "btree" ("campaign_id");



CREATE INDEX "looks_campaign_idx" ON "public"."looks" USING "btree" ("campaign_id");



CREATE INDEX "model_documents_agency_idx" ON "public"."model_documents" USING "btree" ("uploading_agency_org_id");



CREATE INDEX "model_documents_model_idx" ON "public"."model_documents" USING "btree" ("model_id");



CREATE INDEX "model_documents_relationship_idx" ON "public"."model_documents" USING "btree" ("relationship_id");



CREATE INDEX "model_profiles_date_of_birth_idx" ON "public"."model_profiles" USING "btree" ("date_of_birth") WHERE ("date_of_birth" IS NOT NULL);



CREATE INDEX "model_profiles_email_lower_idx" ON "public"."model_profiles" USING "btree" ("lower"("email")) WHERE ("email" IS NOT NULL);



CREATE INDEX "model_profiles_full_name_trgm_idx" ON "public"."model_profiles" USING "gin" ("lower"("full_name") "public"."gin_trgm_ops");



CREATE INDEX "model_profiles_phone_idx" ON "public"."model_profiles" USING "btree" ("phone") WHERE ("phone" IS NOT NULL);



CREATE INDEX "org_memberships_org_id_idx" ON "public"."org_memberships" USING "btree" ("org_id");



CREATE INDEX "organizations_org_type_idx" ON "public"."organizations" USING "btree" ("org_type");



CREATE INDEX "payments_booking_idx" ON "public"."payments" USING "btree" ("booking_id");



CREATE INDEX "payments_stripe_pi_idx" ON "public"."payments" USING "btree" ("stripe_payment_intent_id");



CREATE INDEX "shoot_days_campaign_idx" ON "public"."shoot_days" USING "btree" ("campaign_id");



CREATE INDEX "submission_comments_submission_idx" ON "public"."submission_comments" USING "btree" ("submission_id");



CREATE INDEX "submissions_agency_idx" ON "public"."submissions" USING "btree" ("submitting_agency_id");



CREATE INDEX "submissions_campaign_idx" ON "public"."submissions" USING "btree" ("campaign_id");



CREATE INDEX "submissions_model_idx" ON "public"."submissions" USING "btree" ("model_id");



CREATE OR REPLACE TRIGGER "contracts_set_number" BEFORE INSERT ON "public"."contracts" FOR EACH ROW EXECUTE FUNCTION "public"."set_contract_number"();



CREATE OR REPLACE TRIGGER "invoice_payments_status_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."invoice_payments" FOR EACH ROW EXECUTE FUNCTION "public"."recompute_invoice_status"();



CREATE OR REPLACE TRIGGER "org_memberships_prevent_last_admin_lockout" BEFORE DELETE OR UPDATE ON "public"."org_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_last_admin_lockout"();



ALTER TABLE ONLY "public"."agency_model_relationships"
    ADD CONSTRAINT "agency_model_relationships_agency_org_id_fkey" FOREIGN KEY ("agency_org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_model_relationships"
    ADD CONSTRAINT "agency_model_relationships_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."model_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_model_relationships"
    ADD CONSTRAINT "agency_model_relationships_primary_document_fkey" FOREIGN KEY ("primary_document_id") REFERENCES "public"."model_documents"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_agency_org_id_fkey" FOREIGN KEY ("agency_org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_brand_org_id_fkey" FOREIGN KEY ("brand_org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."model_profiles"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id");



ALTER TABLE ONLY "public"."brand_agency_partnerships"
    ADD CONSTRAINT "brand_agency_partnerships_agency_org_id_fkey" FOREIGN KEY ("agency_org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_agency_partnerships"
    ADD CONSTRAINT "brand_agency_partnerships_brand_org_id_fkey" FOREIGN KEY ("brand_org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_agency_distributions"
    ADD CONSTRAINT "campaign_agency_distributions_agency_org_id_fkey" FOREIGN KEY ("agency_org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_agency_distributions"
    ADD CONSTRAINT "campaign_agency_distributions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_agency_distributions"
    ADD CONSTRAINT "campaign_agency_distributions_invited_by_profile_id_fkey" FOREIGN KEY ("invited_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."campaign_crew_slots"
    ADD CONSTRAINT "campaign_crew_slots_assigned_by_profile_id_fkey" FOREIGN KEY ("assigned_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."campaign_crew_slots"
    ADD CONSTRAINT "campaign_crew_slots_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_crew_slots"
    ADD CONSTRAINT "campaign_crew_slots_crew_payee_id_fkey" FOREIGN KEY ("crew_payee_id") REFERENCES "public"."crew_payees"("id");



ALTER TABLE ONLY "public"."campaign_guest_access"
    ADD CONSTRAINT "campaign_guest_access_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_guest_access"
    ADD CONSTRAINT "campaign_guest_access_crew_payee_id_fkey" FOREIGN KEY ("crew_payee_id") REFERENCES "public"."crew_payees"("id");



ALTER TABLE ONLY "public"."campaign_guest_access"
    ADD CONSTRAINT "campaign_guest_access_issued_by_profile_id_fkey" FOREIGN KEY ("issued_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."campaign_submission_extension_agencies"
    ADD CONSTRAINT "campaign_submission_extension_agencies_agency_org_id_fkey" FOREIGN KEY ("agency_org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_submission_extension_agencies"
    ADD CONSTRAINT "campaign_submission_extension_agencies_extension_id_fkey" FOREIGN KEY ("extension_id") REFERENCES "public"."campaign_submission_extensions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_submission_extensions"
    ADD CONSTRAINT "campaign_submission_extensions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_submission_extensions"
    ADD CONSTRAINT "campaign_submission_extensions_granted_by_profile_id_fkey" FOREIGN KEY ("granted_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_brand_org_id_fkey" FOREIGN KEY ("brand_org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_runway_show_id_fkey" FOREIGN KEY ("runway_show_id") REFERENCES "public"."runway_shows"("id");



ALTER TABLE ONLY "public"."casting_entries"
    ADD CONSTRAINT "casting_entries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."casting_entries"
    ADD CONSTRAINT "casting_entries_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."model_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."castings"
    ADD CONSTRAINT "castings_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."castings"
    ADD CONSTRAINT "castings_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."model_profiles"("id");



ALTER TABLE ONLY "public"."crew_members"
    ADD CONSTRAINT "crew_members_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crew_payees"
    ADD CONSTRAINT "crew_payees_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_crew_payee_id_fkey" FOREIGN KEY ("crew_payee_id") REFERENCES "public"."crew_payees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_invited_by_profile_id_fkey" FOREIGN KEY ("invited_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."model_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."invoice_card_payment_lines"
    ADD CONSTRAINT "invoice_card_payment_lines_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."invoice_card_payment_lines"
    ADD CONSTRAINT "invoice_card_payment_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_payee_crew_payee_id_fkey" FOREIGN KEY ("payee_crew_payee_id") REFERENCES "public"."crew_payees"("id");



ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_payee_model_id_fkey" FOREIGN KEY ("payee_model_id") REFERENCES "public"."model_profiles"("id");



ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_payee_org_id_fkey" FOREIGN KEY ("payee_org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_payee_confirmed_by_profile_id_fkey" FOREIGN KEY ("payee_confirmed_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_voided_by_profile_id_fkey" FOREIGN KEY ("voided_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_brand_org_id_fkey" FOREIGN KEY ("brand_org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."looks"
    ADD CONSTRAINT "looks_assigned_dresser_id_fkey" FOREIGN KEY ("assigned_dresser_id") REFERENCES "public"."crew_members"("id");



ALTER TABLE ONLY "public"."looks"
    ADD CONSTRAINT "looks_assigned_hair_id_fkey" FOREIGN KEY ("assigned_hair_id") REFERENCES "public"."crew_members"("id");



ALTER TABLE ONLY "public"."looks"
    ADD CONSTRAINT "looks_assigned_makeup_id_fkey" FOREIGN KEY ("assigned_makeup_id") REFERENCES "public"."crew_members"("id");



ALTER TABLE ONLY "public"."looks"
    ADD CONSTRAINT "looks_assigned_model_id_fkey" FOREIGN KEY ("assigned_model_id") REFERENCES "public"."model_profiles"("id");



ALTER TABLE ONLY "public"."looks"
    ADD CONSTRAINT "looks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."model_documents"
    ADD CONSTRAINT "model_documents_attested_by_profile_id_fkey" FOREIGN KEY ("attested_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."model_documents"
    ADD CONSTRAINT "model_documents_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."model_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."model_documents"
    ADD CONSTRAINT "model_documents_relationship_id_fkey" FOREIGN KEY ("relationship_id") REFERENCES "public"."agency_model_relationships"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."model_documents"
    ADD CONSTRAINT "model_documents_uploaded_by_profile_id_fkey" FOREIGN KEY ("uploaded_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."model_documents"
    ADD CONSTRAINT "model_documents_uploading_agency_org_id_fkey" FOREIGN KEY ("uploading_agency_org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."model_profiles"
    ADD CONSTRAINT "model_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."model_profiles"
    ADD CONSTRAINT "model_profiles_suspended_by_profile_id_fkey" FOREIGN KEY ("suspended_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."org_memberships"
    ADD CONSTRAINT "org_memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_memberships"
    ADD CONSTRAINT "org_memberships_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_authorized_by_profile_id_fkey" FOREIGN KEY ("authorized_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shoot_days"
    ADD CONSTRAINT "shoot_days_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submission_comments"
    ADD CONSTRAINT "submission_comments_author_org_id_fkey" FOREIGN KEY ("author_org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."submission_comments"
    ADD CONSTRAINT "submission_comments_author_profile_id_fkey" FOREIGN KEY ("author_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."submission_comments"
    ADD CONSTRAINT "submission_comments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."model_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_reviewed_by_profile_id_fkey" FOREIGN KEY ("reviewed_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_submitted_by_profile_id_fkey" FOREIGN KEY ("submitted_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_submitting_agency_id_fkey" FOREIGN KEY ("submitting_agency_id") REFERENCES "public"."organizations"("id");



ALTER TABLE "public"."agency_model_relationships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agency_model_relationships_select" ON "public"."agency_model_relationships" FOR SELECT USING ((("model_id" = "public"."my_model_id"()) OR ("agency_org_id" = "public"."my_org_id"())));



CREATE POLICY "agency_model_relationships_select_brand" ON "public"."agency_model_relationships" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."submissions" "s"
  WHERE (("s"."model_id" = "agency_model_relationships"."model_id") AND "public"."is_campaigns_brand"("s"."campaign_id")))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_insert" ON "public"."bookings" FOR INSERT WITH CHECK ((("brand_org_id" = "public"."my_org_id"()) AND ("public"."my_access_level"() = 'administrator'::"public"."membership_access_level")));



CREATE POLICY "bookings_select" ON "public"."bookings" FOR SELECT USING ((("brand_org_id" = "public"."my_org_id"()) OR ("agency_org_id" = "public"."my_org_id"()) OR ("model_id" = "public"."my_model_id"())));



ALTER TABLE "public"."brand_agency_partnerships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_agency_partnerships_select" ON "public"."brand_agency_partnerships" FOR SELECT USING ((("brand_org_id" = "public"."my_org_id"()) OR ("agency_org_id" = "public"."my_org_id"())));



CREATE POLICY "brand_agency_partnerships_write" ON "public"."brand_agency_partnerships" USING ((("brand_org_id" = "public"."my_org_id"()) AND ("public"."my_access_level"() = 'administrator'::"public"."membership_access_level"))) WITH CHECK ((("brand_org_id" = "public"."my_org_id"()) AND ("public"."my_access_level"() = 'administrator'::"public"."membership_access_level")));



ALTER TABLE "public"."call_sheet_role_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "call_sheet_role_categories_select" ON "public"."call_sheet_role_categories" FOR SELECT USING (true);



ALTER TABLE "public"."campaign_agency_distributions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_agency_distributions_select" ON "public"."campaign_agency_distributions" FOR SELECT USING (("public"."is_campaigns_brand"("campaign_id") OR ("agency_org_id" = "public"."my_org_id"())));



CREATE POLICY "campaign_agency_distributions_write" ON "public"."campaign_agency_distributions" USING (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"])))) WITH CHECK (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"]))));



ALTER TABLE "public"."campaign_crew_slots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_crew_slots_select" ON "public"."campaign_crew_slots" FOR SELECT USING (("public"."my_call_sheet_role"("campaign_id") IS NOT NULL));



ALTER TABLE "public"."campaign_guest_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_guest_access_select_self" ON "public"."campaign_guest_access" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."crew_payees" "cp"
  WHERE (("cp"."id" = "campaign_guest_access"."crew_payee_id") AND ("cp"."profile_id" = "auth"."uid"())))));



ALTER TABLE "public"."campaign_submission_extension_agencies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_submission_extension_agencies_select" ON "public"."campaign_submission_extension_agencies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."campaign_submission_extensions" "e"
  WHERE (("e"."id" = "campaign_submission_extension_agencies"."extension_id") AND ("public"."is_campaigns_brand"("e"."campaign_id") OR ("campaign_submission_extension_agencies"."agency_org_id" = "public"."my_org_id"()))))));



CREATE POLICY "campaign_submission_extension_agencies_write" ON "public"."campaign_submission_extension_agencies" USING ((EXISTS ( SELECT 1
   FROM "public"."campaign_submission_extensions" "e"
  WHERE (("e"."id" = "campaign_submission_extension_agencies"."extension_id") AND "public"."is_campaigns_brand"("e"."campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."campaign_submission_extensions" "e"
  WHERE (("e"."id" = "campaign_submission_extension_agencies"."extension_id") AND "public"."is_campaigns_brand"("e"."campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"]))))));



ALTER TABLE "public"."campaign_submission_extensions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_submission_extensions_select" ON "public"."campaign_submission_extensions" FOR SELECT USING (("public"."is_campaigns_brand"("campaign_id") OR ("public"."agency_distributed_on"("campaign_id") AND ("applies_to_all_agencies" OR (EXISTS ( SELECT 1
   FROM "public"."campaign_submission_extension_agencies" "a"
  WHERE (("a"."extension_id" = "campaign_submission_extensions"."id") AND ("a"."agency_org_id" = "public"."my_org_id"()))))))));



CREATE POLICY "campaign_submission_extensions_write" ON "public"."campaign_submission_extensions" USING (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"])))) WITH CHECK (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"]))));



ALTER TABLE "public"."campaign_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaigns_select" ON "public"."campaigns" FOR SELECT USING ((("brand_org_id" = "public"."my_org_id"()) OR "public"."agency_distributed_on"("id")));



CREATE POLICY "campaigns_select_crew" ON "public"."campaigns" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."campaign_guest_access" "g"
     JOIN "public"."crew_payees" "cp" ON (("cp"."id" = "g"."crew_payee_id")))
  WHERE (("g"."campaign_id" = "campaigns"."id") AND ("cp"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."campaign_crew_slots" "ccs"
     JOIN "public"."crew_payees" "cp" ON (("cp"."id" = "ccs"."crew_payee_id")))
  WHERE (("ccs"."campaign_id" = "campaigns"."id") AND ("cp"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "campaigns_select_model" ON "public"."campaigns" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."campaign_id" = "campaigns"."id") AND ("b"."model_id" = "public"."my_model_id"())))));



CREATE POLICY "campaigns_write" ON "public"."campaigns" USING ((("brand_org_id" = "public"."my_org_id"()) AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"])))) WITH CHECK ((("brand_org_id" = "public"."my_org_id"()) AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"]))));



ALTER TABLE "public"."casting_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "casting_entries_select" ON "public"."casting_entries" FOR SELECT USING (("public"."is_campaigns_brand"("campaign_id") OR "public"."agency_has_model"("model_id")));



CREATE POLICY "casting_entries_write" ON "public"."casting_entries" USING (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"])))) WITH CHECK (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"]))));



ALTER TABLE "public"."castings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "castings_select" ON "public"."castings" FOR SELECT USING ("public"."is_campaigns_brand"("campaign_id"));



CREATE POLICY "castings_write" ON "public"."castings" USING (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"])))) WITH CHECK (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"]))));



ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contracts_select" ON "public"."contracts" FOR SELECT USING ("public"."is_campaigns_brand"("campaign_id"));



CREATE POLICY "contracts_write" ON "public"."contracts" USING (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"])))) WITH CHECK (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"]))));



ALTER TABLE "public"."crew_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crew_members_select" ON "public"."crew_members" FOR SELECT USING ("public"."is_campaigns_brand"("campaign_id"));



CREATE POLICY "crew_members_write" ON "public"."crew_members" USING (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"])))) WITH CHECK (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"]))));



ALTER TABLE "public"."crew_payees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crew_payees_select_self" ON "public"."crew_payees" FOR SELECT USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "crew_payees_select_via_brand_history" ON "public"."crew_payees" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."campaign_crew_slots" "ccs"
  WHERE (("ccs"."crew_payee_id" = "crew_payees"."id") AND "public"."is_campaigns_brand"("ccs"."campaign_id")))));



CREATE POLICY "crew_payees_update_self" ON "public"."crew_payees" FOR UPDATE USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invites_select" ON "public"."invites" FOR SELECT USING ((("org_id" = "public"."my_org_id"()) AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"]))));



CREATE POLICY "invites_write" ON "public"."invites" USING ((("org_id" = "public"."my_org_id"()) AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"])))) WITH CHECK ((("org_id" = "public"."my_org_id"()) AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"]))));



ALTER TABLE "public"."invoice_card_payment_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_line_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_line_items_select" ON "public"."invoice_line_items" FOR SELECT USING ((("payee_org_id" = "public"."my_org_id"()) OR ("payee_model_id" = "public"."my_model_id"()) OR ("payee_crew_payee_id" = "public"."my_crew_payee_id"()) OR ("public"."invoice_brand_org"("invoice_id") = "public"."my_org_id"())));



ALTER TABLE "public"."invoice_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_payments_select" ON "public"."invoice_payments" FOR SELECT USING ((("public"."invoice_brand_org"("invoice_id") = "public"."my_org_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."invoice_line_items" "li"
  WHERE (("li"."invoice_id" = "invoice_payments"."invoice_id") AND (("li"."payee_org_id" = "public"."my_org_id"()) OR ("li"."payee_model_id" = "public"."my_model_id"()) OR ("li"."payee_crew_payee_id" = "public"."my_crew_payee_id"())))))));



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_select" ON "public"."invoices" FOR SELECT USING ((("brand_org_id" = "public"."my_org_id"()) OR "public"."invoice_has_payee"("id", "public"."my_org_id"(), "public"."my_model_id"(), "public"."my_crew_payee_id"())));



ALTER TABLE "public"."looks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "looks_select" ON "public"."looks" FOR SELECT USING (("public"."is_campaigns_brand"("campaign_id") OR (("assigned_model_id" IS NOT NULL) AND "public"."agency_has_model"("assigned_model_id"))));



CREATE POLICY "looks_write" ON "public"."looks" USING (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"])))) WITH CHECK (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"]))));



ALTER TABLE "public"."model_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "model_documents_select" ON "public"."model_documents" FOR SELECT USING (("public"."my_document_access"("id") IS NOT NULL));



ALTER TABLE "public"."model_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "model_profiles_insert" ON "public"."model_profiles" FOR INSERT WITH CHECK (("public"."my_role"() = 'agency_staff'::"public"."profile_role"));



CREATE POLICY "model_profiles_select" ON "public"."model_profiles" FOR SELECT USING ((("profile_id" = "auth"."uid"()) OR "public"."agency_has_model"("id") OR (EXISTS ( SELECT 1
   FROM "public"."submissions" "s"
  WHERE (("s"."model_id" = "model_profiles"."id") AND "public"."is_campaigns_brand"("s"."campaign_id"))))));



CREATE POLICY "model_profiles_select_independent" ON "public"."model_profiles" FOR SELECT USING (("is_independent" = true));



CREATE POLICY "model_profiles_update" ON "public"."model_profiles" FOR UPDATE USING ((("profile_id" = "auth"."uid"()) OR "public"."agency_is_mother"("id")));



ALTER TABLE "public"."org_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_memberships_select" ON "public"."org_memberships" FOR SELECT USING (("org_id" = "public"."my_org_id"()));



CREATE POLICY "org_memberships_write" ON "public"."org_memberships" USING ((("org_id" = "public"."my_org_id"()) AND ("public"."my_access_level"() = 'administrator'::"public"."membership_access_level"))) WITH CHECK ((("org_id" = "public"."my_org_id"()) AND ("public"."my_access_level"() = 'administrator'::"public"."membership_access_level")));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_select" ON "public"."organizations" FOR SELECT USING ((("id" = "public"."my_org_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."brand_agency_partnerships" "p"
  WHERE ((("p"."brand_org_id" = "public"."my_org_id"()) AND ("p"."agency_org_id" = "organizations"."id")) OR (("p"."agency_org_id" = "public"."my_org_id"()) AND ("p"."brand_org_id" = "organizations"."id"))))) OR (EXISTS ( SELECT 1
   FROM "public"."agency_model_relationships" "amr"
  WHERE (("amr"."model_id" = "public"."my_model_id"()) AND ("amr"."agency_org_id" = "organizations"."id") AND ("amr"."status" = 'active'::"public"."agency_relationship_status"))))));



CREATE POLICY "organizations_select_crew" ON "public"."organizations" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM (("public"."campaign_guest_access" "g"
     JOIN "public"."crew_payees" "cp" ON (("cp"."id" = "g"."crew_payee_id")))
     JOIN "public"."campaigns" "c" ON (("c"."id" = "g"."campaign_id")))
  WHERE (("c"."brand_org_id" = "organizations"."id") AND ("cp"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."campaign_crew_slots" "ccs"
     JOIN "public"."crew_payees" "cp" ON (("cp"."id" = "ccs"."crew_payee_id")))
     JOIN "public"."campaigns" "c" ON (("c"."id" = "ccs"."campaign_id")))
  WHERE (("c"."brand_org_id" = "organizations"."id") AND ("cp"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "organizations_select_model_booking" ON "public"."organizations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."bookings" "b"
     JOIN "public"."campaigns" "c" ON (("c"."id" = "b"."campaign_id")))
  WHERE (("b"."model_id" = "public"."my_model_id"()) AND ("c"."brand_org_id" = "organizations"."id")))));



CREATE POLICY "organizations_select_via_submission" ON "public"."organizations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."agency_model_relationships" "amr"
     JOIN "public"."submissions" "s" ON (("s"."model_id" = "amr"."model_id")))
     JOIN "public"."campaigns" "c" ON (("c"."id" = "s"."campaign_id")))
  WHERE (("amr"."agency_org_id" = "organizations"."id") AND ("c"."brand_org_id" = "public"."my_org_id"())))));



CREATE POLICY "organizations_update" ON "public"."organizations" FOR UPDATE USING ((("id" = "public"."my_org_id"()) AND ("public"."my_access_level"() = 'administrator'::"public"."membership_access_level")));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."org_memberships" "mine",
    "public"."org_memberships" "theirs"
  WHERE (("mine"."profile_id" = "auth"."uid"()) AND ("theirs"."profile_id" = "profiles"."id") AND ("mine"."org_id" = "theirs"."org_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."model_profiles" "mp"
  WHERE (("mp"."profile_id" = "profiles"."id") AND "public"."agency_has_model"("mp"."id"))))));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."runway_shows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "runway_shows_insert" ON "public"."runway_shows" FOR INSERT WITH CHECK (("public"."my_role"() = 'brand_staff'::"public"."profile_role"));



CREATE POLICY "runway_shows_select" ON "public"."runway_shows" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."campaigns" "c"
  WHERE (("c"."runway_show_id" = "runway_shows"."id") AND "public"."is_campaigns_brand"("c"."id")))));



ALTER TABLE "public"."shoot_days" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shoot_days_select" ON "public"."shoot_days" FOR SELECT USING ("public"."is_campaigns_brand"("campaign_id"));



CREATE POLICY "shoot_days_write" ON "public"."shoot_days" USING (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"])))) WITH CHECK (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"]))));



ALTER TABLE "public"."submission_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "submission_comments_delete" ON "public"."submission_comments" FOR DELETE USING (("author_profile_id" = "auth"."uid"()));



CREATE POLICY "submission_comments_insert" ON "public"."submission_comments" FOR INSERT WITH CHECK ((("public"."my_role"() = 'brand_staff'::"public"."profile_role") AND (EXISTS ( SELECT 1
   FROM "public"."submissions" "s"
  WHERE (("s"."id" = "submission_comments"."submission_id") AND "public"."is_campaigns_brand"("s"."campaign_id"))))));



CREATE POLICY "submission_comments_select" ON "public"."submission_comments" FOR SELECT USING ((("public"."my_role"() = 'brand_staff'::"public"."profile_role") AND (EXISTS ( SELECT 1
   FROM "public"."submissions" "s"
  WHERE (("s"."id" = "submission_comments"."submission_id") AND "public"."is_campaigns_brand"("s"."campaign_id"))))));



ALTER TABLE "public"."submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "submissions_select" ON "public"."submissions" FOR SELECT USING (("public"."is_campaigns_brand"("campaign_id") OR ("submitting_agency_id" = "public"."my_org_id"()) OR ("model_id" = "public"."my_model_id"())));



CREATE POLICY "submissions_update_agency" ON "public"."submissions" FOR UPDATE USING ((("submitting_agency_id" = "public"."my_org_id"()) AND ("reviewed_at" IS NULL) AND ("stage" = 'submitted'::"public"."submission_stage"))) WITH CHECK ((("submitting_agency_id" = "public"."my_org_id"()) AND ("reviewed_at" IS NULL) AND ("stage" = 'submitted'::"public"."submission_stage")));



CREATE POLICY "submissions_update_brand" ON "public"."submissions" FOR UPDATE USING (("public"."is_campaigns_brand"("campaign_id") AND ("public"."my_access_level"() = ANY (ARRAY['administrator'::"public"."membership_access_level", 'enhanced'::"public"."membership_access_level"]))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";











































































































































































REVOKE ALL ON FUNCTION "public"."add_new_model_to_roster"("p_full_name" "text", "p_email" "text", "p_location" "text", "p_default_day_rate" numeric, "p_height" "text", "p_experience" "text", "p_date_of_birth" "date", "p_phone" "text", "p_representation_type" "text", "p_is_mother_agency" boolean, "p_territories" "text"[], "p_exclusivity" "public"."representation_exclusivity", "p_effective_start_date" "date", "p_effective_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_new_model_to_roster"("p_full_name" "text", "p_email" "text", "p_location" "text", "p_default_day_rate" numeric, "p_height" "text", "p_experience" "text", "p_date_of_birth" "date", "p_phone" "text", "p_representation_type" "text", "p_is_mother_agency" boolean, "p_territories" "text"[], "p_exclusivity" "public"."representation_exclusivity", "p_effective_start_date" "date", "p_effective_end_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."assign_call_sheet_role"("p_campaign_id" "uuid", "p_role_key" "text", "p_crew_payee_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_call_sheet_role"("p_campaign_id" "uuid", "p_role_key" "text", "p_crew_payee_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."check_possible_model_duplicate"("p_full_name" "text", "p_email" "text", "p_phone" "text", "p_date_of_birth" "date", "p_location" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_possible_model_duplicate"("p_full_name" "text", "p_email" "text", "p_phone" "text", "p_date_of_birth" "date", "p_location" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."clear_call_sheet_role"("p_campaign_id" "uuid", "p_role_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clear_call_sheet_role"("p_campaign_id" "uuid", "p_role_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."complete_org_signup"("p_org_name" "text", "p_org_type" "public"."org_type") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_org_signup"("p_org_name" "text", "p_org_type" "public"."org_type") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."confirm_invoice_payment"("p_payment_id" "uuid", "p_signature_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_invoice_payment"("p_payment_id" "uuid", "p_signature_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_model_document"("p_model_id" "uuid", "p_relationship_id" "uuid", "p_visibility" "public"."document_visibility", "p_category" "public"."document_category", "p_file_name" "text", "p_mime_type" "text", "p_attested_authority" boolean, "p_attested_upload_rights" boolean, "p_attested_accurate" boolean, "p_attested_will_update" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_model_document"("p_model_id" "uuid", "p_relationship_id" "uuid", "p_visibility" "public"."document_visibility", "p_category" "public"."document_category", "p_file_name" "text", "p_mime_type" "text", "p_attested_authority" boolean, "p_attested_upload_rights" boolean, "p_attested_accurate" boolean, "p_attested_will_update" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_representation_relationship"("p_model_id" "uuid", "p_representation_type" "text", "p_is_mother_agency" boolean, "p_territories" "text"[], "p_exclusivity" "public"."representation_exclusivity", "p_effective_start_date" "date", "p_effective_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_representation_relationship"("p_model_id" "uuid", "p_representation_type" "text", "p_is_mother_agency" boolean, "p_territories" "text"[], "p_exclusivity" "public"."representation_exclusivity", "p_effective_start_date" "date", "p_effective_end_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."end_representation_relationship"("p_relationship_id" "uuid", "p_effective_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."end_representation_relationship"("p_relationship_id" "uuid", "p_effective_end_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."fetch_org_audit_log"("p_limit" integer, "p_before" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fetch_org_audit_log"("p_limit" integer, "p_before" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_invite_by_token"("p_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_invite_by_token"("p_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invite_by_token"("p_token" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



REVOKE ALL ON FUNCTION "public"."invite_crew_to_call_sheet"("p_campaign_id" "uuid", "p_role_key" "text", "p_full_name" "text", "p_email" "text", "p_discipline" "public"."crew_discipline") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invite_crew_to_call_sheet"("p_campaign_id" "uuid", "p_role_key" "text", "p_full_name" "text", "p_email" "text", "p_discipline" "public"."crew_discipline") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."lock_overdue_accounts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lock_overdue_accounts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."my_call_sheet_role"("p_campaign_id" "uuid", "p_role_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."my_call_sheet_role"("p_campaign_id" "uuid", "p_role_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."my_document_access"("p_document_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."my_document_access"("p_document_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."record_audit_event"("p_action" "text", "p_object_type" "text", "p_object_id" "uuid", "p_campaign_id" "uuid", "p_previous_value" "jsonb", "p_new_value" "jsonb", "p_request_id" "uuid", "p_artifact_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_audit_event"("p_action" "text", "p_object_type" "text", "p_object_id" "uuid", "p_campaign_id" "uuid", "p_previous_value" "jsonb", "p_new_value" "jsonb", "p_request_id" "uuid", "p_artifact_hash" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."record_invoice_payment"("p_campaign_id" "uuid", "p_invoice_total" numeric, "p_amount" numeric, "p_method" "text", "p_reference_note" "text", "p_agency_org_id" "uuid", "p_model_id" "uuid", "p_crew_payee_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_invoice_payment"("p_campaign_id" "uuid", "p_invoice_total" numeric, "p_amount" numeric, "p_method" "text", "p_reference_note" "text", "p_agency_org_id" "uuid", "p_model_id" "uuid", "p_crew_payee_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."record_payment_attempt"("p_booking_id" "uuid", "p_amount" numeric, "p_status" "public"."transaction_status", "p_stripe_payment_intent_id" "text", "p_stripe_charge_id" "text", "p_failure_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_payment_attempt"("p_booking_id" "uuid", "p_amount" numeric, "p_status" "public"."transaction_status", "p_stripe_payment_intent_id" "text", "p_stripe_charge_id" "text", "p_failure_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."redeem_crew_access"("p_access_code" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."redeem_crew_access"("p_access_code" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_crew_access"("p_access_code" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."reserve_invoice_for_card_payment"("p_campaign_id" "uuid", "p_invoice_total" numeric, "p_agency_org_id" "uuid", "p_model_id" "uuid", "p_crew_payee_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_invoice_for_card_payment"("p_campaign_id" "uuid", "p_invoice_total" numeric, "p_agency_org_id" "uuid", "p_model_id" "uuid", "p_crew_payee_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_department_lead"("p_campaign_id" "uuid", "p_role_key" "text", "p_is_lead" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_department_lead"("p_campaign_id" "uuid", "p_role_key" "text", "p_is_lead" boolean) TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_independent_model"("p_campaign_id" "uuid", "p_model_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_independent_model"("p_campaign_id" "uuid", "p_model_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."submit_talent"("p_campaign_id" "uuid", "p_model_id" "uuid", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_talent"("p_campaign_id" "uuid", "p_model_id" "uuid", "p_notes" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_crew_slot_rate"("p_campaign_id" "uuid", "p_role_key" "text", "p_rate" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_crew_slot_rate"("p_campaign_id" "uuid", "p_role_key" "text", "p_rate" numeric) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."void_invoice_payment"("p_payment_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."void_invoice_payment"("p_payment_id" "uuid", "p_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";
























GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."agency_model_relationships" TO "anon";
GRANT ALL ON TABLE "public"."agency_model_relationships" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."agency_model_relationships" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."audit_log" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."audit_log" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."audit_log" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bookings" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."booking_breakdown_v" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."booking_breakdown_v" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."booking_breakdown_v" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."brand_agency_partnerships" TO "anon";
GRANT ALL ON TABLE "public"."brand_agency_partnerships" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."brand_agency_partnerships" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."call_sheet_role_categories" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."call_sheet_role_categories" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."call_sheet_role_categories" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_agency_distributions" TO "anon";
GRANT ALL ON TABLE "public"."campaign_agency_distributions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_agency_distributions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_crew_slots" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_crew_slots" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_crew_slots" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_guest_access" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_guest_access" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_guest_access" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_submission_extension_agencies" TO "anon";
GRANT ALL ON TABLE "public"."campaign_submission_extension_agencies" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_submission_extension_agencies" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_submission_extensions" TO "anon";
GRANT ALL ON TABLE "public"."campaign_submission_extensions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_submission_extensions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_templates" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_templates" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaign_templates" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campaigns" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."casting_entries" TO "anon";
GRANT ALL ON TABLE "public"."casting_entries" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."casting_entries" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."castings" TO "anon";
GRANT ALL ON TABLE "public"."castings" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."castings" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."contracts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."contracts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."contracts" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."crew_members" TO "anon";
GRANT ALL ON TABLE "public"."crew_members" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."crew_members" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."crew_payees" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."crew_payees" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."crew_payees" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invites" TO "anon";
GRANT ALL ON TABLE "public"."invites" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invites" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoice_card_payment_lines" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoice_card_payment_lines" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoice_card_payment_lines" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoice_line_items" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoice_line_items" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."invoice_line_items" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoice_payments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoice_payments" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoice_payments" TO "service_role";



GRANT UPDATE("stripe_noncircumvention_invoice_id") ON TABLE "public"."invoice_payments" TO "service_role";



GRANT UPDATE("noncircumvention_invoice_created_at") ON TABLE "public"."invoice_payments" TO "service_role";



GRANT UPDATE("noncircumvention_invoice_paid_at") ON TABLE "public"."invoice_payments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoices" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoices" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invoices" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."looks" TO "anon";
GRANT ALL ON TABLE "public"."looks" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."looks" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."model_documents" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."model_documents" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."model_documents" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."model_profiles" TO "anon";
GRANT ALL ON TABLE "public"."model_profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."model_profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."org_memberships" TO "anon";
GRANT ALL ON TABLE "public"."org_memberships" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."org_memberships" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organizations" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organizations" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organizations" TO "service_role";



GRANT UPDATE("name") ON TABLE "public"."organizations" TO "authenticated";



GRANT UPDATE("subscription_status") ON TABLE "public"."organizations" TO "service_role";



GRANT UPDATE("stripe_customer_id") ON TABLE "public"."organizations" TO "service_role";



GRANT UPDATE("stripe_subscription_id") ON TABLE "public"."organizations" TO "service_role";



GRANT UPDATE("stripe_connect_account_id") ON TABLE "public"."organizations" TO "service_role";



GRANT UPDATE("stripe_connect_charges_enabled") ON TABLE "public"."organizations" TO "service_role";



GRANT UPDATE("stripe_connect_payouts_enabled") ON TABLE "public"."organizations" TO "service_role";



GRANT UPDATE("calendar_feed_token") ON TABLE "public"."organizations" TO "authenticated";



GRANT UPDATE("logo_url") ON TABLE "public"."organizations" TO "authenticated";



GRANT UPDATE("payment_locked") ON TABLE "public"."organizations" TO "service_role";



GRANT UPDATE("self_described_services") ON TABLE "public"."organizations" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";



GRANT UPDATE("full_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("phone") ON TABLE "public"."profiles" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."runway_shows" TO "anon";
GRANT ALL ON TABLE "public"."runway_shows" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."runway_shows" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."shoot_days" TO "anon";
GRANT ALL ON TABLE "public"."shoot_days" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."shoot_days" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."submission_comments" TO "anon";
GRANT ALL ON TABLE "public"."submission_comments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."submission_comments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."submissions" TO "anon";
GRANT ALL ON TABLE "public"."submissions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."submissions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";




































-- ─── auth.users trigger (from 0004_auth_provisioning.sql) ───
-- Not captured by `supabase db dump`'s default scope (it only dumps
-- public-schema objects, and this trigger is defined ON auth.users) —
-- CASCADE-dropped along with handle_new_user() above, recreated here
-- verbatim from what's actually live (confirmed via pg_get_triggerdef
-- against the real database, not re-derived from old migration files).
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Storage: model documents buckets + policies (from 0030_model_documents.sql / storage schema dump) ───

insert into storage.buckets (id, name, public)
  values ('model-public-assets', 'model-public-assets', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('model-restricted-docs', 'model-restricted-docs', false)
  on conflict (id) do nothing;

-- storage.objects already has RLS enabled by default on every Supabase
-- project (local and hosted) — re-asserting it here failed locally with
-- "must be owner of table objects" since the local postgres role isn't
-- the owner of that platform-managed table, and it's a no-op anyway.

CREATE POLICY "model_documents_storage_insert" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = ANY (ARRAY['model-public-assets'::"text", 'model-restricted-docs'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."model_documents" "md"
  WHERE (("md"."id" = (("storage"."foldername"("objects"."name"))[2])::"uuid") AND ("md"."storage_bucket" = "objects"."bucket_id") AND ("md"."storage_path" = "objects"."name") AND ("md"."uploading_agency_org_id" = "public"."my_org_id"()))))));

CREATE POLICY "model_documents_storage_select" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = ANY (ARRAY['model-public-assets'::"text", 'model-restricted-docs'::"text"])) AND ("public"."my_document_access"((("storage"."foldername"("name"))[2])::"uuid") IS NOT NULL)));
