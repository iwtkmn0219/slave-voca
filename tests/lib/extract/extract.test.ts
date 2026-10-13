import { describe, expect, it } from 'vitest';
import { extractCandidates, type ExtractOptions } from '@/lib/extract/extract';

function options(overrides: Partial<ExtractOptions> = {}): ExtractOptions {
  const ranks: Record<string, number> = { the: 1, we: 2, model: 300, data: 131, datum: 131 };
  return {
    excludeTopN: 5000,
    rankOf: (w) => ranks[w],
    knownLemmas: new Set(),
    existingLemmas: new Set(),
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
});
