import { and, asc, count, desc, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { previewIntervals, type Intervals } from '@/lib/srs/interval';
import {
  ANSWER_GRADE,
  applyAnswer,
  newCardSlots,
  startOfLocalDay,
  type Answer,
} from '@/lib/srs/scheduler';
import type { Db } from '../db/client';
import { documents, occurrences, reviewLogs, words, type MeaningStatus, type WordRow } from '../db/schema';

const NEW_STATE = 0;
const USAGES_PER_CARD = 2;

export class StudyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudyError';
  }
}

export interface Usage {
  occurrenceId: number;
  surface: string;
  sentence: string;
  meaningKo: string | null;
  meaningStatus: MeaningStatus;
  documentTitle: string;
}

export interface StudyCard {
  wordId: number;
  lemma: string;
  phonetic: string | null;
  isNew: boolean;
  usages: Usage[]; // 최신 용례부터 최대 2개
  intervals: Intervals; // 응답별 다음 복습까지(ms). 답 버튼에 보여 준다
}

function countIntroducedToday(db: Db, now: Date): number {
  const row = db
    .select({ total: count() })
    .from(words)
    .where(gte(words.introducedAt, startOfLocalDay(now)))
    .get();
  return row?.total ?? 0;
}

function dueReviews(db: Db, now: Date): WordRow[] {
  return db
    .select()
    .from(words)
    .where(and(ne(words.state, NEW_STATE), lte(words.due, now)))
    .orderBy(asc(words.due), asc(words.id))
    .all();
}

function newCards(db: Db, limit: number): WordRow[] {
  if (limit <= 0) return [];
  return db
    .select()
    .from(words)
    .where(eq(words.state, NEW_STATE))
    .orderBy(asc(words.createdAt), asc(words.id))
    .limit(limit)
    .all();
}

function usagesByWord(db: Db, wordIds: number[]): Map<number, Usage[]> {
  const byWord = new Map<number, Usage[]>();
  if (wordIds.length === 0) return byWord;
  const rows = db
    .select({
      wordId: occurrences.wordId,
      occurrenceId: occurrences.id,
      surface: occurrences.surface,
      sentence: occurrences.sentence,
      meaningKo: occurrences.meaningKo,
      meaningStatus: occurrences.meaningStatus,
      documentTitle: documents.title,
    })
    .from(occurrences)
    .innerJoin(documents, eq(documents.id, occurrences.documentId))
    .where(inArray(occurrences.wordId, wordIds))
    .orderBy(desc(occurrences.createdAt), desc(occurrences.id))
    .all();
  for (const { wordId, ...usage } of rows) {
    const list = byWord.get(wordId) ?? [];
    if (list.length < USAGES_PER_CARD) list.push(usage);
    byWord.set(wordId, list);
  }
  return byWord;
}

// 오늘의 큐: 복습할 때가 된 카드(due 순) + 새 카드(만든 순, 하루 상한까지). 스펙 8.6.
export function getStudyQueue(db: Db, now: Date, dailyNewLimit: number): StudyCard[] {
  const slots = newCardSlots(dailyNewLimit, countIntroducedToday(db, now));
  const picked = [...dueReviews(db, now), ...newCards(db, slots)];
  const usages = usagesByWord(db, picked.map((w) => w.id));
  return picked.map((w) => ({
    wordId: w.id,
    lemma: w.lemma,
    phonetic: w.phonetic,
    isNew: w.state === NEW_STATE,
    usages: usages.get(w.id) ?? [],
    intervals: previewIntervals(w, now),
  }));
}

export function countStudyToday(
  db: Db,
  now: Date,
  dailyNewLimit: number,
): { review: number; fresh: number } {
  const review =
    db
      .select({ total: count() })
      .from(words)
      .where(and(ne(words.state, NEW_STATE), lte(words.due, now)))
      .get()?.total ?? 0;
  const waiting =
    db.select({ total: count() }).from(words).where(eq(words.state, NEW_STATE)).get()?.total ?? 0;
  const slots = newCardSlots(dailyNewLimit, countIntroducedToday(db, now));
  return { review, fresh: Math.min(waiting, slots) };
}

// 응답을 기록하고 다음 복습 일정을 저장한다. 새 카드는 처음 응답한 시각을 introducedAt으로 남긴다.
// 돌려주는 intervals는 응답 뒤 상태 기준 미리보기다. "모름"으로 세션 뒤에 다시 넣는 카드의 답 버튼을 갱신할 때 쓴다.
export function recordAnswer(
  db: Db,
  wordId: number,
  answer: Answer,
  now: Date,
): { due: Date; intervals: Intervals } {
  return db.transaction((tx) => {
    const word = tx.select().from(words).where(eq(words.id, wordId)).get();
    if (!word) throw new StudyError('카드를 찾을 수 없습니다.');
    const next = applyAnswer(word, answer, now);
    tx.update(words)
      .set({ ...next, introducedAt: word.introducedAt ?? now })
      .where(eq(words.id, wordId))
      .run();
    tx.insert(reviewLogs).values({ wordId, rating: ANSWER_GRADE[answer], reviewedAt: now }).run();
    return { due: next.due, intervals: previewIntervals(next, now) };
  });
}
