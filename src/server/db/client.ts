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
  const db = drizzle({ client: sqlite, schema });
  // 마이그레이션은 외래 키를 끈 채 돌린다. 마이그레이션은 한 트랜잭션이라 그 안의 PRAGMA foreign_keys=OFF는
  // 효과가 없고, 켜진 채 표를 새로 만들면(0006) DROP TABLE이 연결된 행까지 지운다. 끝난 뒤 깨진 연결이 없는지 본다.
  sqlite.pragma('foreign_keys = OFF');
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  const broken = sqlite.pragma('foreign_key_check') as unknown[];
  if (broken.length > 0) throw new Error(`마이그레이션 뒤 외래 키가 깨졌습니다: ${JSON.stringify(broken.slice(0, 5))}`);
  sqlite.pragma('foreign_keys = ON');
  return db;
}

const globalForDb = globalThis as { slaveVocaDb?: Db };

export function getDb(): Db {
  globalForDb.slaveVocaDb ??= createDb(
    process.env.SLAVE_VOCA_DB ?? path.join(process.cwd(), 'data', 'app.db'),
  );
  return globalForDb.slaveVocaDb;
}
