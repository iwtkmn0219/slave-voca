"use server";

import { revalidatePath } from "next/cache";
import type { Intervals } from "@/lib/srs/interval";
import { ANSWERS, type Answer } from "@/lib/srs/scheduler";
import { isId } from "@/lib/validate";
import { getDb } from "@/server/db/client";
import { getOccurrenceMeaning } from "@/server/repo/cards";
import { recordAnswer, StudyError } from "@/server/repo/study";
import { MISSING_KEY_MESSAGE } from "@/lib/regen-messages";
import { defaultMeaningModel, regenerateMeanings } from "@/server/services/enrich";

export type AnswerResult =
  | { error: string }
  | { error: null; due: number; intervals: Intervals }; // due는 ms(epoch)

// 복습 응답 하나를 저장한다. 성공하면 다음 복습 시각과 응답 뒤 상태의 간격 미리보기를 돌려준다.
export async function answerCard(wordId: number, answer: Answer): Promise<AnswerResult> {
  if (!Number.isInteger(wordId) || !ANSWERS.includes(answer)) {
    return { error: "잘못된 요청입니다." };
  }
  try {
    const { due, intervals } = recordAnswer(getDb(), wordId, answer, new Date());
    // 상단 메뉴의 "오늘 남은 수" 배지(레이아웃)가 바로 줄도록 다시 그린다.
    // 복습 화면의 큐 상태는 클라이언트 state라 그대로 유지된다.
    revalidatePath("/", "layout");
    return { error: null, due: due.getTime(), intervals };
  } catch (err) {
    if (err instanceof StudyError) return { error: err.message };
    throw err;
  }
}

export type RegenerateUsageResult =
  | { error: string }
  | { error: null; meaningKo: string | null; meaningStatus: "pending" | "done" | "failed"; failed: boolean };

// 카드 뒷면의 "다시 만들기": 용례 하나의 뜻을 새로 받는다. 실패하면 원래 뜻이 그대로 남고 failed가 true다.
export async function regenerateUsageMeaning(occurrenceId: unknown): Promise<RegenerateUsageResult> {
  if (!isId(occurrenceId)) return { error: "잘못된 요청입니다." };
  const db = getDb();
  if (!getOccurrenceMeaning(db, occurrenceId)) return { error: "용례를 찾을 수 없습니다." };
  const result = await regenerateMeanings(db, [occurrenceId], defaultMeaningModel());
  if (result.error === "missing-key") return { error: MISSING_KEY_MESSAGE };
  const meaning = getOccurrenceMeaning(db, occurrenceId);
  if (!meaning) return { error: "용례를 찾을 수 없습니다." }; // 그 사이 카드가 지워졌다
  revalidatePath("/documents", "layout"); // 문서 단어 목록에도 새 뜻이 보이게 한다
  return { error: null, ...meaning, failed: result.failed > 0 };
}
