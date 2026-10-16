"use server";

import { revalidatePath } from "next/cache";
import { isId, parseIdList } from "@/lib/validate";
import { getDb } from "@/server/db/client";
import { deleteCard, listFailedMeaningIds, occurrencesBelongTo } from "@/server/repo/cards";
import { LIMIT_SLOT, MISSING_KEY_MESSAGE } from "@/lib/regen-messages";
import { defaultMeaningModel, regenerateMeanings } from "@/server/services/enrich";
import { requireUser } from "@/server/auth/current-user";

const BAD_REQUEST = "잘못된 요청입니다.";

// 단어 목록과, 수가 바뀌는 홈·문서 목록을 다시 그린다.
function refresh(documentId: number) {
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/documents");
  revalidatePath("/");
}

// limitResetsOn이 있으면 한도에 걸린 것이다.
export type RegenerateActionResult =
  | { error: string; limitResetsOn?: string }
  | { error: null; done: number; failed: number };

// 뜻 다시 만들기. occurrenceIds가 비어 있으면 이 문서의 실패한 뜻 전체("모두 다시 시도"),
// 있으면 그 용례들(이미 뜻이 있어도 새로 받는다. 실패하면 원래 뜻을 둔다).
export async function regenerateDocumentMeanings(
  documentId: unknown,
  occurrenceIds: unknown,
): Promise<RegenerateActionResult> {
  const user = await requireUser();
  const ids = parseIdList(occurrenceIds);
  if (!isId(documentId) || ids === null) return { error: BAD_REQUEST };
  const db = getDb();
  if (!occurrencesBelongTo(db, user.id, documentId, ids)) return { error: BAD_REQUEST };
  const targets = ids.length > 0 ? ids : listFailedMeaningIds(db, user.id, documentId);
  const result = await regenerateMeanings(db, user.id, targets, defaultMeaningModel());
  if (result.error === "missing-key") return { error: MISSING_KEY_MESSAGE };
  if (result.error === "usage-limit") return { error: LIMIT_SLOT, limitResetsOn: result.resetsOn };
  refresh(documentId);
  return result;
}

// 카드 삭제: 모든 문서의 용례와 복습 기록이 함께 지워진다.
export async function removeCard(documentId: unknown, wordId: unknown): Promise<{ error: string | null }> {
  const user = await requireUser();
  if (!isId(documentId) || !isId(wordId)) return { error: BAD_REQUEST };
  if (!deleteCard(getDb(), user.id, wordId)) return { error: "카드를 찾을 수 없습니다." };
  refresh(documentId);
  revalidatePath("/study");
  return { error: null };
}
