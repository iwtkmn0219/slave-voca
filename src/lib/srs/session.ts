import type { Answer } from './scheduler';

// 복습 화면의 남은 카드 목록에서 맨 앞 카드를 처리한다. "모름"이면 이번 세션 끝에 한 번 더 보여준다(스펙 8.6).
export function advanceQueue<T>(queue: readonly T[], answer: Answer): T[] {
  if (queue.length === 0) return [];
  const [head, ...rest] = queue;
  return answer === 'again' ? [...rest, head] : rest;
}

export interface RegeneratedMeaning {
  meaningKo: string | null;
  meaningStatus: 'pending' | 'done' | 'failed';
}

// 이번 세션에서 다시 만든 뜻(용례 id별)을 카드의 용례에 입힌다. 직전 응답 되돌리기가 응답 전 카드를 복원할 때,
// 그 사이 다시 만든 뜻을 옛 뜻으로 되돌리지 않으려는 것이다. 바뀐 용례가 없으면 같은 카드를 돌려준다.
export function withMeanings<C extends { usages: { occurrenceId: number }[] }>(
  card: C,
  meanings: ReadonlyMap<number, RegeneratedMeaning>,
): C {
  if (!card.usages.some((u) => meanings.has(u.occurrenceId))) return card;
  return { ...card, usages: card.usages.map((u) => ({ ...u, ...meanings.get(u.occurrenceId) })) };
}
