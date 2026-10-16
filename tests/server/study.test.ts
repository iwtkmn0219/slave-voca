import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, USER } from '../helpers/users';
import { createDb, type Db } from '@/server/db/client';
import { reviewLogs, words } from '@/server/db/schema';
import { saveReviewSelection, setMeanings, listMeaningRequests } from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, updateDocumentStatus } from '@/server/repo/documents';
import { countStudyToday, getStudyQueue, recordAnswer, StudyError } from '@/server/repo/study';

const now = new Date(2026, 9, 13, 10, 0, 0);
const HOUR = 3_600_000;

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  addUser(db);
});

// 문서 하나를 저장해 카드를 만든다. 카드는 lemmas 순서대로 만들어진다.
function saveCards(title: string, lemmas: string[]) {
  const doc = createDocument(db, USER, { title, kind: 'paper' });
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
  return saveReviewSelection(db, USER, doc.id, listCandidates(db, USER, doc.id).map((c) => c.id));
}

const wordId = (lemma: string) => db.select().from(words).all().find((w) => w.lemma === lemma)!.id;

describe('getStudyQueue', () => {
  it('serves new cards in creation order up to the daily limit', () => {
    saveCards('A', ['alpha', 'beta', 'gamma']);
    const queue = getStudyQueue(db, USER, now, 2);
    expect(queue.map((c) => c.lemma)).toEqual(['alpha', 'beta']);
    expect(queue.every((c) => c.isNew)).toBe(true);
    expect(queue[0].intervals.again).toBeLessThanOrEqual(queue[0].intervals.good);
    expect(queue[0].intervals.good).toBeGreaterThan(0);
  });

  it('counts new cards already introduced today against the limit', () => {
    saveCards('A', ['alpha', 'beta', 'gamma']);
    recordAnswer(db, USER, wordId('alpha'), 'good', now);
    const later = new Date(now.getTime() + HOUR);
    expect(getStudyQueue(db, USER, later, 2).filter((c) => c.isNew).map((c) => c.lemma)).toEqual(['beta']);
  });

  it('resets the new card allowance the next day', () => {
    saveCards('A', ['alpha', 'beta', 'gamma']);
    recordAnswer(db, USER, wordId('alpha'), 'good', now);
    recordAnswer(db, USER, wordId('beta'), 'good', now);
    const tomorrow = new Date(2026, 9, 14, 9, 0, 0);
    expect(getStudyQueue(db, USER, tomorrow, 2).filter((c) => c.isNew).map((c) => c.lemma)).toEqual([
      'gamma',
    ]);
  });

  it('puts due reviews first, oldest due first, and skips cards not yet due', () => {
    saveCards('A', ['alpha', 'beta', 'gamma']);
    recordAnswer(db, USER, wordId('alpha'), 'again', now); // 몇 분 뒤 다시
    recordAnswer(db, USER, wordId('beta'), 'again', new Date(now.getTime() - HOUR));
    const queue = getStudyQueue(db, USER, new Date(now.getTime() + HOUR), 20);
    expect(queue.map((c) => [c.lemma, c.isNew])).toEqual([
      ['beta', false],
      ['alpha', false],
      ['gamma', true],
    ]);
    expect(getStudyQueue(db, USER, now, 0).map((c) => c.lemma)).toEqual(['beta']);
  });

  it('attaches up to two latest usages with meanings and document titles', () => {
    saveCards('First', ['robust']);
    saveCards('Second', ['robust']);
    saveCards('Third', ['robust']);
    const requests = listMeaningRequests(db, USER, [3]);
    setMeanings(db, [{ id: requests[0].id, meaningKo: '견고한' }]);

    const [card] = getStudyQueue(db, USER, now, 20);
    expect(card.usages).toHaveLength(2);
    expect(card.usages[0]).toMatchObject({
      documentTitle: 'Third',
      meaningKo: '견고한',
      meaningStatus: 'done',
      sentence: 'In Third, robust matters.',
    });
    expect(card.usages[1]).toMatchObject({ documentTitle: 'Second', meaningStatus: 'pending' });
  });
});

describe('countStudyToday', () => {
  it('counts due reviews and the new cards still available today', () => {
    saveCards('A', ['alpha', 'beta', 'gamma']);
    recordAnswer(db, USER, wordId('alpha'), 'again', now);
    const later = new Date(now.getTime() + HOUR);
    expect(countStudyToday(db, USER, later, 20)).toEqual({ review: 1, fresh: 2 });
    expect(countStudyToday(db, USER, later, 1)).toEqual({ review: 1, fresh: 0 });
  });
});

describe('recordAnswer', () => {
  it('updates the schedule, stamps introduction once and logs the review', () => {
    saveCards('A', ['alpha']);
    const id = wordId('alpha');
    const first = recordAnswer(db, USER, id, 'good', now);
    expect(first.intervals.good).toBeGreaterThan(0);
    const later = new Date(now.getTime() + 2 * HOUR);
    recordAnswer(db, USER, id, 'hard', later);

    const word = db.select().from(words).all()[0];
    expect(first.due.getTime()).toBeGreaterThan(now.getTime());
    expect(word.introducedAt).toEqual(now);
    expect(word.reps).toBe(2);
    expect(db.select().from(reviewLogs).all().map((l) => l.rating)).toEqual([3, 2]);
  });

  it('rejects unknown cards', () => {
    expect(() => recordAnswer(db, USER, 999, 'good', now)).toThrow(StudyError);
  });
});
