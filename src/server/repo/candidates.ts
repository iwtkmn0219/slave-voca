import { and, asc, count, desc, eq, getTableColumns } from 'drizzle-orm';
import type { Candidate } from '@/lib/extract/extract';
import type { Db } from '../db/client';
import { candidates, documents, type CandidateRow } from '../db/schema';

// 한 행에 변수 7개라 SQLite 상한(32766) 안에 들도록 나눠 넣는다.
const INSERT_CHUNK = 1000;

// 내부용: 방금 만든(주인을 확인한) 문서의 후보를 바꾼다.
export function replaceCandidates(db: Db, documentId: number, list: Candidate[]): void {
  db.transaction((tx) => {
    tx.delete(candidates).where(eq(candidates.documentId, documentId)).run();
    for (let i = 0; i < list.length; i += INSERT_CHUNK) {
      tx.insert(candidates)
        .values(list.slice(i, i + INSERT_CHUNK).map((c) => ({ ...c, documentId })))
        .run();
    }
  });
}

export function listCandidates(db: Db, userId: string, documentId: number): CandidateRow[] {
  return db
    .select(getTableColumns(candidates))
    .from(candidates)
    .innerJoin(documents, eq(documents.id, candidates.documentId))
    .where(and(eq(candidates.documentId, documentId), eq(documents.userId, userId)))
    .orderBy(desc(candidates.count), asc(candidates.lemma))
    .all();
}

export function countCandidatesByDocument(db: Db, userId: string): Map<number, number> {
  const rows = db
    .select({ documentId: candidates.documentId, total: count() })
    .from(candidates)
    .innerJoin(documents, eq(documents.id, candidates.documentId))
    .where(eq(documents.userId, userId))
    .groupBy(candidates.documentId)
    .all();
  return new Map(rows.map((r) => [r.documentId, r.total]));
}
