import { mapWithConcurrency } from '@/lib/async/pool';

export interface MeaningRequest {
  id: number;
  word: string;
  sentence: string;
}

export interface MeaningResult {
  id: number;
  meaningKo: string;
}

// 모델 응답 하나가 쓴 토큰. 출력에는 사고 토큰이 들어간다(과금 기준과 같다).
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// 단어 묶음 하나를 받아 문맥 뜻을 돌려주는 모델. 실제 구현은 gemini.ts, 테스트는 가짜를 쓴다.
// onUsage: 응답을 받을 때마다(형식이 틀려 예외로 끝나는 응답도) 쓴 토큰을 알린다. 비용 기록(C-1)이 쓴다.
export type MeaningModel = (batch: MeaningRequest[], onUsage?: (usage: TokenUsage) => void) => Promise<MeaningResult[]>;

// 2026-10-16 실측(M4-4): 200개 묶음보다 50개 묶음이 문맥 오답이 적었다. 묶음은 동시에 보내
// 논문 한 편(후보 약 200개, 묶음 4~5개)이 한 번에 나간다. 큰 문서는 5개씩 나눠 보낸다.
export const MEANING_BATCH_SIZE = 50;
export const MEANING_CONCURRENCY = 5;

export interface GenerateOutcome {
  done: MeaningResult[];
  failedIds: number[];
}

// 일시적인 오류만 다시 시도한다: 429(요청 한도), 5xx(서버 과부하 등), 상태 없는 네트워크 오류.
// 400·401·403·404처럼 키·요청·모델이 틀린 오류와, 응답 형식 오류(JSON·스키마·차단)는 다시 보내도 같으므로 제외한다.
// 상태 코드는 @google/genai ApiError.status를 이름으로 읽어 이 모듈이 SDK에 묶이지 않게 한다.
// 예외: GarbledOutputError(형식은 맞는데 뜻 글자가 낱자모로 깨진 응답)는 형식 오류지만 다시 요청하면
// 정상으로 오는 경우가 있어 재시도한다. 모델 구현(gemini.ts)에 묶이지 않도록 이름으로 알아본다.
const NETWORK_ERROR_NAMES = new Set(['AbortError', 'TimeoutError']);
const GARBLED_OUTPUT_ERROR = 'GarbledOutputError';

export function isRetryableError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { status, name, cause } = err as { status?: unknown; name?: unknown; cause?: unknown };
  if (name === GARBLED_OUTPUT_ERROR) return true;
  if (typeof status === 'number') return status === 429 || status >= 500;
  if (err instanceof TypeError) return true; // fetch failed
  if (typeof name === 'string' && NETWORK_ERROR_NAMES.has(name)) return true;
  return typeof (cause as { code?: unknown } | undefined)?.code === 'string'; // ECONNRESET 등
}

// 재시도 간격(1→2→4초)에 ±20% 지터를 준다. 테스트는 sleep·random을 주입해 실제로 기다리지 않는다.
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const RETRY_JITTER = 0.2;

export interface RetryOptions {
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  isRetryable?: (err: unknown) => boolean;
  // 재시도를 포함한 모든 모델 응답의 토큰을 받는다.
  onUsage?: (usage: TokenUsage) => void;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function requestWithRetry(
  batch: MeaningRequest[],
  batchNo: number,
  model: MeaningModel,
  { sleep = wait, random = Math.random, isRetryable = isRetryableError, onUsage }: RetryOptions,
): Promise<MeaningResult[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await model(batch, onUsage);
    } catch (err) {
      const { name, garbledCount } = err as { name?: unknown; garbledCount?: unknown };
      if (name === GARBLED_OUTPUT_ERROR) {
        console.warn(`문맥 뜻 깨진 글자: 묶음 ${batchNo}, 깨진 항목 ${garbledCount}개`);
      }
      if (attempt >= RETRY_DELAYS_MS.length || !isRetryable(err)) throw err;
      const status = (err as { status?: unknown }).status ?? (name === GARBLED_OUTPUT_ERROR ? 'garbled' : 'network');
      console.warn(`문맥 뜻 재시도: 묶음 ${batchNo}, 상태 ${status}, ${attempt + 1}/${RETRY_DELAYS_MS.length}회`);
      await sleep(RETRY_DELAYS_MS[attempt] * (1 + RETRY_JITTER * (2 * random() - 1)));
    }
  }
}

// 묶음 하나를 요청하고 답을 done·failedIds로 나눈다. 응답에 빠졌거나 빈 뜻, 재시도해도 실패한 묶음은 failedIds다.
async function requestBatch(
  batch: MeaningRequest[],
  batchNo: number,
  model: MeaningModel,
  retry: RetryOptions,
): Promise<GenerateOutcome> {
  const ids = new Set(batch.map((r) => r.id));
  let results: MeaningResult[] = [];
  try {
    results = await requestWithRetry(batch, batchNo, model, retry);
  } catch (err) {
    console.error('문맥 뜻 생성 실패', err);
  }
  const answered = new Map<number, string>();
  for (const r of results) {
    const meaning = r.meaningKo.trim();
    if (ids.has(r.id) && meaning.length > 0 && !answered.has(r.id)) answered.set(r.id, meaning);
  }
  const outcome: GenerateOutcome = { done: [], failedIds: [] };
  for (const req of batch) {
    const meaning = answered.get(req.id);
    if (meaning === undefined) outcome.failedIds.push(req.id);
    else outcome.done.push({ id: req.id, meaningKo: meaning });
  }
  return outcome;
}

// MEANING_BATCH_SIZE개씩 나눠 최대 MEANING_CONCURRENCY개 묶음을 동시에 요청한다.
// 결과 순서는 끝난 순서가 아니라 묶음 순서다. 한 묶음이 실패해도 다른 묶음 결과는 그대로 돌려준다.
export async function generateMeanings(
  requests: MeaningRequest[],
  model: MeaningModel,
  retry: RetryOptions = {},
): Promise<GenerateOutcome> {
  const batchStarts: number[] = [];
  for (let i = 0; i < requests.length; i += MEANING_BATCH_SIZE) batchStarts.push(i);
  const outcomes = await mapWithConcurrency(batchStarts, MEANING_CONCURRENCY, (start) =>
    requestBatch(requests.slice(start, start + MEANING_BATCH_SIZE), start / MEANING_BATCH_SIZE + 1, model, retry),
  );
  return {
    done: outcomes.flatMap((o) => o.done),
    failedIds: outcomes.flatMap((o) => o.failedIds),
  };
}
