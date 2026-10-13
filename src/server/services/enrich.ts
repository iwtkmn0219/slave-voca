import { mapWithConcurrency } from '@/lib/async/pool';
import { createClaudeMeaningModel } from '@/lib/meaning/claude';
import { generateMeanings, type MeaningModel } from '@/lib/meaning/generate';
import { lookupPhonetic } from '@/lib/phonetic/lookup';
import type { Db } from '../db/client';
import {
  listMeaningRequests,
  listWordsMissingPhonetic,
  markMeaningsFailed,
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

// 저장 직후 문맥 뜻과 발음기호를 채우고 문서를 완료로 바꾼다. 개별 실패는 용례 상태로 남긴다.
export async function enrichDocument(
  db: Db,
  documentId: number,
  saved: SavedCards,
  deps: EnrichDeps,
): Promise<void> {
  await Promise.all([
    fillMeanings(db, saved.occurrenceIds, deps.meaningModel),
    fillPhonetics(db, saved.wordIds, deps.lookupPhonetic),
  ]);
  updateDocumentStatus(db, documentId, 'done');
}
