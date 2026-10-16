import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, USER } from '../helpers/users';
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
  addUser(db);
});

function saveCards(lemmas: string[]) {
  const doc = createDocument(db, USER, { title: 'A', kind: 'paper' });
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
  saveReviewSelection(db, USER, doc.id, listCandidates(db, USER, doc.id).map((c) => c.id));
}

const card = (lemma: string) => db.select().from(words).all().find((w) => w.lemma === lemma)!;

describe('undoAnswer', () => {
  it('restores a new card and gives the daily new slot back', () => {
    saveCards(['alpha', 'beta']);
    const before = card('alpha');
    const { logId } = recordAnswer(db, USER, before.id, 'good', now);
    expect(countStudyToday(db, USER, now, 1).fresh).toBe(0);

    expect(undoAnswer(db, USER, logId)).toEqual({ wordId: before.id });
    expect(card('alpha')).toEqual(before);
    expect(db.select().from(reviewLogs).all()).toEqual([]);
    expect(countStudyToday(db, USER, now, 1).fresh).toBe(1);
  });

  it('restores a reviewed card to its state before the last answer only', () => {
    saveCards(['alpha']);
    const id = card('alpha').id;
    recordAnswer(db, USER, id, 'good', now);
    const afterFirst = card('alpha');
    const { logId } = recordAnswer(db, USER, id, 'again', new Date(now.getTime() + 10 * MIN));

    undoAnswer(db, USER, logId);
    expect(card('alpha')).toEqual(afterFirst);
    expect(db.select().from(reviewLogs).all()).toHaveLength(1);
  });

  it('refuses when the card was answered again afterwards', () => {
    saveCards(['alpha']);
    const id = card('alpha').id;
    const first = recordAnswer(db, USER, id, 'again', now);
    recordAnswer(db, USER, id, 'good', new Date(now.getTime() + MIN));
    expect(() => undoAnswer(db, USER, first.logId)).toThrow(StudyError);
    expect(db.select().from(reviewLogs).all()).toHaveLength(2);
  });

  it('refuses a missing log, a second undo, and a log without a snapshot', () => {
    saveCards(['alpha']);
    const { logId } = recordAnswer(db, USER, card('alpha').id, 'good', now);
    undoAnswer(db, USER, logId);
    expect(() => undoAnswer(db, USER, logId)).toThrow(StudyError);

    const old = db
      .insert(reviewLogs)
      .values({ wordId: card('alpha').id, rating: 3, reviewedAt: now })
      .returning({ id: reviewLogs.id })
      .get();
    expect(() => undoAnswer(db, USER, old.id)).toThrow('되돌릴 수 없습니다');
  });
});
