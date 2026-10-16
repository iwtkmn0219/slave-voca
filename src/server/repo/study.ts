import { and, asc, count, desc, eq, getTableColumns, gte, inArray, lte, ne } from 'drizzle-orm';
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

// 큐와 수는 모두 그 사용자의 카드만 센다(M6-2).
function countIntroducedToday(db: Db, userId: string, now: Date): number {
  const row = db
    .select({ total: count() })
    .from(words)
    .where(and(eq(words.userId, userId), gte(words.introducedAt, startOfLocalDay(now))))
    .get();
  return row?.total ?? 0;
}

function dueReviews(db: Db, userId: string, now: Date): WordRow[] {
  return db
    .select()
    .from(words)
    .where(and(eq(words.userId, userId), ne(words.state, NEW_STATE), lte(words.due, now)))
    .orderBy(asc(words.due), asc(words.id))
    .all();
}

function newCards(db: Db, userId: string, limit: number): WordRow[] {
  if (limit <= 0) return [];
  return db
    .select()
    .from(words)
    .where(and(eq(words.userId, userId), eq(words.state, NEW_STATE)))
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
export function getStudyQueue(db: Db, userId: string, now: Date, dailyNewLimit: number): StudyCard[] {
  const slots = newCardSlots(dailyNewLimit, countIntroducedToday(db, userId, now));
  const picked = [...dueReviews(db, userId, now), ...newCards(db, userId, slots)];
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

// 이 사용자에게 카드가 하나라도 있는지. 복습 빈 화면에서 "지금 없음"과 "아직 없음"을 나눈다.
export function hasAnyCard(db: Db, userId: string): boolean {
  return db.select({ id: words.id }).from(words).where(eq(words.userId, userId)).limit(1).get() !== undefined;
}

export function countStudyToday(
  db: Db,
  userId: string,
  now: Date,
  dailyNewLimit: number,
): { review: number; fresh: number } {
  const review =
    db
      .select({ total: count() })
      .from(words)
      .where(and(eq(words.userId, userId), ne(words.state, NEW_STATE), lte(words.due, now)))
      .get()?.total ?? 0;
  const waiting =
    db
      .select({ total: count() })
      .from(words)
      .where(and(eq(words.userId, userId), eq(words.state, NEW_STATE)))
      .get()?.total ?? 0;
  const slots = newCardSlots(dailyNewLimit, countIntroducedToday(db, userId, now));
  return { review, fresh: Math.min(waiting, slots) };
}

// 응답 전 카드의 일정 상태. review_logs.prev_card에 JSON으로 둔다(시각은 ms).
interface CardSnapshot {
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: number | null;
  introducedAt: number | null;
}

function snapshot(w: WordRow): CardSnapshot {
  return {
    due: w.due.getTime(),
    stability: w.stability,
    difficulty: w.difficulty,
    elapsedDays: w.elapsedDays,
    scheduledDays: w.scheduledDays,
    learningSteps: w.learningSteps,
    reps: w.reps,
    lapses: w.lapses,
    state: w.state,
    lastReview: w.lastReview?.getTime() ?? null,
    introducedAt: w.introducedAt?.getTime() ?? null,
  };
}

function restore(s: CardSnapshot) {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsedDays: s.elapsedDays,
    scheduledDays: s.scheduledDays,
    learningSteps: s.learningSteps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    lastReview: s.lastReview === null ? null : new Date(s.lastReview),
    introducedAt: s.introducedAt === null ? null : new Date(s.introducedAt),
  };
}

// 응답을 기록하고 다음 복습 일정을 저장한다. 새 카드는 처음 응답한 시각을 introducedAt으로 남긴다.
// 돌려주는 intervals는 응답 뒤 상태 기준 미리보기다. "모름"으로 세션 뒤에 다시 넣는 카드의 답 버튼을 갱신할 때 쓴다.
// logId는 이 응답의 기록 id다. 직전 응답 되돌리기(undoAnswer)에 쓴다.
export function recordAnswer(
  db: Db,
  userId: string,
  wordId: number,
  answer: Answer,
  now: Date,
): { due: Date; intervals: Intervals; logId: number } {
  return db.transaction((tx) => {
    const word = tx
      .select()
      .from(words)
      .where(and(eq(words.id, wordId), eq(words.userId, userId)))
      .get();
    if (!word) throw new StudyError('카드를 찾을 수 없습니다.');
    const next = applyAnswer(word, answer, now);
    tx.update(words)
      .set({ ...next, introducedAt: word.introducedAt ?? now })
      .where(eq(words.id, wordId))
      .run();
    const log = tx
      .insert(reviewLogs)
      .values({ wordId, rating: ANSWER_GRADE[answer], reviewedAt: now, prevCard: JSON.stringify(snapshot(word)) })
      .returning({ id: reviewLogs.id })
      .get();
    return { due: next.due, intervals: previewIntervals(next, now), logId: log.id };
  });
}

// 직전 응답 되돌리기: 카드를 응답 전 상태로 되돌리고 그 기록을 지운다.
// 그 카드의 가장 최근 기록만 되돌린다(다른 탭에서 또 답했으면 거부). 되돌린 카드의 wordId를 돌려준다.
export function undoAnswer(db: Db, userId: string, logId: number): { wordId: number } {
  return db.transaction((tx) => {
    // 그 사용자의 카드에 남긴 기록만 되돌린다. 남의 기록 id는 "없음"과 같다.
    const log = tx
      .select(getTableColumns(reviewLogs))
      .from(reviewLogs)
      .innerJoin(words, eq(words.id, reviewLogs.wordId))
      .where(and(eq(reviewLogs.id, logId), eq(words.userId, userId)))
      .get();
    if (!log) throw new StudyError('되돌릴 응답이 없습니다.');
    if (log.prevCard === null) throw new StudyError('이 응답은 되돌릴 수 없습니다.');
    const latest = tx
      .select({ id: reviewLogs.id })
      .from(reviewLogs)
      .where(eq(reviewLogs.wordId, log.wordId))
      .orderBy(desc(reviewLogs.id))
      .limit(1)
      .get();
    if (latest?.id !== log.id) throw new StudyError('그 뒤에 이 카드에 다시 답해서 되돌릴 수 없습니다.');
    tx.update(words)
      .set(restore(JSON.parse(log.prevCard) as CardSnapshot))
      .where(eq(words.id, log.wordId))
      .run();
    tx.delete(reviewLogs).where(eq(reviewLogs.id, log.id)).run();
    return { wordId: log.wordId };
  });
}
