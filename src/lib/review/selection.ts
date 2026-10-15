// 검토 화면의 선택·필터 규칙. 화면 상태와 떨어진 순수 함수라 테스트할 수 있다.
export type ReviewFilter = 'all' | 'learning' | 'nodict' | 'off';

export interface SelectableCandidate {
  id: number;
  isExisting: boolean;
  inDictionary: boolean;
}

export function matchesFilter(
  c: SelectableCandidate,
  filter: ReviewFilter,
  selected: ReadonlySet<number>,
): boolean {
  if (filter === 'learning') return c.isExisting;
  if (filter === 'nodict') return !c.inDictionary;
  if (filter === 'off') return !selected.has(c.id);
  return true;
}

export function filterCounts(
  list: readonly SelectableCandidate[],
  selected: ReadonlySet<number>,
): Record<ReviewFilter, number> {
  return {
    all: list.length,
    learning: list.filter((c) => c.isExisting).length,
    nodict: list.filter((c) => !c.inDictionary).length,
    off: list.filter((c) => !selected.has(c.id)).length,
  };
}

// Shift+클릭: 화면에 보이는 순서(visibleIds)에서 anchor부터 target까지를 target의 새 상태로 맞춘다.
export function selectRange(
  selected: ReadonlySet<number>,
  visibleIds: readonly number[],
  anchorId: number,
  targetId: number,
): Set<number> {
  const next = new Set(selected);
  const value = !selected.has(targetId);
  const a = visibleIds.indexOf(anchorId);
  const b = visibleIds.indexOf(targetId);
  const ids = a === -1 || b === -1 ? [targetId] : visibleIds.slice(Math.min(a, b), Math.max(a, b) + 1);
  for (const id of ids) {
    if (value) next.add(id);
    else next.delete(id);
  }
  return next;
}

export function toggleOne(selected: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
