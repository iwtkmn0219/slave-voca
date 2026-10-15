import { describe, expect, it } from 'vitest';
import {
  filterCounts,
  matchesFilter,
  selectRange,
  toggleOne,
  type SelectableCandidate,
} from '@/lib/review/selection';

const list: SelectableCandidate[] = [
  { id: 1, isExisting: false, inDictionary: true },
  { id: 2, isExisting: true, inDictionary: true },
  { id: 3, isExisting: false, inDictionary: false },
  { id: 4, isExisting: false, inDictionary: true },
];

describe('matchesFilter and filterCounts', () => {
  it('filters by learning, not-in-dictionary and unselected', () => {
    const selected = new Set([1, 2, 4]);
    const ids = (f: Parameters<typeof matchesFilter>[1]) =>
      list.filter((c) => matchesFilter(c, f, selected)).map((c) => c.id);
    expect(ids('all')).toEqual([1, 2, 3, 4]);
    expect(ids('learning')).toEqual([2]);
    expect(ids('nodict')).toEqual([3]);
    expect(ids('off')).toEqual([3]);
    expect(filterCounts(list, selected)).toEqual({ all: 4, learning: 1, nodict: 1, off: 1 });
  });
});

describe('selectRange', () => {
  it('sets every row between anchor and target to the target new state', () => {
    const selected = new Set([1, 2, 4]);
    expect([...selectRange(selected, [1, 2, 3, 4], 1, 3)].sort()).toEqual([1, 2, 3, 4]);
    // 2는 이미 선택돼 있으므로 2~4 전체를 해제한다
    expect([...selectRange(selected, [1, 2, 3, 4], 4, 2)].sort()).toEqual([1]);
  });

  it('only uses rows that are visible, in visible order', () => {
    const selected = new Set<number>();
    expect([...selectRange(selected, [4, 2], 4, 2)].sort()).toEqual([2, 4]);
  });

  it('falls back to toggling the target when the anchor is not visible', () => {
    expect([...selectRange(new Set([1]), [2, 3], 1, 3)].sort()).toEqual([1, 3]);
  });
});

describe('toggleOne', () => {
  it('flips one id without mutating the input', () => {
    const selected = new Set([1]);
    expect([...toggleOne(selected, 1)]).toEqual([]);
    expect([...toggleOne(selected, 2)].sort()).toEqual([1, 2]);
    expect([...selected]).toEqual([1]);
  });
});
