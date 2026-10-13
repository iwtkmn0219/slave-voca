import { describe, expect, it } from 'vitest';
import { advanceQueue } from '@/lib/srs/session';

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
