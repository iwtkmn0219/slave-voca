import type { Answer } from '@/lib/srs/scheduler';
import type { Db } from '../db/client';
import { recordAnswer, undoAnswer } from '../repo/study';

// 복습 응답의 중복 방지. 휴대폰에서 서버는 응답을 저장했는데 결과만 유실되면 화면은 "다시 눌러 주세요"를 보이고,
// 다시 누르면 같은 응답이 한 번 더 적용된다(일정과 기록이 두 번 바뀐다). 화면이 카드를 보여 줄 때 만든 시도 id를
// 재시도에도 그대로 보내면, 같은 id의 재시도는 처음 결과를 돌려준다. 응답을 바꿔 다시 누르면 앞의 응답을 되돌리고 새로 적용한다.
// 메모리에만 두므로 서버가 다시 시작하면 잊는다(짧은 재시도 사이에만 필요하다).
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 1000;

type Result = ReturnType<typeof recordAnswer>;
const attempts = new Map<string, { wordId: number; answer: Answer; result: Result; at: number }>();

function prune(nowMs: number) {
  for (const [key, entry] of attempts) {
    if (nowMs - entry.at > TTL_MS || attempts.size > MAX_ENTRIES) attempts.delete(key);
  }
}

export function recordAnswerOnce(
  db: Db,
  userId: string,
  wordId: number,
  answer: Answer,
  attemptId: string | null,
  now: Date,
): Result {
  if (!attemptId) return recordAnswer(db, userId, wordId, answer, now);
  prune(now.getTime());
  const key = `${userId}:${attemptId}`;
  const previous = attempts.get(key);
  if (previous && previous.wordId === wordId) {
    if (previous.answer === answer) return previous.result;
    undoAnswer(db, userId, previous.result.logId); // 그 뒤에 또 답했으면 StudyError로 거부된다
  }
  const result = recordAnswer(db, userId, wordId, answer, now);
  attempts.set(key, { wordId, answer, result, at: now.getTime() });
  return result;
}

export function resetAnswerAttemptsForTest(): void {
  attempts.clear();
}
