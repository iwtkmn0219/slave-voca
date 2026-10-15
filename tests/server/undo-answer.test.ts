import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { reviewLogs, words } from '@/server/db/schema';
import { saveReviewSelection } from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, updateDocumentStatus } from '@/server/repo/documents';
import { countStudyToday, recordAnswer, StudyError, undoAnswer } from '@/server/repo/study';

const now = new Date(2026, 9, 16, 10, 0, 0);
const MIN = 60_000;

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

function saveCards(lemmas: string[]) {
  const doc = createDocument(db, { title: 'A', kind: 'paper' });
  replaceCandidates(
    db,
    doc.id,
    lemmas.map((lemma) => ({
      lemma,
      surface: lemma,
      sentence: `In A, ${lemma} matters.`,
      count: 1,
      isExisting: false,
      inDictionary: true,
    })),
  );
  updateDocumentStatus(db, doc.id, 'reviewing');
  saveReviewSelection(db, doc.id, listCandidates(db, doc.id).map((c) => c.id));
}

const card = (lemma: string) => db.select().from(words).all().find((w) => w.lemma === lemma)!;

describe('undoAnswer', () => {
  it('restores a new card and gives the daily new slot back', () => {
    saveCards(['alpha', 'beta']);
    const before = card('alpha');
    const { logId } = recordAnswer(db, before.id, 'good', now);
    expect(countStudyToday(db, now, 1).fresh).toBe(0);

    expect(undoAnswer(db, logId)).toEqual({ wordId: before.id });
    expect(card('alpha')).toEqual(before);
    expect(db.select().from(reviewLogs).all()).toEqual([]);
    expect(countStudyToday(db, now, 1).fresh).toBe(1);
  });

  it('restores a reviewed card to its state before the last answer only', () => {
    saveCards(['alpha']);
    const id = card('alpha').id;
    recordAnswer(db, id, 'good', now);
    const afterFirst = card('alpha');
    const { logId } = recordAnswer(db, id, 'again', new Date(now.getTime() + 10 * MIN));

    undoAnswer(db, logId);
    expect(card('alpha')).toEqual(afterFirst);
    expect(db.select().from(reviewLogs).all()).toHaveLength(1);
  });

  it('refuses when the card was answered again afterwards', () => {
    saveCards(['alpha']);
    const id = card('alpha').id;
    const first = recordAnswer(db, id, 'again', now);
    recordAnswer(db, id, 'good', new Date(now.getTime() + MIN));
    expect(() => undoAnswer(db, first.logId)).toThrow(StudyError);
    expect(db.select().from(reviewLogs).all()).toHaveLength(2);
  });

  it('refuses a missing log, a second undo, and a log without a snapshot', () => {
    saveCards(['alpha']);
    const { logId } = recordAnswer(db, card('alpha').id, 'good', now);
    undoAnswer(db, logId);
    expect(() => undoAnswer(db, logId)).toThrow(StudyError);

    const old = db
      .insert(reviewLogs)
      .values({ wordId: card('alpha').id, rating: 3, reviewedAt: now })
      .returning({ id: reviewLogs.id })
      .get();
    expect(() => undoAnswer(db, old.id)).toThrow('되돌릴 수 없습니다');
  });
});
