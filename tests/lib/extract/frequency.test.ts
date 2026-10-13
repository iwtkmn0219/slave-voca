import { describe, expect, it } from 'vitest';
import { isFrequentWord, rankOf } from '@/lib/extract/frequency';

describe('rankOf', () => {
  it('returns the rank of listed words', () => {
    expect(rankOf('the')).toBe(1);
    expect(isFrequentWord('the')).toBe(true);
  });

  it('ignores object prototype keys', () => {
    expect(rankOf('constructor')).toBeUndefined();
    expect(rankOf('__proto__')).toBeUndefined();
    expect(isFrequentWord('hasOwnProperty')).toBe(false);
  });
});
