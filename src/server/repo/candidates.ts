import { asc, count, desc, eq } from 'drizzle-orm';
import type { Candidate } from '@/lib/extract/extract';
import type { Db } from '../db/client';
import { candidates, type CandidateRow } from '../db/schema';

// 한 행에 변수 6개라 SQLite 상한(32766) 안에 들도록 나눠 넣는다.
const INSERT_CHUNK = 1000;

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

export function listCandidates(db: Db, documentId: number): CandidateRow[] {
  return db
    .select()
    .from(candidates)
    .where(eq(candidates.documentId, documentId))
    .orderBy(desc(candidates.count), asc(candidates.lemma))
    .all();
}

export function countCandidatesByDocument(db: Db): Map<number, number> {
  const rows = db
    .select({ documentId: candidates.documentId, total: count() })
    .from(candidates)
    .groupBy(candidates.documentId)
    .all();
  return new Map(rows.map((r) => [r.documentId, r.total]));
}
