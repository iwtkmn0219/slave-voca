import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  documents,
  type DocumentKind,
  type DocumentRow,
  type DocumentStatus,
} from '../db/schema';

export function createDocument(db: Db, input: { title: string; kind: DocumentKind }): DocumentRow {
  return db.insert(documents).values(input).returning().get();
}

export function updateDocumentStatus(
  db: Db,
  id: number,
  status: DocumentStatus,
  errorMessage: string | null = null,
): void {
  db.update(documents).set({ status, errorMessage }).where(eq(documents.id, id)).run();
}

export function getDocument(db: Db, id: number): DocumentRow | undefined {
  return db.select().from(documents).where(eq(documents.id, id)).get();
}

export function listDocuments(db: Db): DocumentRow[] {
  return db.select().from(documents).orderBy(desc(documents.createdAt), desc(documents.id)).all();
}
