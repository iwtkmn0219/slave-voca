import { and, eq, gte, lt, sql } from 'drizzle-orm';
import type { TokenUsage } from '@/lib/meaning/generate';
import { costUsd, ESTIMATED_USD_PER_WORD, kstMonthRange, type UsageLimits } from '@/lib/usage/limits';
import type { Db } from '../db/client';
import { alertLog, meaningUsage, type UsageSource } from '../db/schema';

export type ReserveResult = { ok: true; id: number } | { ok: false; reason: 'user-limit' | 'budget' };

function monthFilter(now: Date) {
  const { start, end } = kstMonthRange(now);
  return and(gte(meaningUsage.createdAt, start), lt(meaningUsage.createdAt, end));
}

// 이번 달(한국 시간) 사용자가 요청한 단어 수.
export function monthlyWordsOf(db: Db, userId: string, now: Date): number {
  const row = db
    .select({ n: sql<number>`coalesce(sum(${meaningUsage.words}), 0)` })
    .from(meaningUsage)
    .where(and(eq(meaningUsage.userId, userId), monthFilter(now)))
    .get();
  return row?.n ?? 0;
}

// 이번 달 전체 비용. 끝나지 않은 요청은 예상 비용으로 들어 있다.
export function monthlySpendUsd(db: Db, now: Date): number {
  const row = db
    .select({ usd: sql<number>`coalesce(sum(${meaningUsage.costUsd}), 0)` })
    .from(meaningUsage)
    .where(monthFilter(now))
    .get();
  return row?.usd ?? 0;
}

// 관리 화면용: 이번 달 사용자별 단어 수. 지워진 사용자(user_id NULL)는 빠진다.
export function monthlyWordsByUser(db: Db, now: Date): Map<string, number> {
  const rows = db
    .select({ userId: meaningUsage.userId, n: sql<number>`sum(${meaningUsage.words})` })
    .from(meaningUsage)
    .where(monthFilter(now))
    .groupBy(meaningUsage.userId)
    .all();
  return new Map(rows.filter((r) => r.userId !== null).map((r) => [r.userId as string, r.n]));
}

// 한도를 확인하고, 통과하면 예상 비용으로 한 줄을 맡아 둔다. 확인과 기록이 한 트랜잭션이라
// 동시에 들어온 다른 요청은 이 줄까지 센 뒤에 판단한다.
export function reserveUsage(
  db: Db,
  userId: string,
  source: UsageSource,
  words: number,
  now: Date,
  limits: UsageLimits,
): ReserveResult {
  return db.transaction(() => {
    if (monthlyWordsOf(db, userId, now) + words > limits.monthlyWords) return { ok: false, reason: 'user-limit' };
    if (monthlySpendUsd(db, now) + words * ESTIMATED_USD_PER_WORD > limits.monthlyBudgetUsd) {
      return { ok: false, reason: 'budget' };
    }
    const row = db
      .insert(meaningUsage)
      .values({ userId, source, words, costUsd: words * ESTIMATED_USD_PER_WORD, createdAt: now })
      .returning({ id: meaningUsage.id })
      .get();
    return { ok: true, id: row.id };
  });
}

// 맡아 둔 줄을 실제 토큰과 비용으로 바꾼다.
export function settleUsage(db: Db, id: number, usage: TokenUsage): void {
  db.update(meaningUsage)
    .set({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUsd: costUsd(usage), settled: true })
    .where(eq(meaningUsage.id, id))
    .run();
}

// key로 처음 부르면 true, 그 뒤로는 false. "한 달에 한 번" 알림에 쓴다.
export function claimAlert(db: Db, key: string): boolean {
  return db.insert(alertLog).values({ key }).onConflictDoNothing().run().changes > 0;
}
