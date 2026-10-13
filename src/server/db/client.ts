import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle');

// 배포로 옮길 때 바꾸는 곳은 이 파일과 스키마의 방언뿐이다.
export function createDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

const globalForDb = globalThis as { slaveVocaDb?: Db };

export function getDb(): Db {
  globalForDb.slaveVocaDb ??= createDb(
    process.env.SLAVE_VOCA_DB ?? path.join(process.cwd(), 'data', 'app.db'),
  );
  return globalForDb.slaveVocaDb;
}
