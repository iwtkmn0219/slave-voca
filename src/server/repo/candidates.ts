import { asc, count, desc, eq } from 'drizzle-orm';
import type { Candidate } from '@/lib/extract/extract';
import type { Db } from '../db/client';
import { candidates, type CandidateRow } from '../db/schema';

export function replaceCandidates(db: Db, documentId: number, list: Candidate[]): void {
  db.transaction((tx) => {
    tx.delete(candidates).where(eq(candidates.documentId, documentId)).run();
    if (list.length > 0) {
      tx.insert(candidates)
        .values(list.map((c) => ({ ...c, documentId })))
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
