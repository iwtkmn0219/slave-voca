import { describe, expect, it } from 'vitest';
import { isId, parseIdList } from '@/lib/validate';

describe('isId and parseIdList', () => {
  it('accepts positive integer ids and removes duplicates', () => {
    expect(isId(3)).toBe(true);
    expect(parseIdList([3, 1, 3])).toEqual([3, 1]);
    expect(parseIdList([])).toEqual([]);
  });

  it('rejects anything else', () => {
    expect(isId(0)).toBe(false);
    expect(isId(1.5)).toBe(false);
    expect(isId('3')).toBe(false);
    expect(parseIdList('1,2')).toBeNull();
    expect(parseIdList([1, '2'])).toBeNull();
    expect(parseIdList([1, -2])).toBeNull();
    expect(parseIdList(null)).toBeNull();
  });
});
