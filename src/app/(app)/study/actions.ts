"use server";

import { revalidatePath } from "next/cache";
import type { Intervals } from "@/lib/srs/interval";
import { ANSWERS, type Answer } from "@/lib/srs/scheduler";
import { isId } from "@/lib/validate";
import { getDb } from "@/server/db/client";
import { StudyError, undoAnswer } from "@/server/repo/study";
import { recordAnswerOnce } from "@/server/services/answer-once";
import { requireUser } from "@/server/auth/current-user";

export type AnswerResult =
  | { error: string }
  | { error: null; due: number; intervals: Intervals; logId: number }; // due는 ms(epoch)

// 복습 응답 하나를 저장한다. 성공하면 다음 복습 시각, 응답 뒤 상태의 간격 미리보기,
// 되돌리기에 쓸 기록 id를 돌려준다.
// attemptId: 화면이 카드를 보여 줄 때 만든 시도 id. 응답이 유실되어 다시 보낼 때 같은 값을 쓰면 한 번만 적용된다.
export async function answerCard(wordId: number, answer: Answer, attemptId?: unknown): Promise<AnswerResult> {
  const user = await requireUser();
  if (!Number.isInteger(wordId) || !ANSWERS.includes(answer)) {
    return { error: "잘못된 요청입니다." };
  }
  try {
    const { due, intervals, logId } = recordAnswerOnce(
      getDb(),
      user.id,
      wordId,
      answer,
      typeof attemptId === "string" && /^[\w-]{8,64}$/.test(attemptId) ? attemptId : null,
      new Date(),
    );
    // 상단 메뉴의 "오늘 남은 수" 배지(레이아웃)가 바로 줄도록 다시 그린다.
    // 복습 화면의 큐 상태는 클라이언트 state라 그대로 유지된다.
    revalidatePath("/", "layout");
    return { error: null, due: due.getTime(), intervals, logId };
  } catch (err) {
    if (err instanceof StudyError) return { error: err.message };
    throw err;
  }
}

// 직전 응답 되돌리기. rejected는 다시 시도해도 결과가 같은 거부다(다른 곳에서 이미 답했거나 기록이 없음).
export type UndoResult = { error: null } | { error: string; rejected: boolean };

export async function undoLastAnswer(logId: unknown): Promise<UndoResult> {
  const user = await requireUser();
  if (!isId(logId)) return { error: "잘못된 요청입니다.", rejected: true };
  try {
    undoAnswer(getDb(), user.id, logId);
    revalidatePath("/", "layout");
    return { error: null };
  } catch (err) {
    if (err instanceof StudyError) return { error: err.message, rejected: true };
    throw err;
  }
}
