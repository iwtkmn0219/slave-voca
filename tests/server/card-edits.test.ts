import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { knownWords, occurrences, reviewLogs, words } from '@/server/db/schema';
import {
  countOccurrencesByWord,
  deleteCard,
  getOccurrenceMeaning,
  listFailedMeaningIds,
  listOccurrencesByDocument,
  markMeaningsFailed,
  occurrencesBelongTo,
  saveReviewSelection,
} from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, updateDocumentStatus } from '@/server/repo/documents';
import { recordAnswer } from '@/server/repo/study';

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

// 문서 하나를 만들어 lemmas를 모두 카드로 저장한다.
function savedDocument(title: string, lemmas: string[]) {
  const doc = createDocument(db, { title, kind: 'paper' });
  replaceCandidates(
    db,
    doc.id,
    lemmas.map((lemma) => ({
      lemma,
      surface: lemma,
      sentence: `In ${title}, ${lemma} matters.`,
      count: 1,
      isExisting: false,
      inDictionary: true,
    })),
  );
  updateDocumentStatus(db, doc.id, 'reviewing');
  const saved = saveReviewSelection(db, doc.id, listCandidates(db, doc.id).map((c) => c.id));
  return { doc, saved };
}

describe('getOccurrenceMeaning', () => {
  it('returns the current meaning and status, or undefined', () => {
    const { saved } = savedDocument('A', ['progression']);
    markMeaningsFailed(db, saved.occurrenceIds);
    expect(getOccurrenceMeaning(db, saved.occurrenceIds[0])).toEqual({ meaningKo: null, meaningStatus: 'failed' });
    expect(getOccurrenceMeaning(db, 999)).toBeUndefined();
  });
});

describe('listFailedMeaningIds and occurrencesBelongTo', () => {
  it('lists only failed occurrences of the document', () => {
    const a = savedDocument('A', ['alpha', 'beta']);
    const b = savedDocument('B', ['gamma']);
    markMeaningsFailed(db, [a.saved.occurrenceIds[1], b.saved.occurrenceIds[0]]);
    expect(listFailedMeaningIds(db, a.doc.id)).toEqual([a.saved.occurrenceIds[1]]);
  });

  it('checks that every id belongs to the document', () => {
    const a = savedDocument('A', ['alpha', 'beta']);
    const b = savedDocument('B', ['gamma']);
    expect(occurrencesBelongTo(db, a.doc.id, a.saved.occurrenceIds)).toBe(true);
    expect(occurrencesBelongTo(db, a.doc.id, [a.saved.occurrenceIds[0], b.saved.occurrenceIds[0]])).toBe(
      false,
    );
    expect(occurrencesBelongTo(db, a.doc.id, [])).toBe(true);
  });
});

describe('deleteCard', () => {
  it('removes the card with its usages in every document and its review log', () => {
    const a = savedDocument('A', ['robust', 'paradigm']);
    savedDocument('B', ['robust']);
    const robust = db.select().from(words).all().find((w) => w.lemma === 'robust')!;
    recordAnswer(db, robust.id, 'good', new Date());
    expect(countOccurrencesByWord(db, [robust.id]).get(robust.id)).toBe(2);

    expect(deleteCard(db, robust.id)).toBe(true);
    expect(db.select().from(words).all().map((w) => w.lemma)).toEqual(['paradigm']);
    expect(db.select().from(occurrences).all()).toHaveLength(1);
    expect(db.select().from(reviewLogs).all()).toEqual([]);
    expect(db.select().from(knownWords).all()).toEqual([]);
    expect(listOccurrencesByDocument(db, a.doc.id).map((r) => r.lemma)).toEqual(['paradigm']);
  });

  it('returns false for a missing card', () => {
    expect(deleteCard(db, 999)).toBe(false);
  });
});
