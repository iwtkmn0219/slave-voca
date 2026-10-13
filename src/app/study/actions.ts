"use server";

import { ANSWERS, type Answer } from "@/lib/srs/scheduler";
import { getDb } from "@/server/db/client";
import { recordAnswer, StudyError } from "@/server/repo/study";

// 복습 응답 하나를 저장한다. 실패하면 화면에 보여줄 메시지를 돌려준다.
export async function answerCard(wordId: number, answer: Answer): Promise<{ error: string | null }> {
  if (!Number.isInteger(wordId) || !ANSWERS.includes(answer)) {
    return { error: "잘못된 요청입니다." };
  }
  try {
    recordAnswer(getDb(), wordId, answer, new Date());
    return { error: null };
  } catch (err) {
    if (err instanceof StudyError) return { error: err.message };
    throw err;
  }
}
