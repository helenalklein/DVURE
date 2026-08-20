import { supabase } from "../supabaseClient";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
// Vite's ?url suffix resolves to a real, correctly-bundled URL for the
// worker asset rather than trying to inline/parse it as JS — the
// standard pattern for pdfjs-dist under Vite.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type TemplateSource = "dvure_default" | "uploaded" | "authored";

export interface ContractTemplate {
  id: string;
  orgId: string | null;
  name: string;
  source: TemplateSource;
  contentHtml: string | null;
  originalFileName: string | null;
  updatedAt: string;
}

function mapRow(r: any): ContractTemplate {
  return {
    id: r.id as string,
    orgId: (r.org_id as string | null) ?? null,
    name: r.name as string,
    source: r.source as TemplateSource,
    contentHtml: (r.content_html as string | null) ?? null,
    originalFileName: (r.original_file_name as string | null) ?? null,
    updatedAt: r.updated_at as string,
  };
}

const TEMPLATE_COLUMNS = "id, org_id, name, source, content_html, original_file_name, updated_at";

export async function fetchDvureDefaultTemplate(): Promise<ContractTemplate | null> {
  const { data, error } = await supabase.from("contract_templates").select(TEMPLATE_COLUMNS).is("org_id", null).eq("source", "dvure_default").limit(1).maybeSingle();
  if (error || !data) return null;
  return mapRow(data);
}

export async function fetchOrgTemplates(orgId: string): Promise<ContractTemplate[]> {
  const { data, error } = await supabase.from("contract_templates").select(TEMPLATE_COLUMNS).eq("org_id", orgId).order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data.map(mapRow);
}

export async function fetchTemplateById(id: string): Promise<ContractTemplate | null> {
  const { data, error } = await supabase.from("contract_templates").select(TEMPLATE_COLUMNS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return mapRow(data);
}

// Two-step, same shape as org logo/other org-scoped writes in this repo
// (insert row -> upload bytes to a path derived from the id just
// returned) — simpler than documents.ts's reserve-then-upload RPC
// pattern, which exists there specifically for a cross-org attestation
// step that doesn't apply here (a brand only ever uploads to its own
// org's own path, no agency-on-behalf-of-a-model complexity).
export async function createTemplate(params: {
  orgId: string;
  name: string;
  source: TemplateSource;
  contentHtml: string;
  createdByProfileId: string;
  file?: File;
}): Promise<{ template: ContractTemplate | null; error: string | null }> {
  const { data, error } = await supabase
    .from("contract_templates")
    .insert({
      org_id: params.orgId,
      name: params.name,
      source: params.source,
      content_html: params.contentHtml,
      created_by_profile_id: params.createdByProfileId,
    })
    .select(TEMPLATE_COLUMNS)
    .single();
  if (error || !data) return { template: null, error: error?.message ?? "Couldn't save this template." };

  if (params.file) {
    const path = `${params.orgId}/${data.id}/${params.file.name}`;
    const { error: uploadError } = await supabase.storage.from("contract-templates").upload(path, params.file, { contentType: params.file.type || undefined });
    if (uploadError) return { template: mapRow(data), error: uploadError.message };
    const { error: patchError } = await supabase
      .from("contract_templates")
      .update({ original_file_bucket: "contract-templates", original_file_path: path, original_file_name: params.file.name, original_file_mime: params.file.type || null })
      .eq("id", data.id);
    if (patchError) return { template: mapRow(data), error: patchError.message };
  }

  return { template: mapRow(data), error: null };
}

export async function updateTemplateContent(templateId: string, contentHtml: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("contract_templates").update({ content_html: contentHtml, updated_at: new Date().toISOString() }).eq("id", templateId);
  return { error: error?.message ?? null };
}

// Nullable on organizations — null is exactly the "hasn't chosen yet"
// state the mandatory-template gate (accessGate.ts) checks for.
export async function setOrgDefaultTemplate(orgId: string, templateId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("organizations").update({ default_contract_template_id: templateId }).eq("id", orgId);
  return { error: error?.message ?? null };
}

// .docx -> HTML via mammoth, which is built specifically for this and
// reliably preserves headings/bold/italic/list structure for typical
// business documents. Runs entirely client-side on the uploaded file.
export async function convertDocxToHtml(file: File): Promise<{ html: string | null; warnings: string[]; error: string | null }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return { html: result.value, warnings: result.messages.map(m => m.message), error: null };
  } catch (e) {
    return { html: null, warnings: [], error: e instanceof Error ? e.message : "Couldn't read this .docx file." };
  }
}

// Best-effort plain-text extraction via pdf.js — PDF is a print/layout
// format, not a content format, so no attempt is made to preserve
// visual structure (columns, tables, headers/footers routinely mangle
// even with heavy tooling). This pulls a usable starting draft of the
// text itself, one <p> per page, and callers must show a "review
// carefully" notice — this is a draft, not a converted document.
export async function extractPdfText(file: File): Promise<{ html: string | null; error: string | null }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
      if (text.trim()) pages.push(`<p>${text.trim()}</p>`);
    }
    return { html: pages.join("\n"), error: null };
  } catch (e) {
    return { html: null, error: e instanceof Error ? e.message : "Couldn't read this PDF." };
  }
}
