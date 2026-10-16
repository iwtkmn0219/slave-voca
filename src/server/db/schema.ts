import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { users } from "./auth-schema";

export const DOCUMENT_KINDS = ["paper", "presentation"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_STATUSES = [
  "extracting",
  "reviewing",
  "processing",
  "done",
  "error",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

// 데이터의 주인(M6-2). 사용자를 지우면 그 사람의 데이터도 함께 지워진다.
const owner = () =>
  text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const documents = sqliteTable(
  "documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: owner(),
    title: text("title").notNull(),
    kind: text("kind", { enum: DOCUMENT_KINDS }).notNull(),
    status: text("status", { enum: DOCUMENT_STATUSES })
      .notNull()
      .default("extracting"),
    errorMessage: text("error_message"),
    createdAt: createdAt(),
  },
  (t) => [index("documents_user_id_idx").on(t.userId)],
);

export const candidates = sqliteTable("candidates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  lemma: text("lemma").notNull(),
  surface: text("surface").notNull(),
  sentence: text("sentence").notNull(),
  count: integer("count").notNull(),
  isExisting: integer("is_existing", { mode: "boolean" }).notNull(),
  inDictionary: integer("in_dictionary", { mode: "boolean" })
    .notNull()
    .default(true),
});

// 카드. FSRS 컬럼 기본값은 "아직 한 번도 보지 않은 새 카드"(state 0 = New)다.
// 같은 단어도 사용자마다 따로 카드다: (user_id, lemma)가 고유하다.
export const words = sqliteTable(
  "words",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: owner(),
    lemma: text("lemma").notNull(),
    phonetic: text("phonetic"),
    createdAt: createdAt(),
    due: integer("due", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`0`),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    state: integer("state").notNull().default(0),
    lastReview: integer("last_review", { mode: "timestamp_ms" }),
    // 새 카드를 처음 응답한 시각. 하루 새 카드 상한을 셀 때 쓴다.
    introducedAt: integer("introduced_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("words_user_id_lemma_unique").on(t.userId, t.lemma)],
);

export const MEANING_STATUSES = ["pending", "done", "failed"] as const;
export type MeaningStatus = (typeof MEANING_STATUSES)[number];

// 용례. 같은 단어도 문서마다 문맥 뜻이 다를 수 있어 뜻은 여기에 둔다.
export const occurrences = sqliteTable("occurrences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  wordId: integer("word_id")
    .notNull()
    .references(() => words.id, { onDelete: "cascade" }),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  surface: text("surface").notNull(),
  sentence: text("sentence").notNull(),
  meaningKo: text("meaning_ko"),
  meaningStatus: text("meaning_status", { enum: MEANING_STATUSES })
    .notNull()
    .default("pending"),
  createdAt: createdAt(),
});

// 복습 기록. rating은 ts-fsrs Rating 값(1 Again, 2 Hard, 3 Good).
export const reviewLogs = sqliteTable("review_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  wordId: integer("word_id")
    .notNull()
    .references(() => words.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }).notNull(),
  // 응답 전 카드의 일정 상태(JSON). 직전 응답 되돌리기에 쓴다. 이 열이 생기기 전 기록은 null.
  prevCard: text("prev_card"),
});

export const knownWords = sqliteTable(
  "known_words",
  {
    userId: owner(),
    lemma: text("lemma").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lemma] })],
);

export const settings = sqliteTable(
  "settings",
  {
    userId: owner(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

export const USAGE_SOURCES = ["save", "regenerate", "card"] as const;
export type UsageSource = (typeof USAGE_SOURCES)[number];

// 뜻 만들기 요청 한 번(검토 저장, 문서의 다시 만들기, 카드의 다시 만들기)마다 한 줄(C-1).
// 개인 한도는 words로, 전체 상한은 cost_usd로 센다. 요청 전에 예상 비용으로 맡아 두고(settled=false),
// 끝나면 실제 토큰과 비용으로 바꾼다. 사용자를 지워도 비용은 남겨 이번 달 지출이 줄지 않게 한다.
export const meaningUsage = sqliteTable(
  "meaning_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    source: text("source", { enum: USAGE_SOURCES }).notNull(),
    words: integer("words").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: real("cost_usd").notNull(),
    settled: integer("settled", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("meaning_usage_created_at_idx").on(t.createdAt),
    index("meaning_usage_user_id_created_at_idx").on(t.userId, t.createdAt),
  ],
);

// 한 번만 보내는 알림의 기록(예: "budget-80:2026-10"). 서버가 다시 시작해도 다시 보내지 않게 DB에 둔다.
export const alertLog = sqliteTable("alert_log", {
  key: text("key").primaryKey(),
  createdAt: createdAt(),
});

export type DocumentRow = typeof documents.$inferSelect;
export type CandidateRow = typeof candidates.$inferSelect;
export type WordRow = typeof words.$inferSelect;

export * from "./auth-schema";
