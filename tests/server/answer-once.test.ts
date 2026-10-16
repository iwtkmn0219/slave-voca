import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, OTHER, USER } from '../helpers/users';
import { createDb, type Db } from '@/server/db/client';
import { reviewLogs, words } from '@/server/db/schema';
import { saveReviewSelection } from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, updateDocumentStatus } from '@/server/repo/documents';
import { recordAnswerOnce, resetAnswerAttemptsForTest } from '@/server/services/answer-once';

const now = new Date(2026, 9, 13, 10, 0, 0);
let db: Db;
let wordId: number;
beforeEach(() => {
  resetAnswerAttemptsForTest();
  db = createDb(':memory:');
  addUser(db);
  addUser(db, OTHER);
  const doc = createDocument(db, USER, { title: 'Paper', kind: 'paper' });
  replaceCandidates(db, doc.id, [
    { lemma: 'robust', surface: 'robust', sentence: 'A robust model.', count: 1, isExisting: false, inDictionary: true },
  ]);
  updateDocumentStatus(db, doc.id, 'reviewing');
  saveReviewSelection(db, USER, doc.id, listCandidates(db, USER, doc.id).map((c) => c.id));
  wordId = db.select().from(words).all()[0].id;
});

const logs = () => db.select().from(reviewLogs).all();

// 서버는 저장했지만 응답이 유실되어 화면이 같은 응답을 다시 보낸다(휴대폰 망).
describe('recordAnswerOnce', () => {
  it('applies a retried answer with the same attempt id only once', () => {
    const first = recordAnswerOnce(db, USER, wordId, 'good', 'attempt-1', now);
    const retry = recordAnswerOnce(db, USER, wordId, 'good', 'attempt-1', new Date(now.getTime() + 5000));
    expect(retry).toEqual(first);
    expect(logs()).toHaveLength(1);
    expect(db.select().from(words).all()[0].reps).toBe(1);
  });

  it('replaces the earlier answer when the retry carries a different choice', () => {
    recordAnswerOnce(db, USER, wordId, 'good', 'attempt-1', now);
    const second = recordAnswerOnce(db, USER, wordId, 'again', 'attempt-1', new Date(now.getTime() + 5000));
    expect(logs()).toMatchObject([{ rating: 1 }]);
    expect(logs()[0].id).toBe(second.logId);
    expect(db.select().from(words).all()[0].reps).toBe(1);
  });

  it('treats different attempt ids, other users and missing ids as separate answers', () => {
    recordAnswerOnce(db, USER, wordId, 'good', 'attempt-1', now);
    recordAnswerOnce(db, USER, wordId, 'good', 'attempt-2', now);
    recordAnswerOnce(db, USER, wordId, 'good', null, now);
    recordAnswerOnce(db, USER, wordId, 'good', null, now);
    expect(logs()).toHaveLength(4);
    // 같은 시도 id라도 다른 사용자의 요청은 그 사용자의 카드에만 쓰인다(남의 카드는 찾을 수 없음).
    expect(() => recordAnswerOnce(db, OTHER, wordId, 'good', 'attempt-1', now)).toThrow();
    expect(logs()).toHaveLength(4);
  });
});
