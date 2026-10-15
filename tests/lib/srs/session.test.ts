import { describe, expect, it } from 'vitest';
import { advanceQueue, withMeanings } from '@/lib/srs/session';

describe('advanceQueue', () => {
  it('drops the current card on hard or good', () => {
    expect(advanceQueue(['a', 'b', 'c'], 'good')).toEqual(['b', 'c']);
    expect(advanceQueue(['a', 'b'], 'hard')).toEqual(['b']);
  });

  it('moves the current card to the end on again', () => {
    expect(advanceQueue(['a', 'b', 'c'], 'again')).toEqual(['b', 'c', 'a']);
    expect(advanceQueue(['a'], 'again')).toEqual(['a']);
  });

  it('handles an empty queue', () => {
    expect(advanceQueue([], 'good')).toEqual([]);
  });
});

describe('withMeanings', () => {
  const card = {
    lemma: 'layer',
    usages: [
      { occurrenceId: 1, meaningKo: '옛 뜻', meaningStatus: 'done' as const },
      { occurrenceId: 2, meaningKo: null, meaningStatus: 'failed' as const },
    ],
  };

  it('puts the regenerated meanings onto the matching usages only', () => {
    const next = withMeanings(card, new Map([[2, { meaningKo: '새 뜻', meaningStatus: 'done' as const }]]));
    expect(next.usages).toEqual([
      { occurrenceId: 1, meaningKo: '옛 뜻', meaningStatus: 'done' },
      { occurrenceId: 2, meaningKo: '새 뜻', meaningStatus: 'done' },
    ]);
    expect(next.lemma).toBe('layer');
  });

  it('returns the same card when nothing was regenerated', () => {
    expect(withMeanings(card, new Map())).toBe(card);
  });
});
