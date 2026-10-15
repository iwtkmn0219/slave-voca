import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  candidates,
  documents,
  knownWords,
  occurrences,
  words,
  type MeaningStatus,
} from '../db/schema';

export class ReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewError';
  }
}

export interface SavedCards {
  occurrenceIds: number[];
  wordIds: number[];
}

// 검토 결과 저장: 선택 → 카드(words)+용례(occurrences), 선택 해제 → 아는 단어.
// 이미 카드인 단어를 해제하면 이번 용례만 건너뛰고 아는 단어로 넣지 않는다.
export function saveReviewSelection(
  db: Db,
  documentId: number,
  selectedCandidateIds: readonly number[],
): SavedCards {
  return db.transaction((tx) => {
    const doc = tx.select().from(documents).where(eq(documents.id, documentId)).get();
    if (!doc) throw new ReviewError('문서를 찾을 수 없습니다.');
    if (doc.status !== 'reviewing') throw new ReviewError('이미 저장한 문서입니다.');

    const selected = new Set(selectedCandidateIds);
    const list = tx.select().from(candidates).where(eq(candidates.documentId, documentId)).all();
    const saved: SavedCards = { occurrenceIds: [], wordIds: [] };

    for (const c of list) {
      // candidates.isExisting은 추출 시점 값이라, 그 뒤 다른 문서에서 카드가 됐을 수 있다. 지금의 words를 본다.
      const existing = tx.select().from(words).where(eq(words.lemma, c.lemma)).get();
      if (!selected.has(c.id)) {
        if (!existing) {
          tx.insert(knownWords).values({ lemma: c.lemma }).onConflictDoNothing().run();
        }
        continue;
      }
      // 선택이 이긴다: 다른 문서에서 아는 단어로 등록했더라도 이번에 고르면 카드로 만든다.
      tx.delete(knownWords).where(eq(knownWords.lemma, c.lemma)).run();
      const word = existing ?? tx.insert(words).values({ lemma: c.lemma }).returning().get();
      const occurrence = tx
        .insert(occurrences)
        .values({ wordId: word.id, documentId, surface: c.surface, sentence: c.sentence })
        .returning({ id: occurrences.id })
        .get();
      saved.occurrenceIds.push(occurrence.id);
      saved.wordIds.push(word.id);
    }

    tx.delete(candidates).where(eq(candidates.documentId, documentId)).run();
    tx.update(documents)
      .set({ status: 'processing', errorMessage: null })
      .where(eq(documents.id, documentId))
      .run();
    return saved;
  });
}

export interface MeaningRequestRow {
  id: number;
  lemma: string;
  sentence: string;
  meaningStatus: MeaningStatus;
}

export function listMeaningRequests(db: Db, occurrenceIds: readonly number[]): MeaningRequestRow[] {
  if (occurrenceIds.length === 0) return [];
  return db
    .select({
      id: occurrences.id,
      lemma: words.lemma,
      sentence: occurrences.sentence,
      meaningStatus: occurrences.meaningStatus,
    })
    .from(occurrences)
    .innerJoin(words, eq(words.id, occurrences.wordId))
    .where(inArray(occurrences.id, [...occurrenceIds]))
    .orderBy(asc(occurrences.id))
    .all();
}

export function setMeanings(db: Db, results: { id: number; meaningKo: string }[]): void {
  db.transaction((tx) => {
    for (const r of results) {
      tx.update(occurrences)
        .set({ meaningKo: r.meaningKo, meaningStatus: 'done' })
        .where(eq(occurrences.id, r.id))
        .run();
    }
  });
}

export function markMeaningsFailed(db: Db, occurrenceIds: readonly number[]): void {
  if (occurrenceIds.length === 0) return;
  db.update(occurrences)
    .set({ meaningStatus: 'failed' })
    .where(inArray(occurrences.id, [...occurrenceIds]))
    .run();
}

// 채우기가 중간에 실패했을 때: 아직 pending인 용례만 failed로 바꾼다(이미 done인 뜻은 둔다).
export function markPendingMeaningsFailed(db: Db, occurrenceIds: readonly number[]): void {
  if (occurrenceIds.length === 0) return;
  db.update(occurrences)
    .set({ meaningStatus: 'failed' })
    .where(
      and(inArray(occurrences.id, [...occurrenceIds]), eq(occurrences.meaningStatus, 'pending')),
    )
    .run();
}

export function listWordsMissingPhonetic(
  db: Db,
  wordIds: readonly number[],
): { id: number; lemma: string }[] {
  if (wordIds.length === 0) return [];
  return db
    .select({ id: words.id, lemma: words.lemma })
    .from(words)
    .where(and(inArray(words.id, [...new Set(wordIds)]), isNull(words.phonetic)))
    .all();
}

export function setPhonetic(db: Db, wordId: number, phonetic: string): void {
  db.update(words).set({ phonetic }).where(eq(words.id, wordId)).run();
}

export interface OccurrenceView {
  id: number;
  wordId: number;
  lemma: string;
  phonetic: string | null;
  surface: string;
  sentence: string;
  meaningKo: string | null;
  meaningStatus: MeaningStatus;
}

export function listOccurrencesByDocument(db: Db, documentId: number): OccurrenceView[] {
  return db
    .select({
      id: occurrences.id,
      wordId: words.id,
      lemma: words.lemma,
      phonetic: words.phonetic,
      surface: occurrences.surface,
      sentence: occurrences.sentence,
      meaningKo: occurrences.meaningKo,
      meaningStatus: occurrences.meaningStatus,
    })
    .from(occurrences)
    .innerJoin(words, eq(words.id, occurrences.wordId))
    .where(eq(occurrences.documentId, documentId))
    .orderBy(asc(words.lemma))
    .all();
}

export function countOccurrencesByDocument(db: Db): Map<number, number> {
  const rows = db
    .select({ documentId: occurrences.documentId, total: count() })
    .from(occurrences)
    .groupBy(occurrences.documentId)
    .all();
  return new Map(rows.map((r) => [r.documentId, r.total]));
}

// 문서별 뜻 생성 실패 수. 홈·문서 목록에서 안내할 때 쓴다.
export function countFailedMeaningsByDocument(db: Db): Map<number, number> {
  const rows = db
    .select({ documentId: occurrences.documentId, total: count() })
    .from(occurrences)
    .where(eq(occurrences.meaningStatus, 'failed'))
    .groupBy(occurrences.documentId)
    .all();
  return new Map(rows.map((r) => [r.documentId, r.total]));
}

// 용례 하나의 지금 뜻과 상태. 복습 카드에서 다시 만든 뒤 새 뜻을 돌려줄 때 쓴다.
export function getOccurrenceMeaning(
  db: Db,
  occurrenceId: number,
): { meaningKo: string | null; meaningStatus: MeaningStatus } | undefined {
  return db
    .select({ meaningKo: occurrences.meaningKo, meaningStatus: occurrences.meaningStatus })
    .from(occurrences)
    .where(eq(occurrences.id, occurrenceId))
    .get();
}

// 문서에서 뜻 생성에 실패한 용례. "모두 다시 시도"가 쓴다.
export function listFailedMeaningIds(db: Db, documentId: number): number[] {
  return db
    .select({ id: occurrences.id })
    .from(occurrences)
    .where(and(eq(occurrences.documentId, documentId), eq(occurrences.meaningStatus, 'failed')))
    .orderBy(asc(occurrences.id))
    .all()
    .map((r) => r.id);
}

// 용례가 문서 안에 있는지. 다른 문서의 용례 id로 고치거나 다시 시도하지 못하게 막는다.
export function occurrencesBelongTo(db: Db, documentId: number, occurrenceIds: readonly number[]): boolean {
  if (occurrenceIds.length === 0) return true;
  const found = db
    .select({ id: occurrences.id })
    .from(occurrences)
    .where(and(eq(occurrences.documentId, documentId), inArray(occurrences.id, [...occurrenceIds])))
    .all();
  return found.length === new Set(occurrenceIds).size;
}

// 카드별 용례 수(모든 문서). 카드 삭제 확인 문구에 쓴다.
export function countOccurrencesByWord(db: Db, wordIds: readonly number[]): Map<number, number> {
  if (wordIds.length === 0) return new Map();
  const rows = db
    .select({ wordId: occurrences.wordId, total: count() })
    .from(occurrences)
    .where(inArray(occurrences.wordId, [...new Set(wordIds)]))
    .groupBy(occurrences.wordId)
    .all();
  return new Map(rows.map((r) => [r.wordId, r.total]));
}

// 카드 삭제: 카드(words)를 지우면 외래 키(ON DELETE CASCADE)로 모든 문서의 용례와 복습 기록이 함께 지워진다.
// 삭제한 단어는 아는 단어(known_words)에 넣지 않는다(스펙 7장). 카드가 없으면 false.
export function deleteCard(db: Db, wordId: number): boolean {
  const row = db.delete(words).where(eq(words.id, wordId)).returning({ id: words.id }).get();
  return row !== undefined;
}
