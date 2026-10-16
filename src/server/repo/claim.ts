import { and, count, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { documents, knownWords, settings, users, words } from '../db/schema';

// M6-2 마이그레이션이 기존 데이터를 묶어 둔 임시 소유자(0006_per_user.sql).
export const LEGACY_OWNER = 'legacy-owner';

export class ClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaimError';
  }
}

export interface ClaimResult {
  documents: number;
  words: number;
  knownWords: number;
  settings: number;
}

// 임시 소유자의 데이터를 그 이메일의 계정으로 옮기고 임시 소유자를 지운다. 계정은 먼저 로그인해서 만들어 둬야 하고,
// 같은 단어 카드가 겹치지 않도록 아직 데이터가 없어야 한다. 한 트랜잭션이라 실패하면 아무것도 바뀌지 않는다.
export function claimLegacyData(db: Db, email: string): ClaimResult {
  return db.transaction((tx) => {
    const legacy = tx.select({ id: users.id }).from(users).where(eq(users.id, LEGACY_OWNER)).get();
    if (!legacy) throw new ClaimError('넘길 이전 데이터가 없습니다.');
    const target = tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .get();
    if (!target) throw new ClaimError(`${email} 계정이 없습니다. 먼저 그 계정으로 로그인하세요.`);
    const owned = (table: typeof documents | typeof words | typeof knownWords | typeof settings) =>
      tx.select({ n: count() }).from(table).where(eq(table.userId, target.id)).get()?.n ?? 0;
    if (owned(documents) + owned(words) + owned(knownWords) + owned(settings) > 0) {
      throw new ClaimError(`${email} 계정에 이미 데이터가 있어 합칠 수 없습니다.`);
    }
    const move = (table: typeof documents | typeof words | typeof knownWords | typeof settings) =>
      tx.update(table).set({ userId: target.id }).where(eq(table.userId, LEGACY_OWNER)).run().changes;
    const result = {
      documents: move(documents),
      words: move(words),
      knownWords: move(knownWords),
      settings: move(settings),
    };
    tx.delete(users).where(and(eq(users.id, LEGACY_OWNER))).run();
    return result;
  });
}
