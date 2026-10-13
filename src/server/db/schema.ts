import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const DOCUMENT_KINDS = ['paper', 'presentation'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_STATUSES = ['extracting', 'reviewing', 'processing', 'done', 'error'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());

export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  kind: text('kind', { enum: DOCUMENT_KINDS }).notNull(),
  status: text('status', { enum: DOCUMENT_STATUSES }).notNull().default('extracting'),
  errorMessage: text('error_message'),
  createdAt: createdAt(),
});

export const candidates = sqliteTable('candidates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  lemma: text('lemma').notNull(),
  surface: text('surface').notNull(),
  sentence: text('sentence').notNull(),
  count: integer('count').notNull(),
  isExisting: integer('is_existing', { mode: 'boolean' }).notNull(),
  inDictionary: integer('in_dictionary', { mode: 'boolean' }).notNull().default(true),
});

// 카드. 복습(FSRS) 컬럼은 마일스톤 3에서 추가한다.
export const words = sqliteTable('words', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  lemma: text('lemma').notNull().unique(),
  phonetic: text('phonetic'),
  createdAt: createdAt(),
});

export const knownWords = sqliteTable('known_words', {
  lemma: text('lemma').primaryKey(),
  createdAt: createdAt(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type DocumentRow = typeof documents.$inferSelect;
export type CandidateRow = typeof candidates.$inferSelect;
