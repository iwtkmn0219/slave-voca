import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  documents,
  type DocumentKind,
  type DocumentRow,
  type DocumentStatus,
} from '../db/schema';

// 문서는 올린 사람의 것이다. id로 찾는 함수는 모두 사용자를 함께 받아, 남의 문서는 "없음"으로 본다(M6-2).
export function createDocument(db: Db, userId: string, input: { title: string; kind: DocumentKind }): DocumentRow {
  return db.insert(documents).values({ ...input, userId }).returning().get();
}

// 내부용: 주인을 이미 확인한 문서(올리기·저장 흐름 안)의 상태를 바꾼다.
export function updateDocumentStatus(
  db: Db,
  id: number,
  status: DocumentStatus,
  errorMessage: string | null = null,
): void {
  db.update(documents).set({ status, errorMessage }).where(eq(documents.id, id)).run();
}

export function getDocument(db: Db, userId: string, id: number): DocumentRow | undefined {
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .get();
}

export function listDocuments(db: Db, userId: string): DocumentRow[] {
  return db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt), desc(documents.id))
    .all();
}
