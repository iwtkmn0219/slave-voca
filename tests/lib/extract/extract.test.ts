import { describe, expect, it } from 'vitest';
import { extractCandidates, truncateAround, type ExtractOptions } from '@/lib/extract/extract';

function options(overrides: Partial<ExtractOptions> = {}): ExtractOptions {
  const ranks: Record<string, number> = { the: 1, we: 2, and: 3, model: 300, data: 131, datum: 131 };
  return {
    excludeTopN: 5000,
    rankOf: (w) => ranks[w],
    knownLemmas: new Set(),
    existingLemmas: new Set(),
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

  it('drops every word ranked within N and keeps the ones ranked after it', () => {
    // 학술어 예외는 없다(M5). 기준 N이 곧 경계다.
    const rankOf = (w: string) => ({ the: 1, hence: 3687, area: 400 })[w];
    expect(lemmas(['Hence the area grows.'], options({ rankOf, excludeTopN: 3000 }))).toEqual(['grow', 'hence']);
    expect(lemmas(['Hence the area grows.'], options({ rankOf, excludeTopN: 5000 }))).toEqual(['grow']);
  });

  it('drops known lemmas even when they rank after N', () => {
    const opts = options({
      rankOf: (w) => ({ hence: 3687 })[w],
      excludeTopN: 3000,
      knownLemmas: new Set(['hence']),
    });
    expect(lemmas(['Hence it grows.'], opts)).not.toContain('hence');
  });

  it('merges plurals the lemmatizer missed into the singular candidate', () => {
    const result = extractCandidates(
      ['One dataset was used.', 'Two datasets were used.', 'More datasets.'],
      options({ inDictionary: (l) => l !== 'datasets' && l !== 'dataset' }),
    );
    const dataset = result.find((c) => c.lemma === 'dataset');
    expect(dataset).toMatchObject({ count: 3, sentence: 'One dataset was used.' });
    expect(result.find((c) => c.lemma === 'datasets')).toBeUndefined();
  });

  it('drops a missed plural when its singular is a known word', () => {
    const opts = options({ inDictionary: (l) => l !== 'logits', knownLemmas: new Set(['logit']) });
    expect(lemmas(['The logits are scaled.'], opts)).not.toContain('logits');
    expect(lemmas(['The logits are scaled.'], opts)).not.toContain('logit');
  });

  it('keeps dictionary words ending in s even when the s-less form is a candidate', () => {
    // M2 리뷰: len(코드)이 후보일 때 lens가 len으로 합쳐지던 문제
    const result = lemmas(['The lens and len differ, with bias.'], options({ inDictionary: (l) => l !== 'len' }));
    expect(result).toEqual(expect.arrayContaining(['lens', 'len', 'bias']));
  });

  it('keeps a frequency-list word whose s-less form is not a word', () => {
    // whereas는 WordNet에 없지만 빈도표에 있고 wherea는 없다. 순위도 whereas로 찾아야 한다.
    const opts = options({
      rankOf: (w) => ({ whereas: 3524 })[w],
      excludeTopN: 3000,
      inDictionary: () => false,
    });
    expect(lemmas(['The first grows, whereas the second shrinks.'], opts)).toContain('whereas');
  });

  it('turns missed -ies and -xes plurals into the right singular, not a stem without its ending', () => {
    // Codex 리뷰: nonlinearities → nonlinearitie, softmaxes → softmaxe 같은 잘못된 원형을 만들었다.
    const opts = options({ inDictionary: () => false });
    expect(lemmas(['The nonlinearities and softmaxes.'], opts)).toEqual(['nonlinearity', 'softmax']);
  });

  it('prefers the singular form the dictionary knows', () => {
    const opts = options({ inDictionary: (l) => l === 'database' || l === 'cache' });
    expect(lemmas(['The databases and caches.'], opts)).toEqual(['cache', 'database']);
  });

  it('does not strip the s of words ending in ss, us or is', () => {
    const opts = options({ inDictionary: () => false });
    expect(lemmas(['Glass, softplus and axis.'], opts)).toEqual(['axis', 'glass', 'softplus']);
  });

  it('folds diacritics into the lemma and keeps the written surface', () => {
    const result = extractCandidates(['A naïve café baseline.'], options());
    expect(result.find((c) => c.lemma === 'naive')).toMatchObject({ surface: 'naïve' });
    expect(result.find((c) => c.lemma === 'cafe')).toMatchObject({ surface: 'café' });
  });

  it('reads decomposed letters as one word', () => {
    const decomposed = 'A nai\u0308ve baseline.';
    expect(lemmas([decomposed])).toContain('naive');
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
