import type { TokenUsage } from '@/lib/meaning/generate';

// Gemini 3.5 Flash-Lite 표준 유료 요금(100만 토큰당 USD). 2026-10-17 공식 요금표
// (ai.google.dev/gemini-api/docs/pricing)에서 확인했다. 출력에는 사고 토큰이 들어간다.
export const INPUT_USD_PER_MTOK = 0.3;
export const OUTPUT_USD_PER_MTOK = 2.5;

// 맡아 둘 때 쓰는 단어당 예상 비용. M4-4 실측(논문 1편 211단어: 입력 약 11,500, 출력 약 4,000토큰)으로는
// 약 $0.000064라 넉넉히 잡는다. 끝나면 실제 비용으로 바뀐다.
export const ESTIMATED_USD_PER_WORD = 0.0001;

export const DEFAULT_MONTHLY_WORD_LIMIT = 4000;
export const DEFAULT_MONTHLY_BUDGET_USD = 5;

export interface UsageLimits {
  monthlyWords: number;
  monthlyBudgetUsd: number;
}

// MONTHLY_WORD_LIMIT, GEMINI_MONTHLY_BUDGET_USD를 읽는다. 비었거나 숫자가 아니거나 음수면 기본값이다.
export function readUsageLimits(env: Readonly<Record<string, string | undefined>> = process.env): UsageLimits {
  const read = (raw: string | undefined, fallback: number) => {
    if (raw === undefined || raw.trim() === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    monthlyWords: Math.floor(read(env.MONTHLY_WORD_LIMIT, DEFAULT_MONTHLY_WORD_LIMIT)),
    monthlyBudgetUsd: read(env.GEMINI_MONTHLY_BUDGET_USD, DEFAULT_MONTHLY_BUDGET_USD),
  };
}

export function costUsd(usage: TokenUsage): number {
  return (usage.inputTokens * INPUT_USD_PER_MTOK + usage.outputTokens * OUTPUT_USD_PER_MTOK) / 1_000_000;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 한국 시간 기준 그 달의 1일 0시(UTC 시각으로)와 다음 달 1일 0시. 한국은 서머타임이 없다.
export function kstMonthRange(now: Date): { start: Date; end: Date; key: string } {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1) - KST_OFFSET_MS),
    end: new Date(Date.UTC(y, m + 1, 1) - KST_OFFSET_MS),
    key: `${y}-${String(m + 1).padStart(2, '0')}`,
  };
}

// 한도가 다시 채워지는 날(한국 시간 다음 달 1일)을 화면 문구용으로. 예: "11월 1일". 연도는 붙이지 않는다.
export function resetsOnLabel(now: Date): string {
  const kstEnd = new Date(kstMonthRange(now).end.getTime() + KST_OFFSET_MS);
  return `${kstEnd.getUTCMonth() + 1}월 1일`;
}
