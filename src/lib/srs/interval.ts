import { ANSWERS, applyAnswer, type Answer, type SrsState } from './scheduler';

export type Intervals = Record<Answer, number>; // 응답별로 다음 복습까지 남는 시간(ms)

// 답 버튼에 보여 줄 "다음 복습까지" 미리보기. 실제 응답과 같은 계산(applyAnswer)을 쓴다.
export function previewIntervals(state: SrsState, now: Date): Intervals {
  const result = {} as Intervals;
  for (const answer of ANSWERS) {
    result[answer] = Math.max(0, applyAnswer(state, answer, now).due.getTime() - now.getTime());
  }
  return result;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// 1분 미만은 "1분", 이후 분·시간·일·개월·년 중 가장 큰 단위 하나로 반올림한다.
export function formatInterval(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))}분`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}시간`;
  if (ms < 30 * DAY) return `${Math.round(ms / DAY)}일`;
  if (ms < 365 * DAY) return `${Math.round(ms / (30 * DAY))}개월`;
  return `${Math.round(ms / (365 * DAY))}년`;
}
