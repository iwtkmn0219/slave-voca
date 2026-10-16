"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { ingestPdf, UploadError, type IngestResult } from "@/server/services/ingest";
import { requireUser } from "@/server/auth/current-user";

export interface UploadState {
  error: string | null;
}

export async function uploadDocument(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "PDF 파일을 선택하세요." };
  }
  const kind = formData.get("kind") === "presentation" ? "presentation" : "paper";
  const title = String(formData.get("title") ?? "");

  let result: IngestResult;
  try {
    result = await ingestPdf(getDb(), user.id, {
      fileName: file.name,
      title,
      kind,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  } catch (err) {
    if (err instanceof UploadError) return { error: err.message };
    throw err;
  }

  revalidatePath("/documents");
  if (result.status === "reviewing") redirect(`/documents/${result.documentId}/review`);
  return { error: null };
}
