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
}

export function listMeaningRequests(db: Db, occurrenceIds: readonly number[]): MeaningRequestRow[] {
  if (occurrenceIds.length === 0) return [];
  return db
    .select({ id: occurrences.id, lemma: words.lemma, sentence: occurrences.sentence })
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
