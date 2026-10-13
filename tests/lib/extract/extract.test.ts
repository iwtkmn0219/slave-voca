import { describe, expect, it } from 'vitest';
import { extractCandidates, truncateAround, type ExtractOptions } from '@/lib/extract/extract';

function options(overrides: Partial<ExtractOptions> = {}): ExtractOptions {
  const ranks: Record<string, number> = { the: 1, we: 2, and: 3, model: 300, data: 131, datum: 131 };
  return {
    excludeTopN: 5000,
    rankOf: (w) => ranks[w],
    knownLemmas: new Set(),
    existingLemmas: new Set(),
    isAcademic: () => false,
    inDictionary: () => true,
    ...overrides,
  };
}

const lemmas = (sentences: string[], opts = options()) =>
  extractCandidates(sentences, opts).map((c) => c.lemma);

describe('extractCandidates', () => {
  it('drops words ranked within the top N and keeps rarer or unranked words', () => {
    const opts = options({ rankOf: (w) => ({ the: 1, robust: 7893 })[w] });
    expect(lemmas(['The robust heteroscedastic estimator.'], opts)).toEqual([
      'estimator',
      'heteroscedastic',
      'robust',
    ]);
    expect(lemmas(['The robust estimator.'], { ...opts, excludeTopN: 10000 })).toEqual([
      'estimator',
    ]);
  });

  it('skips short tokens, acronyms and hyphenated compounds', () => {
    expect(lemmas(['An CNN uses state-of-the-art ideas.'])).toEqual(['idea', 'use']);
  });

  it('merges inflected forms and counts every occurrence', () => {
    const result = extractCandidates(
      ['Prior studies exist.', 'We studied it again.'],
      options(),
    );
    const study = result.find((c) => c.lemma === 'study');
    expect(study).toMatchObject({ surface: 'studies', sentence: 'Prior studies exist.', count: 2 });
  });

  it('drops a common surface form even when its lemma looks rare', () => {
    expect(lemmas(['The data looked clean.'])).not.toContain('datum');
  });

  it('drops known lemmas', () => {
    expect(lemmas(['A robust result.'], options({ knownLemmas: new Set(['robust']) }))).toEqual([
      'result',
    ]);
  });

  it('drops words only ever capitalized mid-sentence as proper nouns', () => {
    const result = lemmas(['We thank Vaswani for comments.', 'Vaswani agreed.']);
    expect(result).not.toContain('vaswani');
  });

  it('keeps a rare word that is capitalized only at the start of a sentence', () => {
    expect(lemmas(['Notwithstanding this, it held.'])).toContain('notwithstanding');
  });

  it('marks lemmas that are already cards', () => {
    const result = extractCandidates(
      ['A robust result.'],
      options({ existingLemmas: new Set(['robust']) }),
    );
    expect(result.find((c) => c.lemma === 'robust')?.isExisting).toBe(true);
    expect(result.find((c) => c.lemma === 'result')?.isExisting).toBe(false);
  });

  it('truncates long sentences to 300 characters', () => {
    const long = `Robust ${'word '.repeat(100)}end.`;
    const [first] = extractCandidates([long], options());
    expect(first.sentence).toHaveLength(300);
    expect(first.sentence.endsWith('…')).toBe(true);
  });

  it('sorts by count, then alphabetically', () => {
    expect(lemmas(['Zeta alpha zeta beta.'])).toEqual(['zeta', 'alpha', 'beta']);
  });

  it('drops whole tokens with non-ASCII letters instead of leaving fragments', () => {
    expect(lemmas(['Thanks to Łukasz and Gödel, results.'])).toEqual(['result', 'thank']);
  });

  it('keeps academic words ranked between 2,001 and N', () => {
    const ranks: Record<string, number> = { hence: 3500, area: 400 };
    const opts = options({
      rankOf: (w) => ranks[w],
      isAcademic: (l) => l === 'hence' || l === 'area',
    });
    const result = lemmas(['Hence the area grows.'], opts);
    expect(result).toContain('hence');
    expect(result).not.toContain('area'); // 상위 2,000 안의 학술어는 쉬우므로 그대로 거른다
  });

  it('still drops known lemmas even when they are academic', () => {
    const opts = options({
      rankOf: (w) => ({ hence: 3500 })[w],
      isAcademic: () => true,
      knownLemmas: new Set(['hence']),
    });
    expect(lemmas(['Hence it grows.'], opts)).not.toContain('hence');
  });

  it('merges plurals the lemmatizer missed into the singular candidate', () => {
    const result = extractCandidates(
      ['One dataset was used.', 'Two datasets were used.', 'More datasets.'],
      options(),
    );
    const dataset = result.find((c) => c.lemma === 'dataset');
    expect(dataset).toMatchObject({ count: 3, sentence: 'One dataset was used.' });
    expect(result.find((c) => c.lemma === 'datasets')).toBeUndefined();
  });

  it('does not strip the s of words ending in ss', () => {
    expect(lemmas(['Glass and glas.'])).toEqual(['glas', 'glass']);
  });

  it('flags lemmas missing from the dictionary', () => {
    const result = extractCandidates(
      ['The conv layer is residual.'],
      options({ inDictionary: (l) => l !== 'conv' }),
    );
    expect(result.find((c) => c.lemma === 'conv')?.inDictionary).toBe(false);
    expect(result.find((c) => c.lemma === 'residual')?.inDictionary).toBe(true);
  });

  it('keeps the word visible when a long sentence is cut', () => {
    const long = `${'word '.repeat(100)}heteroscedastic end.`;
    const found = extractCandidates([long], options()).find((c) => c.lemma === 'heteroscedastic');
    expect(found?.sentence).toHaveLength(300);
    expect(found?.sentence.startsWith('…')).toBe(true);
    expect(found?.sentence).toContain('heteroscedastic');
  });
});

describe('truncateAround', () => {
  it('returns short sentences unchanged', () => {
    expect(truncateAround('A short one.', 2, 5)).toBe('A short one.');
  });

  it('centers the window on the word with ellipses on cut sides', () => {
    const sentence = `${'a'.repeat(400)}TARGET${'b'.repeat(400)}`;
    const cut = truncateAround(sentence, 400, 6);
    expect(cut).toHaveLength(300);
    expect(cut.startsWith('…')).toBe(true);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut).toContain('TARGET');
  });
});
