import { supabase } from "../supabaseClient";

export type DocumentVisibility = "public" | "restricted";
export type DocumentCategory =
  | "headshot" | "digital" | "comp_card" | "portfolio" | "measurements" | "bio" | "other_public"
  | "representation_agreement" | "commission_agreement" | "amendment" | "management_agreement"
  | "placement_agreement" | "tax_document" | "identity_document" | "other_restricted";

const RESTRICTED_CATEGORIES: DocumentCategory[] = [
  "representation_agreement", "commission_agreement", "amendment", "management_agreement",
  "placement_agreement", "tax_document", "identity_document", "other_restricted",
];
export function visibilityForCategory(category: DocumentCategory): DocumentVisibility {
  return RESTRICTED_CATEGORIES.includes(category) ? "restricted" : "public";
}

// Step 1 of the upload flow — creates the metadata row (and, for
// restricted docs, records the required attestations) and returns where
// the actual file bytes should go. See create_model_document (0030).
export async function createModelDocument(input: {
  modelId: string;
  relationshipId?: string;
  category: DocumentCategory;
  fileName: string;
  mimeType?: string;
  attestations?: { authority: boolean; uploadRights: boolean; accurate: boolean; willUpdate: boolean };
}): Promise<{ documentId: string | null; storageBucket: string | null; storagePath: string | null; error: string | null }> {
  const visibility = visibilityForCategory(input.category);
  const { data, error } = await supabase.rpc("create_model_document", {
    p_model_id: input.modelId,
    p_relationship_id: input.relationshipId || null,
    p_visibility: visibility,
    p_category: input.category,
    p_file_name: input.fileName,
    p_mime_type: input.mimeType || null,
    p_attested_authority: input.attestations?.authority ?? null,
    p_attested_upload_rights: input.attestations?.uploadRights ?? null,
    p_attested_accurate: input.attestations?.accurate ?? null,
    p_attested_will_update: input.attestations?.willUpdate ?? null,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return { documentId: null, storageBucket: null, storagePath: null, error: error?.message ?? "Couldn't record this document." };
  return { documentId: row.document_id as string, storageBucket: row.storage_bucket as string, storagePath: row.storage_path as string, error: null };
}

// Step 2 — the actual file bytes, into the bucket/path create_model_document
// just reserved. storage.objects RLS checks the metadata row already
// exists with a matching uploading_agency_org_id before allowing this.
export async function uploadModelDocumentFile(bucket: string, path: string, file: File): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined });
  return { error: error?.message ?? null };
}

// Display-time signed URL — expiring per spec §9, gated by the same
// my_document_access() tier the select policy uses.
export async function getModelDocumentSignedUrl(bucket: string, path: string, expiresInSeconds = 300): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  return { url: data?.signedUrl ?? null, error: error?.message ?? null };
}
