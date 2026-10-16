import { mapWithConcurrency } from '@/lib/async/pool';
import { createGeminiMeaningModel } from '@/lib/meaning/gemini';
import { generateMeanings, type MeaningModel } from '@/lib/meaning/generate';
import { createCmudictPhonetic } from '@/lib/phonetic/cmudict';
import type { Db } from '../db/client';
import {
  listMeaningRequests,
  listWordsMissingPhonetic,
  markMeaningsFailed,
  markMeaningsFailedUnlessDone,
  markPendingMeaningsFailed,
  setMeanings,
  setPhonetic,
  type MeaningRequestRow,
  type SavedCards,
} from '../repo/cards';
import { updateDocumentStatus } from '../repo/documents';
import { notifyServerError } from '../alerts/notify';
import { reportUsageLimit, reserveMeaningUsage, UsageLimitError, type UsageMeter } from './meaning-usage';

const PHONETIC_CONCURRENCY = 5;

export interface EnrichDeps {
  // null이면 API 키가 없는 것: 뜻은 모두 failed로 둔다.
  meaningModel: MeaningModel | null;
  lookupPhonetic: (word: string) => Promise<string | null>;
}

// 키가 없으면 null: 뜻을 만들 수 없다는 뜻이다.
export function defaultMeaningModel(): MeaningModel | null {
  return process.env.GEMINI_API_KEY ? createGeminiMeaningModel() : null;
}

export function defaultEnrichDeps(): EnrichDeps {
  return {
    meaningModel: defaultMeaningModel(),
    // 발음기호는 CMUdict에서만 찾는다(네트워크 없음).
    lookupPhonetic: createCmudictPhonetic(),
  };
}

// 용례들의 뜻을 만들어 저장한다. 성공은 done, 실패는 failed. 저장 직후 채우기와 다시 만들기가 함께 쓴다.
// 이미 뜻이 있던 용례(done)는 새로 만들다 실패해도 원래 뜻을 그대로 둔다.
// meter가 있으면 모델 응답의 토큰을 거기에 모은다(정산은 부른 쪽이 한다).
async function generateAndStore(db: Db, rows: MeaningRequestRow[], model: MeaningModel, meter: UsageMeter | null) {
  const hadMeaning = new Set(rows.filter((r) => r.meaningStatus === 'done').map((r) => r.id));
  const outcome = await generateMeanings(
    rows.map((r) => ({ id: r.id, word: r.lemma, sentence: r.sentence })),
    model,
    { onUsage: meter?.onUsage },
  );
  setMeanings(db, outcome.done);
  // 이미 뜻이 있던 용례는 그대로 두고, 그 사이 다른 요청이 done으로 만든 용례도 failed로 덮지 않는다.
  markMeaningsFailedUnlessDone(db, outcome.failedIds.filter((id) => !hadMeaning.has(id)));
  return { done: outcome.done.length, failed: outcome.failedIds.length };
}

async function fillMeanings(
  db: Db,
  userId: string,
  occurrenceIds: number[],
  model: MeaningModel | null,
  meter: UsageMeter | null,
) {
  const rows = listMeaningRequests(db, userId, occurrenceIds);
  if (!model) {
    markMeaningsFailed(db, rows.map((r) => r.id));
    return;
  }
  try {
    await generateAndStore(db, rows, model, meter);
  } finally {
    meter?.finish();
  }
}

export type RegenerateResult =
  | { error: 'missing-key' }
  | { error: 'usage-limit'; resetsOn: string }
  | { error: null; done: number; failed: number };

// 뜻 다시 만들기: 실패한 뜻을 채우거나, 이상한 뜻을 새로 받는다(단어 하나 또는 여러 개).
// 키가 없으면 아무것도 바꾸지 않고 알린다.
// 그 사용자의 용례만 다시 만든다(남의 id는 listMeaningRequests에서 빠진다).
// 한도에 걸리면 아무것도 바꾸지 않고 usage-limit을 돌려준다(C-1).
export async function regenerateMeanings(
  db: Db,
  userId: string,
  occurrenceIds: readonly number[],
  model: MeaningModel | null,
  source: 'regenerate' | 'card' = 'regenerate',
): Promise<RegenerateResult> {
  if (!model) return { error: 'missing-key' };
  const rows = listMeaningRequests(db, userId, occurrenceIds);
  if (rows.length === 0) return { error: null, done: 0, failed: 0 };
  let meter: UsageMeter;
  try {
    meter = reserveMeaningUsage(db, userId, source, rows.length);
  } catch (err) {
    if (!(err instanceof UsageLimitError)) throw err;
    reportUsageLimit(db, userId, err);
    return { error: 'usage-limit', resetsOn: err.resetsOn };
  }
  try {
    return { error: null, ...(await generateAndStore(db, rows, model, meter)) };
  } finally {
    meter.finish();
  }
}

async function fillPhonetics(db: Db, wordIds: number[], lookup: EnrichDeps['lookupPhonetic']) {
  const missing = listWordsMissingPhonetic(db, wordIds);
  await mapWithConcurrency(missing, PHONETIC_CONCURRENCY, async (word) => {
    const phonetic = await lookup(word.lemma);
    if (phonetic) setPhonetic(db, word.id, phonetic);
  });
}

const ENRICH_FAILED_MESSAGE = '뜻과 발음을 채우지 못했습니다.';

// 저장 직후 문맥 뜻과 발음기호를 채우고 문서를 완료로 바꾼다. 개별 실패는 용례 상태로 남긴다.
// 예상하지 못한 예외가 나도 문서가 processing에 멈추지 않게 error로 끝내고, 남은 뜻은 failed로 둔다.
export async function enrichDocument(
  db: Db,
  userId: string,
  documentId: number,
  saved: SavedCards,
  deps: EnrichDeps,
  meter: UsageMeter | null = null,
): Promise<void> {
  const results = await Promise.allSettled([
    fillMeanings(db, userId, saved.occurrenceIds, deps.meaningModel, meter),
    fillPhonetics(db, saved.wordIds, deps.lookupPhonetic),
  ]);
  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length === 0) {
    updateDocumentStatus(db, documentId, 'done');
    return;
  }
  for (const f of failures) {
    console.error('뜻·발음 채우기 실패', f.reason);
    void notifyServerError('뜻·발음 채우기', f.reason);
  }
  markPendingMeaningsFailed(db, saved.occurrenceIds);
  updateDocumentStatus(db, documentId, 'error', ENRICH_FAILED_MESSAGE);
}
