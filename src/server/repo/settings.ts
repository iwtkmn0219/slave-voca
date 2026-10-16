import { DAILY_NEW_LIMIT_RANGE, EXCLUDE_TOP_N_RANGE } from '@/lib/settings';
import type { Db } from '../db/client';
import { settings } from '../db/schema';

// DB에 두는 설정. 화면 테마는 첫 화면이 번쩍이지 않도록 쿠키에 둔다(설정 화면 Action이 함께 저장).
export interface Settings {
  excludeTopN: number;
  dailyNewLimit: number;
  autoSpeak: boolean;
}

export const DEFAULT_SETTINGS: Settings = { excludeTopN: 3000, dailyNewLimit: 20, autoSpeak: false };

const KEYS: Record<keyof Settings, string> = {
  excludeTopN: 'exclude_top_n',
  dailyNewLimit: 'daily_new_limit',
  autoSpeak: 'auto_speak',
};

// 없거나 범위 밖인 값은 처음 값으로 읽는다.
export function getSettings(db: Db): Settings {
  const stored = new Map(db.select().from(settings).all().map((r) => [r.key, r.value]));
  const readInt = (key: 'excludeTopN' | 'dailyNewLimit', range: { min: number; max: number }) => {
    const raw = stored.get(KEYS[key]);
    // 숫자만 받는다. Number('')는 0이라, 빈 값이 하루 새 카드 0으로 읽히지 않게 한다.
    const value = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : NaN;
    return Number.isInteger(value) && value >= range.min && value <= range.max ? value : DEFAULT_SETTINGS[key];
  };
  const speak = stored.get(KEYS.autoSpeak);
  return {
    excludeTopN: readInt('excludeTopN', EXCLUDE_TOP_N_RANGE),
    dailyNewLimit: readInt('dailyNewLimit', DAILY_NEW_LIMIT_RANGE),
    autoSpeak: speak === 'true' ? true : speak === 'false' ? false : DEFAULT_SETTINGS.autoSpeak,
  };
}

// 검사를 마친 값만 받는다(lib/settings의 parseSettingsInput). 한 트랜잭션에서 모두 쓴다.
export function saveSettings(db: Db, value: Settings): void {
  db.transaction((tx) => {
    for (const key of Object.keys(KEYS) as (keyof Settings)[]) {
      const row = { key: KEYS[key], value: String(value[key]) };
      tx.insert(settings).values(row).onConflictDoUpdate({ target: settings.key, set: { value: row.value } }).run();
    }
  });
}
