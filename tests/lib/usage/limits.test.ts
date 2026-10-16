import { describe, expect, it } from 'vitest';
import { costUsd, kstMonthRange, readUsageLimits, resetsOnLabel } from '@/lib/usage/limits';

describe('kstMonthRange', () => {
  it('starts the month at 00:00 on the 1st in Korea (15:00 UTC the day before)', () => {
    // 한국 시간 11월 1일 00:00 = UTC 10월 31일 15:00
    const justBefore = new Date('2026-10-31T14:59:59.999Z');
    const justAfter = new Date('2026-10-31T15:00:00.000Z');
    expect(kstMonthRange(justBefore)).toEqual({
      start: new Date('2026-09-30T15:00:00.000Z'),
      end: new Date('2026-10-31T15:00:00.000Z'),
      key: '2026-10',
    });
    expect(kstMonthRange(justAfter).key).toBe('2026-11');
    expect(kstMonthRange(justAfter).start).toEqual(justAfter);
  });

  it('rolls over the year in December', () => {
    expect(kstMonthRange(new Date('2026-12-15T00:00:00Z'))).toMatchObject({
      end: new Date('2026-12-31T15:00:00.000Z'),
      key: '2026-12',
    });
  });
});

describe('readUsageLimits', () => {
  it('defaults to 4,000 words and $5 and accepts overrides', () => {
    expect(readUsageLimits({})).toEqual({ monthlyWords: 4000, monthlyBudgetUsd: 5 });
    expect(readUsageLimits({ MONTHLY_WORD_LIMIT: '5', GEMINI_MONTHLY_BUDGET_USD: '0.5' })).toEqual({
      monthlyWords: 5,
      monthlyBudgetUsd: 0.5,
    });
  });

  it('ignores empty, non-numeric or negative values', () => {
    expect(readUsageLimits({ MONTHLY_WORD_LIMIT: '', GEMINI_MONTHLY_BUDGET_USD: 'abc' })).toEqual({
      monthlyWords: 4000,
      monthlyBudgetUsd: 5,
    });
    expect(readUsageLimits({ MONTHLY_WORD_LIMIT: '-1' }).monthlyWords).toBe(4000);
  });
});

describe('costUsd', () => {
  it('prices input at $0.30 and output at $2.50 per million tokens', () => {
    // M4-4 실측 논문 1편 규모
    expect(costUsd({ inputTokens: 11_546, outputTokens: 4_000 })).toBeCloseTo(0.0134638, 7);
  });
});

describe('resetsOnLabel', () => {
  it('names the first day of the next Korean month without a year', () => {
    expect(resetsOnLabel(new Date('2026-10-31T14:59:59Z'))).toBe('11월 1일');
    expect(resetsOnLabel(new Date('2026-10-31T15:00:00Z'))).toBe('12월 1일');
    expect(resetsOnLabel(new Date('2026-12-20T00:00:00Z'))).toBe('1월 1일');
  });
});
