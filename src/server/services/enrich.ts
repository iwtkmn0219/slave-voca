import { mapWithConcurrency } from '@/lib/async/pool';
import { createClaudeMeaningModel } from '@/lib/meaning/claude';
import { generateMeanings, type MeaningModel } from '@/lib/meaning/generate';
import { lookupPhonetic } from '@/lib/phonetic/lookup';
import type { Db } from '../db/client';
import {
  listMeaningRequests,
  listWordsMissingPhonetic,
  markMeaningsFailed,
  markPendingMeaningsFailed,
  setMeanings,
  setPhonetic,
  type SavedCards,
} from '../repo/cards';
import { updateDocumentStatus } from '../repo/documents';

const PHONETIC_CONCURRENCY = 5;

export interface EnrichDeps {
  // null이면 API 키가 없는 것: 뜻은 모두 failed로 둔다.
  meaningModel: MeaningModel | null;
  lookupPhonetic: (word: string) => Promise<string | null>;
}

export function defaultEnrichDeps(): EnrichDeps {
  return {
    meaningModel: process.env.ANTHROPIC_API_KEY ? createClaudeMeaningModel() : null,
    lookupPhonetic: (word) => lookupPhonetic(word),
  };
}

async function fillMeanings(db: Db, occurrenceIds: number[], model: MeaningModel | null) {
  const rows = listMeaningRequests(db, occurrenceIds);
  if (!model) {
    markMeaningsFailed(db, rows.map((r) => r.id));
    return;
  }
  const outcome = await generateMeanings(
    rows.map((r) => ({ id: r.id, word: r.lemma, sentence: r.sentence })),
    model,
  );
  setMeanings(db, outcome.done);
  markMeaningsFailed(db, outcome.failedIds);
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
  documentId: number,
  saved: SavedCards,
  deps: EnrichDeps,
): Promise<void> {
  const results = await Promise.allSettled([
    fillMeanings(db, saved.occurrenceIds, deps.meaningModel),
    fillPhonetics(db, saved.wordIds, deps.lookupPhonetic),
  ]);
  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length === 0) {
    updateDocumentStatus(db, documentId, 'done');
    return;
  }
  for (const f of failures) console.error('뜻·발음 채우기 실패', f.reason);
  markPendingMeaningsFailed(db, saved.occurrenceIds);
  updateDocumentStatus(db, documentId, 'error', ENRICH_FAILED_MESSAGE);
}
