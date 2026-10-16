import { describe, expect, it } from 'vitest';
import { inDictionary } from '@/lib/extract/dictionary';

describe('inDictionary', () => {
  it('accepts English words and rejects abbreviations and symbols', () => {
    expect(inDictionary('residual')).toBe(true);
    expect(inDictionary('heterogeneous')).toBe(true);
    expect(inDictionary('conv')).toBe(false);
    expect(inDictionary('dmodel')).toBe(false);
  });

  it('ignores object prototype keys', () => {
    expect(inDictionary('hasOwnProperty')).toBe(false);
    expect(inDictionary('__proto__')).toBe(false);
    expect(inDictionary('constructor')).toBe(true); // WordNet에 실제로 있는 단어
  });
});
