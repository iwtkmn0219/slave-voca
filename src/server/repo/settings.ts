import type { Db } from '../db/client';
import { settings } from '../db/schema';

export interface Settings {
  excludeTopN: number;
  dailyNewLimit: number;
}

export const DEFAULT_SETTINGS: Settings = { excludeTopN: 5000, dailyNewLimit: 20 };

const KEYS: Record<keyof Settings, string> = {
  excludeTopN: 'exclude_top_n',
  dailyNewLimit: 'daily_new_limit',
};

export function getSettings(db: Db): Settings {
  const stored = new Map(db.select().from(settings).all().map((r) => [r.key, r.value]));
  const read = (key: keyof Settings) => {
    const value = Number(stored.get(KEYS[key]));
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_SETTINGS[key];
  };
  return { excludeTopN: read('excludeTopN'), dailyNewLimit: read('dailyNewLimit') };
}
