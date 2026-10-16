import type { Db } from '../db/client';
import { ReviewError, saveReviewSelection } from '../repo/cards';
import { enrichDocument, type EnrichDeps } from './enrich';
import { reportUsageLimit, reserveMeaningUsage, UsageLimitError, type UsageMeter } from './meaning-usage';

// limitResetsOn이 있으면 한도에 걸린 것이다(화면이 다른 실패와 구별해 보인다).
export type SaveReviewResult = { error: string | null; limitResetsOn?: string };

// 검토 저장(C-1): 카드 저장과 사용량 맡아 두기를 한 트랜잭션에서 한다. 한도에 걸리면 저장도 되돌려
// 카드·용례·아는 단어가 하나도 바뀌지 않는다. 키가 없으면(뜻을 만들지 않으므로) 한도를 보지 않는다.
export async function saveReviewAndEnrich(
  db: Db,
  userId: string,
  documentId: number,
  selectedCandidateIds: readonly number[],
  deps: EnrichDeps,
): Promise<SaveReviewResult> {
  let saved;
  let meter: UsageMeter | null = null;
  try {
    saved = db.transaction(() => {
      const s = saveReviewSelection(db, userId, documentId, selectedCandidateIds);
      if (deps.meaningModel && s.occurrenceIds.length > 0) {
        meter = reserveMeaningUsage(db, userId, 'save', s.occurrenceIds.length);
      }
      return s;
    });
  } catch (err) {
    if (err instanceof ReviewError) return { error: err.message };
    if (err instanceof UsageLimitError) {
      reportUsageLimit(db, userId, err);
      return { error: err.message, limitResetsOn: err.resetsOn };
    }
    throw err;
  }
  await enrichDocument(db, userId, documentId, saved, deps, meter);
  return { error: null };
}
