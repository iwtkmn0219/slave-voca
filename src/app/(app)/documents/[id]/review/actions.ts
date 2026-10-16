"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isId, parseIdList } from "@/lib/validate";
import { getDb } from "@/server/db/client";
import { ReviewError, saveReviewSelection, type SavedCards } from "@/server/repo/cards";
import { defaultEnrichDeps, enrichDocument } from "@/server/services/enrich";
import { requireUser } from "@/server/auth/current-user";

// 검토 결과를 저장하고, 뜻과 발음을 채운 뒤 문서 단어 목록으로 이동한다.
// 인자는 브라우저에서 오므로 형태부터 확인한다. 잘못된 목록이 "아무것도 선택 안 함"으로 읽혀
// 후보 전체가 아는 단어로 들어가는 일을 막는다.
export async function saveReview(
  documentId: unknown,
  selectedCandidateIds: unknown,
): Promise<{ error: string }> {
  const user = await requireUser();
  const ids = parseIdList(selectedCandidateIds);
  if (!isId(documentId) || ids === null) return { error: "잘못된 요청입니다." };
  const db = getDb();
  let saved: SavedCards;
  try {
    saved = saveReviewSelection(db, user.id, documentId, ids);
  } catch (err) {
    if (err instanceof ReviewError) return { error: err.message };
    throw err;
  }

  await enrichDocument(db, user.id, documentId, saved, defaultEnrichDeps());
  revalidatePath("/documents");
  redirect(`/documents/${documentId}`);
}
