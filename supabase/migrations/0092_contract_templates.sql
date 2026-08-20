-- Real contract templates. "Generate Contract" used to mean inserting
-- a metadata row (rate/territory/duration/status) with no actual
-- document anywhere -- confirmed directly: the contracts table (0032)
-- has no body/terms/document column, no PDF/rich-text library exists in
-- this repo, and the model's own signing screen never rendered any
-- contract text, just a "type your name" box. This migration adds the
-- real thing: a brand picks a DVURE-standard or their own uploaded/
-- authored template, edits it inside DVURE, and every sent contract
-- snapshots real document content at send time (immutable afterward,
-- so a later template edit never rewrites an already-sent contract).
--
-- NOTE on the storage bucket: a bucket literally named 'contract-
-- templates' already exists live (confirmed directly -- listing it
-- succeeds with no error) but isn't defined in any migration here, the
-- same "created directly against the live DB" gap found repeatedly
-- this session. The insert below is on-conflict-do-nothing specifically
-- so this migration is safe to run whether or not that's the same
-- bucket; the RLS policies are what actually need to exist and are
-- created fresh regardless.

create table contract_templates (
  id uuid primary key default gen_random_uuid(),
  -- null = DVURE's own global default, readable by every authenticated
  -- user regardless of org. Non-null = one brand's own template,
  -- visible only to that org.
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  source text not null check (source in ('dvure_default', 'uploaded', 'authored')),
  -- The editable body. Null is a real, distinct state ("uploaded but
  -- not yet converted/reviewed") -- callers must check for non-empty
  -- content before offering a template as usable, not just existence
  -- of the row.
  content_html text,
  -- The original uploaded file, kept as a reference even after
  -- content_html has been edited -- conversion (docx) or extraction
  -- (pdf) is never assumed perfect, so the source stays available.
  original_file_bucket text,
  original_file_path text,
  original_file_name text,
  original_file_mime text,
  created_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contract_templates_org_id_idx on contract_templates (org_id);

alter table contract_templates enable row level security;

-- The DVURE default (org_id is null) is readable by anyone signed in;
-- a brand's own templates are readable only by that brand's own org.
create policy contract_templates_select on contract_templates for select using (
  org_id is null or org_id = my_org_id()
);

-- Write access mirrors contracts_write (0032) exactly -- same
-- administrator/enhanced tier already gates who can touch a contract's
-- money/terms, so the same tier gates what document backs it. The
-- DVURE default (org_id null) is never writable by a brand — seeded
-- once below, updated only by hand going forward.
create policy contract_templates_write on contract_templates for all using (
  org_id = my_org_id() and my_access_level() in ('administrator', 'enhanced')
) with check (
  org_id = my_org_id() and my_access_level() in ('administrator', 'enhanced')
);

grant select, insert, update, delete on contract_templates to authenticated;

-- A real starting point, not a null gap -- the mandatory-template gate
-- (accessGate.ts) checks organizations.default_contract_template_id is
-- non-null, and a brand's own template picker needs the DVURE option to
-- actually point somewhere. Real legal content to replace this placeholder
-- is coming separately -- this migration just needs a non-null row to exist.
insert into contract_templates (org_id, name, source, content_html)
values (
  null,
  'DVURE Standard Contract',
  'dvure_default',
  '<h1>Placeholder — DVURE Standard Contract</h1><p>This is placeholder text. Replace this template''s content in Settings before using it on a real booking.</p><p>Model: {{model_name}} &middot; Day rate: {{day_rate}} &middot; Territory: {{territory}} &middot; Duration: {{duration}}</p>'
);

-- Nullable -- null is exactly the "hasn't chosen a default yet" state
-- the mandatory gate checks for. Brands are never auto-defaulted to the
-- DVURE template on signup; picking one (even DVURE's own) is meant to
-- be an explicit choice per the user's own instruction.
alter table organizations add column default_contract_template_id uuid references contract_templates(id);

-- document_html is the resolved, merge-tag-filled snapshot taken once,
-- at send time -- contract_template_id just records which template it
-- came from, for reference, not for re-resolving later.
alter table contracts add column contract_template_id uuid references contract_templates(id);
alter table contracts add column document_html text;

-- Bucket may already exist live (see migration header) — idempotent
-- either way. Private (not public): every read goes through a signed
-- URL, same posture as the rest of this app's document storage.
insert into storage.buckets (id, name, public)
values ('contract-templates', 'contract-templates', false)
on conflict (id) do nothing;

-- Path convention: {org_id}/{template_id}/{filename} — org_id as the
-- first path segment is what lets RLS scope access without a join,
-- the standard Supabase Storage idiom (storage.foldername(name))[1].
drop policy if exists contract_templates_storage_select on storage.objects;
create policy contract_templates_storage_select on storage.objects for select using (
  bucket_id = 'contract-templates' and (storage.foldername(name))[1] = my_org_id()::text
);

drop policy if exists contract_templates_storage_write on storage.objects;
create policy contract_templates_storage_write on storage.objects for all using (
  bucket_id = 'contract-templates' and (storage.foldername(name))[1] = my_org_id()::text
  and my_access_level() in ('administrator', 'enhanced')
) with check (
  bucket_id = 'contract-templates' and (storage.foldername(name))[1] = my_org_id()::text
  and my_access_level() in ('administrator', 'enhanced')
);
