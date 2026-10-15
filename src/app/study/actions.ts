"use server";

import type { Intervals } from "@/lib/srs/interval";
import { ANSWERS, type Answer } from "@/lib/srs/scheduler";
import { getDb } from "@/server/db/client";
import { recordAnswer, StudyError } from "@/server/repo/study";

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
    return { error: null, due: due.getTime(), intervals };
  } catch (err) {
    if (err instanceof StudyError) return { error: err.message };
    throw err;
  }
}
