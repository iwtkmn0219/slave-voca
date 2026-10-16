import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, OTHER, USER } from '../helpers/users';
import { makePdf } from '../helpers/make-pdf';
import type { MeaningModel } from '@/lib/meaning/generate';
import { createDb, type Db } from '@/server/db/client';
import { reviewLogs, words } from '@/server/db/schema';
import {
  countFailedMeaningsByDocument,
  countOccurrencesByDocument,
  countOccurrencesByWord,
  deleteCard,
  getOccurrenceMeaning,
  listFailedMeaningIds,
  listMeaningRequests,
  listOccurrencesByDocument,
  markMeaningsFailed,
  occurrencesBelongTo,
  ReviewError,
  saveReviewSelection,
} from '@/server/repo/cards';
import { countCandidatesByDocument, listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, getDocument, listDocuments, updateDocumentStatus } from '@/server/repo/documents';
import { getSettings, saveSettings } from '@/server/repo/settings';
import { countStudyToday, getStudyQueue, recordAnswer, StudyError, undoAnswer } from '@/server/repo/study';
import { listKnownLemmas, listWordLemmas } from '@/server/repo/vocabulary';
import { regenerateMeanings } from '@/server/services/enrich';
import { ingestPdf } from '@/server/services/ingest';
import { regenerateUsageMeaning } from '@/server/services/usage-meaning';

// M6-2 격리: 사용자 B는 A의 문서·후보·카드·용례·복습 기록을 어떤 입구로도 읽거나 바꾸지 못한다.
// 남의 id는 "없음"과 같게 다룬다.

const now = new Date(2026, 9, 16, 10, 0, 0);
const candidate = (lemma: string) => ({
  lemma,
  surface: lemma,
  sentence: `The ${lemma} matters.`,
  count: 1,
  isExisting: false,
  inDictionary: true,
});

let db: Db;
let a: { docId: number; reviewingDocId: number; wordId: number; occurrenceId: number; logId: number };

beforeEach(() => {
  db = createDb(':memory:');
  addUser(db, USER);
  addUser(db, OTHER);
  // A: 카드 하나(robust, 뜻 실패), 복습 기록 하나, 아는 단어 하나(paper), 검토 중인 문서 하나
  const doc = createDocument(db, USER, { title: 'A paper', kind: 'paper' });
  replaceCandidates(db, doc.id, [candidate('robust'), candidate('paper')]);
  updateDocumentStatus(db, doc.id, 'reviewing');
  const robust = listCandidates(db, USER, doc.id).find((c) => c.lemma === 'robust')!;
  const saved = saveReviewSelection(db, USER, doc.id, [robust.id]);
  markMeaningsFailed(db, saved.occurrenceIds);
  const { logId } = recordAnswer(db, USER, saved.wordIds[0], 'again', now);
  const reviewing = createDocument(db, USER, { title: 'A draft', kind: 'paper' });
  replaceCandidates(db, reviewing.id, [candidate('heterogeneous')]);
  updateDocumentStatus(db, reviewing.id, 'reviewing');
  a = { docId: doc.id, reviewingDocId: reviewing.id, wordId: saved.wordIds[0], occurrenceId: saved.occurrenceIds[0], logId };
});

describe('another user cannot see A', () => {
  it('documents, candidates and counts are empty for B', () => {
    expect(listDocuments(db, OTHER)).toEqual([]);
    expect(getDocument(db, OTHER, a.docId)).toBeUndefined();
    expect(listCandidates(db, OTHER, a.reviewingDocId)).toEqual([]);
    expect(countCandidatesByDocument(db, OTHER).size).toBe(0);
    expect(countOccurrencesByDocument(db, OTHER).size).toBe(0);
    expect(countFailedMeaningsByDocument(db, OTHER).size).toBe(0);
    expect(listOccurrencesByDocument(db, OTHER, a.docId)).toEqual([]);
    expect(countOccurrencesByWord(db, OTHER, [a.wordId]).size).toBe(0);
    expect(getOccurrenceMeaning(db, OTHER, a.occurrenceId)).toBeUndefined();
    expect(listFailedMeaningIds(db, OTHER, a.docId)).toEqual([]);
    expect(listMeaningRequests(db, OTHER, [a.occurrenceId])).toEqual([]);
    expect(listKnownLemmas(db, OTHER)).toEqual(new Set());
    expect(listWordLemmas(db, OTHER)).toEqual(new Set());
  });

  it('study queue and counts are B’s own', () => {
    expect(getStudyQueue(db, OTHER, now, 20)).toEqual([]);
    expect(countStudyToday(db, OTHER, now, 20)).toEqual({ review: 0, fresh: 0 });
    expect(getStudyQueue(db, USER, new Date(now.getTime() + 86_400_000), 20).map((c) => c.lemma)).toEqual(['robust']);
  });
});

describe('another user cannot change A', () => {
  it('cannot save A’s review, delete A’s card, or answer and undo on A’s card', () => {
    const ids = listCandidates(db, USER, a.reviewingDocId).map((c) => c.id);
    expect(() => saveReviewSelection(db, OTHER, a.reviewingDocId, ids)).toThrow(ReviewError);
    expect(getDocument(db, USER, a.reviewingDocId)?.status).toBe('reviewing');

    expect(deleteCard(db, OTHER, a.wordId)).toBe(false);
    expect(() => recordAnswer(db, OTHER, a.wordId, 'good', now)).toThrow(StudyError);
    expect(() => undoAnswer(db, OTHER, a.logId)).toThrow(StudyError);
    expect(db.select().from(words).all()).toHaveLength(1);
    expect(db.select().from(reviewLogs).all()).toHaveLength(1);
  });

  it('cannot regenerate A’s meanings through either entry point', async () => {
    let called = 0;
    const model: MeaningModel = async (batch) => {
      called += batch.length;
      return batch.map((r) => ({ id: r.id, meaningKo: '뜻' }));
    };
    expect(occurrencesBelongTo(db, OTHER, a.docId, [])).toBe(false);
    expect(occurrencesBelongTo(db, OTHER, a.docId, [a.occurrenceId])).toBe(false);
    expect(await regenerateMeanings(db, OTHER, [a.occurrenceId], model)).toEqual({ error: null, done: 0, failed: 0 });
    expect(await regenerateUsageMeaning(db, OTHER, a.occurrenceId, model)).toEqual({ error: '용례를 찾을 수 없습니다.' });
    expect(called).toBe(0);
    expect(getOccurrenceMeaning(db, USER, a.occurrenceId)?.meaningStatus).toBe('failed');
  });

  it('keeps settings apart', () => {
    saveSettings(db, OTHER, { excludeTopN: 5000, dailyNewLimit: 5, autoSpeak: true });
    expect(getSettings(db, USER).dailyNewLimit).toBe(20);
    expect(getSettings(db, OTHER)).toEqual({ excludeTopN: 5000, dailyNewLimit: 5, autoSpeak: true });
  });
});

describe('the same word for two users', () => {
  it('gives each user their own card and their own known words', async () => {
    const doc = createDocument(db, OTHER, { title: 'B paper', kind: 'paper' });
    replaceCandidates(db, doc.id, [candidate('robust'), candidate('paper')]);
    updateDocumentStatus(db, doc.id, 'reviewing');
    const ids = listCandidates(db, OTHER, doc.id).map((c) => c.id);
    saveReviewSelection(db, OTHER, doc.id, ids); // B는 둘 다 카드로(A는 paper를 아는 단어로 했다)

    const cards = db.select({ userId: words.userId, lemma: words.lemma }).from(words).all();
    expect(cards).toEqual(
      expect.arrayContaining([
        { userId: USER, lemma: 'robust' },
        { userId: OTHER, lemma: 'robust' },
        { userId: OTHER, lemma: 'paper' },
      ]),
    );
    expect(listKnownLemmas(db, USER)).toEqual(new Set(['paper']));
    expect(listKnownLemmas(db, OTHER)).toEqual(new Set());
  });

  it('extracts candidates for B without A’s known words or cards', async () => {
    const pdf = makePdf([
      [
        'This paper examines heterogeneous datasets with rigor.',
        'The proposed estimator remains robust under perturbations.',
        'We evaluate heterogeneous perturbations on several benchmarks.',
        'Results confirm that the estimator generalizes across domains.',
      ],
    ]);
    const result = await ingestPdf(db, OTHER, { fileName: 'b.pdf', title: '', kind: 'paper', bytes: pdf });
    const lemmas = listCandidates(db, OTHER, result.documentId);
    expect(lemmas.find((c) => c.lemma === 'robust')?.isExisting).toBe(false); // A의 카드는 B에게 "이미 있음"이 아니다
    expect(getDocument(db, USER, result.documentId)).toBeUndefined();
  });
});
