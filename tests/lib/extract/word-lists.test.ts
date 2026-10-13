import { describe, expect, it } from 'vitest';
import { isAcademic } from '@/lib/extract/academic';
import { inDictionary } from '@/lib/extract/dictionary';

describe('isAcademic', () => {
  it('recognizes AWL headwords by lemma', () => {
    expect(isAcademic('hence')).toBe(true);
    expect(isAcademic('derive')).toBe(true);
    expect(isAcademic('analysis')).toBe(false); // 대표어는 analyse
    expect(isAcademic('banana')).toBe(false);
  });

  it('also accepts American spellings of -ise and -yse headwords', () => {
    expect(isAcademic('analyze')).toBe(true);
    expect(isAcademic('maximize')).toBe(true);
  });
});

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
