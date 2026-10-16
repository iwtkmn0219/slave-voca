import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addUser } from '../helpers/users';
import { createDb, type Db } from '@/server/db/client';
import { documents, knownWords, occurrences, reviewLogs, settings, users, words } from '@/server/db/schema';
import { ClaimError, claimLegacyData, LEGACY_OWNER } from '@/server/repo/claim';

// 0006_per_user가 기존 데이터를 하나도 잃지 않고 임시 소유자에게 묶는지, db:claim이 내 계정으로 옮기는지 본다.
// 0005까지만 적용한 DB에 옛 모양의 행을 넣고, createDb로 나머지 마이그레이션을 돌린다.

let dir: string;
let file: string;
const opened: Db[] = [];
// 열어 둔 DB는 닫아야 Windows에서 임시 폴더를 지울 수 있다.
const open = (f: string) => {
  const db = createDb(f);
  opened.push(db);
  return db;
};

function migrateUpTo0005(target: string) {
  const folder = path.join(dir, 'drizzle');
  fs.cpSync(path.join(process.cwd(), 'drizzle'), folder, { recursive: true });
  const journalPath = path.join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] };
  // 0006부터 뒤는 모두 뺀다. 뒤 마이그레이션(0007 등)이 먼저 적용되면 drizzle은 그보다 오래된 0006을 건너뛴다.
  journal.entries = journal.entries.filter((e) => Number(e.tag.slice(0, 4)) < 6);
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  const sqlite = new Database(target);
  migrate(drizzle({ client: sqlite }), { migrationsFolder: folder });
  return sqlite;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slave-voca-mig-'));
  file = path.join(dir, 'app.db');
});

afterEach(() => {
  for (const db of opened.splice(0)) (db as unknown as { $client: Database.Database }).$client.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function seedOldData() {
  const sqlite = migrateUpTo0005(file);
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    INSERT INTO documents (id, title, kind, status, created_at) VALUES (1, 'Paper', 'paper', 'done', 1);
    INSERT INTO words (id, lemma, created_at, state, reps) VALUES (1, 'robust', 1, 2, 3), (2, 'paradigm', 1, 0, 0);
    INSERT INTO occurrences (id, word_id, document_id, surface, sentence, meaning_ko, meaning_status, created_at)
      VALUES (1, 1, 1, 'robust', 'A robust model.', '강건한', 'done', 1), (2, 2, 1, 'paradigm', 'A paradigm.', NULL, 'failed', 1);
    INSERT INTO review_logs (word_id, rating, reviewed_at) VALUES (1, 3, 1);
    INSERT INTO known_words (lemma, created_at) VALUES ('paper', 1);
    INSERT INTO settings (key, value) VALUES ('daily_new_limit', '7');
  `);
  sqlite.close();
}

describe('0006_per_user migration', () => {
  it('keeps every row and gives them to the legacy owner', () => {
    seedOldData();
    const db = open(file);
    expect(db.select().from(occurrences).all()).toHaveLength(2);
    expect(db.select().from(reviewLogs).all()).toHaveLength(1);
    expect(db.select({ u: words.userId, l: words.lemma, reps: words.reps }).from(words).all()).toEqual([
      { u: LEGACY_OWNER, l: 'robust', reps: 3 },
      { u: LEGACY_OWNER, l: 'paradigm', reps: 0 },
    ]);
    expect(db.select({ u: documents.userId }).from(documents).all()).toEqual([{ u: LEGACY_OWNER }]);
    expect(db.select({ u: knownWords.userId }).from(knownWords).all()).toEqual([{ u: LEGACY_OWNER }]);
    expect(db.select({ u: settings.userId, v: settings.value }).from(settings).all()).toEqual([{ u: LEGACY_OWNER, v: '7' }]);
    expect(db.select({ id: users.id, status: users.status }).from(users).all()).toEqual([
      { id: LEGACY_OWNER, status: 'blocked' },
    ]);
  });

  it('does not create the legacy owner for an empty database', () => {
    const db = open(file);
    expect(db.select().from(users).all()).toEqual([]);
  });
});

describe('claimLegacyData', () => {
  let db: Db;
  beforeEach(() => {
    seedOldData();
    db = open(file);
    db.insert(users).values({ id: 'me', name: 'Me', email: 'me@example.com', status: 'approved', role: 'admin' }).run();
  });

  it('moves everything to the account and removes the legacy owner', () => {
    expect(claimLegacyData(db, ' Me@Example.com ')).toEqual({ documents: 1, words: 2, knownWords: 1, settings: 1 });
    expect(new Set(db.select({ u: words.userId }).from(words).all().map((r) => r.u))).toEqual(new Set(['me']));
    expect(db.select({ id: users.id }).from(users).all()).toEqual([{ id: 'me' }]);
    expect(db.select().from(occurrences).all()).toHaveLength(2);
    expect(() => claimLegacyData(db, 'me@example.com')).toThrow('넘길 이전 데이터가 없습니다.');
  });

  it('refuses an unknown email or an account that already has data, changing nothing', () => {
    expect(() => claimLegacyData(db, 'nobody@example.com')).toThrow(ClaimError);
    addUser(db, 'busy');
    db.insert(knownWords).values({ userId: 'busy', lemma: 'x' }).run();
    expect(() => claimLegacyData(db, 'busy@example.com')).toThrow('이미 데이터가 있어');
    expect(db.select({ u: words.userId }).from(words).all().every((r) => r.u === LEGACY_OWNER)).toBe(true);
  });
});
