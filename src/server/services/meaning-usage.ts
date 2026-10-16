import { eq } from 'drizzle-orm';
import type { TokenUsage } from '@/lib/meaning/generate';
import { LIMIT_SLOT } from '@/lib/regen-messages';
import { kstMonthRange, readUsageLimits, resetsOnLabel, type UsageLimits } from '@/lib/usage/limits';
import { notify } from '../alerts/notify';
import type { Db } from '../db/client';
import { users, type UsageSource } from '../db/schema';
import { claimAlert, monthlySpendUsd, reserveUsage, settleUsage } from '../repo/usage';

// 개인 한도 또는 전체 상한에 걸려 뜻을 만들지 않았다. 사용자에게는 둘을 구분하지 않고 알린다.
// resetsOn: 다시 쓸 수 있는 날("11월 1일").
export class UsageLimitError extends Error {
  constructor(
    readonly reason: 'user-limit' | 'budget',
    readonly resetsOn: string,
  ) {
    super(LIMIT_SLOT);
    this.name = 'UsageLimitError';
  }
}

// 맡아 둔 요청 하나. onUsage로 토큰을 모으고 finish로 실제 비용을 기록한다.
export interface UsageMeter {
  onUsage: (usage: TokenUsage) => void;
  finish: () => void;
}

export interface UsageContext {
  now?: Date;
  limits?: UsageLimits;
}

// 한도를 확인하고 맡아 둔다. 걸리면 UsageLimitError를 던진다(아무것도 기록하지 않는다).
// 트랜잭션 안에서 불러도 된다: 바깥 트랜잭션이 되돌려지면 맡아 둔 줄도 함께 사라진다.
export function reserveMeaningUsage(
  db: Db,
  userId: string,
  source: UsageSource,
  words: number,
  { now = new Date(), limits = readUsageLimits() }: UsageContext = {},
): UsageMeter {
  const result = reserveUsage(db, userId, source, words, now, limits);
  if (!result.ok) throw new UsageLimitError(result.reason, resetsOnLabel(now));
  const total: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  let finished = false;
  return {
    onUsage: (u) => {
      total.inputTokens += u.inputTokens;
      total.outputTokens += u.outputTokens;
    },
    finish: () => {
      if (finished) return;
      finished = true;
      settleUsage(db, result.id, total);
      alertBudgetThresholds(db, now, limits);
    },
  };
}

const BUDGET_THRESHOLDS = [0.8, 1] as const;

// 이번 달 비용이 상한의 80%, 100%에 닿으면 각각 한 달에 한 번 알린다.
function alertBudgetThresholds(db: Db, now: Date, limits: UsageLimits) {
  const spent = monthlySpendUsd(db, now);
  const { key } = kstMonthRange(now);
  for (const t of BUDGET_THRESHOLDS) {
    if (spent >= limits.monthlyBudgetUsd * t && claimAlert(db, `budget-${t * 100}:${key}`)) {
      void notify(`Gemini 이번 달 비용이 상한의 ${t * 100}%에 닿았습니다: $${spent.toFixed(2)} / $${limits.monthlyBudgetUsd.toFixed(2)}`);
    }
  }
}

// 한도에 걸렸을 때 관리자에게 알린다. 개인 한도는 사용자마다 한 달에 한 번, 전체 상한은 한 달에 한 번.
// 트랜잭션 밖에서 부른다(되돌려지면 "보냈음" 기록도 사라지므로).
export function reportUsageLimit(db: Db, userId: string, err: UsageLimitError, { now = new Date(), limits = readUsageLimits() }: UsageContext = {}) {
  const { key } = kstMonthRange(now);
  if (err.reason === 'budget') {
    if (claimAlert(db, `budget-blocked:${key}`)) {
      void notify(`Gemini 이번 달 상한($${limits.monthlyBudgetUsd.toFixed(2)})에 닿아 뜻 만들기를 막았습니다.`);
    }
    return;
  }
  if (!claimAlert(db, `user-limit:${userId}:${key}`)) return;
  const user = db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).get();
  void notify(`${user?.name ?? userId} (${user?.email ?? '-'}) 님이 이번 달 한도(${limits.monthlyWords}단어)에 닿았습니다.`);
}
