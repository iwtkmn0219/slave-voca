import { describe, expect, it } from 'vitest';
import { lemmatize } from '@/lib/extract/lemma';
import { buildFrequencyMap } from '@/lib/extract/build-frequency-map';

describe('lemmatize', () => {
  it('merges inflected forms into one lemma', () => {
    expect(lemmatize('studies')).toBe('study');
    expect(lemmatize('studied')).toBe('study');
    expect(lemmatize('Analyses')).toBe('analysis');
    expect(lemmatize('leveraging')).toBe('leverage');
  });

  it('returns the lowercase word when no form applies', () => {
    expect(lemmatize('robust')).toBe('robust');
  });
});

describe('buildFrequencyMap', () => {
  it('ranks by line order and keeps the best rank for a lemma', () => {
    const map = buildFrequencyMap(['the', 'studies', 'study', 'x-ray', '']);
    expect(map.the).toBe(1);
    expect(map.studies).toBe(2);
    expect(map.study).toBe(2);
  });

  it('skips entries that are not plain letters', () => {
    const map = buildFrequencyMap(['x-ray', 'abc1']);
    expect(Object.keys(map)).toEqual([]);
  });
});
