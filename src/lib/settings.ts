// 설정 화면 입력 검사. 서버 Action과 테스트가 쓴다(설계서 M4-2 3장).
export const EXCLUDE_TOP_N_RANGE = { min: 1000, max: 20000 } as const; // 위 한계는 빈도 목록 길이(20,349단어)에 맞춘다
export const DAILY_NEW_LIMIT_RANGE = { min: 0, max: 200 } as const; // 0이면 새 카드 없이 복습만

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = 'theme';

export interface SettingsInput {
  excludeTopN: number;
  dailyNewLimit: number;
  autoSpeak: boolean;
  theme: Theme;
}

export type SettingsField = 'excludeTopN' | 'dailyNewLimit';
export type SettingsErrors = Partial<Record<SettingsField, string>>;

const rangeMessage = (r: { min: number; max: number }) =>
  `${r.min.toLocaleString('en-US')}에서 ${r.max.toLocaleString('en-US')} 사이의 정수를 넣어 주세요.`;

function parseInteger(value: unknown, range: { min: number; max: number }): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return Number.isSafeInteger(n) && n >= range.min && n <= range.max ? n : null;
}

export const isTheme = (v: unknown): v is Theme =>
  typeof v === 'string' && (THEMES as readonly string[]).includes(v);

// 숫자 칸은 입력 문자열 그대로 받는다. 하나라도 틀리면 값 없이 항목별 오류를 돌려준다.
// autoSpeak·theme가 형태부터 틀리면(화면이 보낼 수 없는 값) null: 잘못된 요청이다.
export function parseSettingsInput(
  v: unknown,
): { ok: true; value: SettingsInput } | { ok: false; errors: SettingsErrors } | null {
  if (typeof v !== 'object' || v === null) return null;
  const input = v as Record<string, unknown>;
  if (typeof input.autoSpeak !== 'boolean' || !isTheme(input.theme)) return null;
  const excludeTopN = parseInteger(input.excludeTopN, EXCLUDE_TOP_N_RANGE);
  const dailyNewLimit = parseInteger(input.dailyNewLimit, DAILY_NEW_LIMIT_RANGE);
  const errors: SettingsErrors = {};
  if (excludeTopN === null) errors.excludeTopN = rangeMessage(EXCLUDE_TOP_N_RANGE);
  if (dailyNewLimit === null) errors.dailyNewLimit = rangeMessage(DAILY_NEW_LIMIT_RANGE);
  if (excludeTopN === null || dailyNewLimit === null) return { ok: false, errors };
  return { ok: true, value: { excludeTopN, dailyNewLimit, autoSpeak: input.autoSpeak, theme: input.theme } };
}
