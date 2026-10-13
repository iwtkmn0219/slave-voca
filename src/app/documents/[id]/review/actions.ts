"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { ReviewError, saveReviewSelection, type SavedCards } from "@/server/repo/cards";
import { defaultEnrichDeps, enrichDocument } from "@/server/services/enrich";

// 검토 결과를 저장하고, 뜻과 발음을 채운 뒤 문서 단어 목록으로 이동한다.
export async function saveReview(
  documentId: number,
  selectedCandidateIds: number[],
): Promise<{ error: string }> {
  const db = getDb();
  let saved: SavedCards;
  try {
    saved = saveReviewSelection(db, documentId, selectedCandidateIds);
  } catch (err) {
    if (err instanceof ReviewError) return { error: err.message };
    throw err;
  }

  await enrichDocument(db, documentId, saved, defaultEnrichDeps());
  revalidatePath("/documents");
  redirect(`/documents/${documentId}`);
}
