import type { Answer } from './scheduler';

// 복습 화면의 남은 카드 목록에서 맨 앞 카드를 처리한다. "모름"이면 이번 세션 끝에 한 번 더 보여준다(스펙 8.6).
export function advanceQueue<T>(queue: readonly T[], answer: Answer): T[] {
  if (queue.length === 0) return [];
  const [head, ...rest] = queue;
  return answer === 'again' ? [...rest, head] : rest;
}
