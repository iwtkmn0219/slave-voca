export interface MeaningRequest {
  id: number;
  word: string;
  sentence: string;
}

export interface MeaningResult {
  id: number;
  meaningKo: string;
}

// 단어 묶음 하나를 받아 문맥 뜻을 돌려주는 모델. 실제 구현은 claude.ts, 테스트는 가짜를 쓴다.
export type MeaningModel = (batch: MeaningRequest[]) => Promise<MeaningResult[]>;

export const MEANING_BATCH_SIZE = 50;

export interface GenerateOutcome {
  done: MeaningResult[];
  failedIds: number[];
}

// 50개씩 나눠 요청한다. 응답에 빠졌거나 빈 뜻, 실패한 묶음은 failedIds로 돌려준다.
export async function generateMeanings(
  requests: MeaningRequest[],
  model: MeaningModel,
): Promise<GenerateOutcome> {
  const outcome: GenerateOutcome = { done: [], failedIds: [] };
  for (let i = 0; i < requests.length; i += MEANING_BATCH_SIZE) {
    const batch = requests.slice(i, i + MEANING_BATCH_SIZE);
    const ids = new Set(batch.map((r) => r.id));
    let results: MeaningResult[] = [];
    try {
      results = await model(batch);
    } catch (err) {
      console.error('문맥 뜻 생성 실패', err);
    }
    const answered = new Map<number, string>();
    for (const r of results) {
      const meaning = r.meaningKo.trim();
      if (ids.has(r.id) && meaning.length > 0 && !answered.has(r.id)) answered.set(r.id, meaning);
    }
    for (const req of batch) {
      const meaning = answered.get(req.id);
      if (meaning === undefined) outcome.failedIds.push(req.id);
      else outcome.done.push({ id: req.id, meaningKo: meaning });
    }
  }
  return outcome;
}
