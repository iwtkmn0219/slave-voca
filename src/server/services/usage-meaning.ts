import { LIMIT_SLOT, MISSING_KEY_MESSAGE } from '@/lib/regen-messages';
import type { MeaningModel } from '@/lib/meaning/generate';
import { isId } from '@/lib/validate';
import type { Db } from '../db/client';
import { getOccurrenceMeaning } from '../repo/cards';
import { regenerateMeanings } from './enrich';

// limitResetsOn이 있으면 한도에 걸린 것이다.
export type RegenerateUsageResult =
  | { error: string; limitResetsOn?: string }
  | { error: null; meaningKo: string | null; meaningStatus: 'pending' | 'done' | 'failed'; failed: boolean };

// 카드 뒷면의 "다시 만들기": 용례 하나의 뜻을 새로 받는다. 실패하면 원래 뜻이 그대로 남고 failed가 true다.
// 입력은 브라우저가 보낸 값이므로 unknown으로 받아 형태부터 확인한다.
export async function regenerateUsageMeaning(
  db: Db,
  userId: string,
  occurrenceId: unknown,
  model: MeaningModel | null,
): Promise<RegenerateUsageResult> {
  if (!isId(occurrenceId)) return { error: '잘못된 요청입니다.' };
  if (!getOccurrenceMeaning(db, userId, occurrenceId)) return { error: '용례를 찾을 수 없습니다.' };
  const result = await regenerateMeanings(db, userId, [occurrenceId], model, 'card');
  if (result.error === 'missing-key') return { error: MISSING_KEY_MESSAGE };
  if (result.error === 'usage-limit') return { error: LIMIT_SLOT, limitResetsOn: result.resetsOn };
  const meaning = getOccurrenceMeaning(db, userId, occurrenceId);
  if (!meaning) return { error: '용례를 찾을 수 없습니다.' }; // 그 사이 카드가 지워졌다
  return { error: null, ...meaning, failed: result.failed > 0 };
}
