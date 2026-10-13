import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { knownWords, occurrences, words } from '@/server/db/schema';
import {
  countOccurrencesByDocument,
  listMeaningRequests,
  listOccurrencesByDocument,
  listWordsMissingPhonetic,
  markMeaningsFailed,
  ReviewError,
  saveReviewSelection,
  setMeanings,
  setPhonetic,
} from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, getDocument, updateDocumentStatus } from '@/server/repo/documents';

const candidate = (lemma: string, isExisting = false) => ({
  lemma,
  surface: lemma,
  sentence: `The ${lemma} matters.`,
  count: 1,
  isExisting,
  inDictionary: true,
});

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

function reviewingDocument(list: ReturnType<typeof candidate>[]) {
  const doc = createDocument(db, { title: 'Paper', kind: 'paper' });
  replaceCandidates(db, doc.id, list);
  updateDocumentStatus(db, doc.id, 'reviewing');
  const ids = new Map(listCandidates(db, doc.id).map((c) => [c.lemma, c.id]));
  return { doc, ids };
}

describe('saveReviewSelection', () => {
  it('turns selected candidates into cards and the rest into known words', () => {
    const { doc, ids } = reviewingDocument([candidate('robust'), candidate('paradigm')]);
    const saved = saveReviewSelection(db, doc.id, [ids.get('robust')!]);

    expect(saved.occurrenceIds).toHaveLength(1);
    expect(db.select().from(words).all().map((w) => w.lemma)).toEqual(['robust']);
    expect(db.select().from(knownWords).all().map((k) => k.lemma)).toEqual(['paradigm']);
    expect(listCandidates(db, doc.id)).toEqual([]);
    expect(getDocument(db, doc.id)?.status).toBe('processing');
  });

  it('reuses an existing card and only adds a new occurrence', () => {
    db.insert(words).values({ lemma: 'robust', phonetic: '/rəʊˈbʌst/' }).run();
    const { doc, ids } = reviewingDocument([candidate('robust', true)]);
    saveReviewSelection(db, doc.id, [ids.get('robust')!]);

    expect(db.select().from(words).all()).toHaveLength(1);
    expect(db.select().from(occurrences).all()).toHaveLength(1);
  });

  it('does not mark an existing card as known when it is unselected', () => {
    db.insert(words).values({ lemma: 'robust' }).run();
    const { doc } = reviewingDocument([candidate('robust', true)]);
    saveReviewSelection(db, doc.id, []);
    expect(db.select().from(knownWords).all()).toEqual([]);
  });

  it('ignores ids that are not candidates of this document', () => {
    const { doc } = reviewingDocument([candidate('robust')]);
    const saved = saveReviewSelection(db, doc.id, [9999]);
    expect(saved.occurrenceIds).toEqual([]);
  });

  it('refuses to save the same document twice', () => {
    const { doc, ids } = reviewingDocument([candidate('robust')]);
    saveReviewSelection(db, doc.id, [ids.get('robust')!]);
    expect(() => saveReviewSelection(db, doc.id, [])).toThrow(ReviewError);
    expect(() => saveReviewSelection(db, 12345, [])).toThrow('문서를 찾을 수 없습니다.');
  });
});

describe('meaning and phonetic updates', () => {
  it('lists requests, stores meanings and failures, and shows them per document', () => {
    const { doc, ids } = reviewingDocument([candidate('robust'), candidate('paradigm')]);
    const saved = saveReviewSelection(db, doc.id, [...ids.values()]);

    const requests = listMeaningRequests(db, saved.occurrenceIds);
    expect(requests.map((r) => r.lemma).sort()).toEqual(['paradigm', 'robust']);

    const robust = requests.find((r) => r.lemma === 'robust')!;
    const paradigm = requests.find((r) => r.lemma === 'paradigm')!;
    setMeanings(db, [{ id: robust.id, meaningKo: '견고한' }]);
    markMeaningsFailed(db, [paradigm.id]);

    const missing = listWordsMissingPhonetic(db, saved.wordIds);
    expect(missing).toHaveLength(2);
    setPhonetic(db, missing.find((w) => w.lemma === 'robust')!.id, '/rəʊˈbʌst/');

    expect(listOccurrencesByDocument(db, doc.id)).toMatchObject([
      { lemma: 'paradigm', meaningStatus: 'failed', meaningKo: null, phonetic: null },
      { lemma: 'robust', meaningStatus: 'done', meaningKo: '견고한', phonetic: '/rəʊˈbʌst/' },
    ]);
  });

  it('counts saved occurrences per document', () => {
    const { doc, ids } = reviewingDocument([candidate('robust'), candidate('paradigm')]);
    saveReviewSelection(db, doc.id, [...ids.values()]);
    expect(countOccurrencesByDocument(db).get(doc.id)).toBe(2);
  });

  it('returns empty lists for empty id lists', () => {
    expect(listMeaningRequests(db, [])).toEqual([]);
    expect(listWordsMissingPhonetic(db, [])).toEqual([]);
    markMeaningsFailed(db, []);
  });
});
