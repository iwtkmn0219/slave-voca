# 마일스톤 4-4: 문맥 뜻 품질(사고 단계·묶음 크기·동시 요청) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 문맥 뜻의 오답을 줄인다. 사고 단계를 MINIMAL에서 LOW로, 묶음을 200개에서 50개로 바꾸고, 묶음을 최대 5개까지 동시에 보낸다. 실측(PM, 2026-10-16)에서 회차당 틀린 뜻이 1.3개에서 0.2개로 줄었고, 두 회차 같은 뜻은 74%에서 79~81%로 올랐다. 시간은 9초에서 3초로 줄었고 비용은 같았다.

**Architecture:** 기존 구조 그대로다. `lib/meaning/gemini.ts`는 사고 단계 한 줄과 주석만 바뀐다. `lib/meaning/generate.ts`는 묶음 하나를 처리하는 부분을 `requestBatch`로 떼어 내고, `generateMeanings`가 기존 `mapWithConcurrency`(`lib/async/pool.ts`)로 묶음을 동시에 돌린다. 호출하는 쪽(`server/services/enrich.ts`, 저장 직후 채우기와 다시 만들기)은 바뀌지 않는다.

**Tech Stack:** 기존 스택 그대로(새 의존성 없음)

**Spec:** `docs/superpowers/specs/2026-10-16-m4-4-meaning-quality-design.md`(사용자 승인, 실측 결과·바꾸는 것·위험·확인 방법), 상위 설계서 8.4·11장

## Global Constraints

- 작업 브랜치: `feat/m4-4-meaning-quality` (main에서 분기). 태스크마다 커밋한다.
- 리뷰는 Orca의 Codex 터미널에 맡긴다(`orca terminal send`/`read`). 심각도 분류는 그대로이고, Important 이상은 테스트를 먼저 써서 고친다.
- **시스템 지시(B1), 응답 스키마, `maxOutputTokens: 16384`, 재시도 규칙(1→2→4초, 최대 3번), 깨진 글자 검사는 바꾸지 않는다.** 화면·DB도 그대로다.
- 이미 저장된 뜻은 바꾸지 않는다. 새로 올리는 문서와 다시 만들기부터 적용된다.
- 실제 Gemini 호출은 Task 2 Step 2의 **한 번**뿐이다(약 $0.015, 선불 잔액에서 나간다). 키를 출력하지 않는다.
- 3000번 포트는 쓰지 않는다(3300).

## Review Focus

1. 한 묶음이 실패(400, 재시도 끝의 503, 깨진 글자)해도 다른 묶음 결과는 그대로 저장되고, 실패한 묶음 id만 `failedIds`에 들어가는지(Task 1 "fails only the batch whose request threw", "fails only that batch after 4 tries of 503").
2. 결과 순서가 끝난 순서가 아니라 묶음 순서인지(Task 1 "returns results in batch order …"). `enrich.ts`는 순서에 기대지 않지만, 테스트·로그가 실행마다 달라지지 않게 하기 위해서다.
3. 동시 요청이 5개를 넘지 않는지(Task 1 "keeps at most 5 batches in flight at once"). 후보 1,000개(묶음 20개)에서도 마찬가지다.
4. 재시도 로그의 묶음 번호가 1부터 묶음 순서대로 붙는지(`묶음 N`). 동시에 돌아도 번호는 실행 순서가 아니라 묶음 위치로 정한다.
5. 다시 만들기(단어 하나, 묶음 1개)와 문서 단위 "모두 다시 시도"가 같은 경로로 바뀐 설정을 쓰는지(`regenerate-meanings` 테스트가 그대로 통과).

---

## 파일 구조

| 파일 | 책임 | 태스크 |
|---|---|---|
| `src/lib/meaning/generate.ts` | 묶음 50개, 동시 5개, `requestBatch` 분리 | 1 |
| `src/lib/meaning/gemini.ts` | `thinkingLevel: LOW`, 주석 | 1 |
| `tests/lib/meaning/generate.test.ts` | 묶음 크기·동시 개수·순서·실패 격리 | 1 |
| `tests/lib/meaning/gemini.test.ts` | 요청 설정 LOW | 1 |
| `docs/superpowers/specs/2026-10-13-slave-voca-design.md` | 8.4 갱신, 11장 완료 표시, 13장 이력 | 2 |

테스트 수: 시작 189 → Task 1 후 191.

---

### Task 1: 사고 단계 LOW, 묶음 50개, 동시 요청 5개

**Files:**
- Modify: `src/lib/meaning/generate.ts`(전체 교체), `src/lib/meaning/gemini.ts`(두 곳), `tests/lib/meaning/generate.test.ts`(전체 교체), `tests/lib/meaning/gemini.test.ts`(한 테스트)

**Interfaces:**
- Consumes: `mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]>` (`src/lib/async/pool.ts`, 결과 순서 = 입력 순서)
- Produces: `MEANING_BATCH_SIZE = 50`, `MEANING_CONCURRENCY = 5`(새로 export). `generateMeanings`의 시그니처와 반환형은 그대로다.

- [ ] **Step 1: 브랜치**

```bash
git checkout main
git checkout -b feat/m4-4-meaning-quality
```

- [ ] **Step 2: 실패하는 테스트**

`tests/lib/meaning/generate.test.ts`를 아래로 바꾼다. 바뀐 테스트는 다음과 같다.
- 묶음 크기: 460개 → 50개 9묶음 + 10개.
- 동시 개수: 1,000개를 보내 진행 중인 요청 수의 최댓값이 5인지 본다.
- 결과 순서: 앞 묶음이 더 늦게 끝나도 id가 1부터 차례대로 나오는지 본다.
- 실패 격리: 가운데 묶음(id 51~100)만 실패시킨다.
- 4번 실패: 210개 중 첫 묶음 50개만 실패하는지 본다.

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  generateMeanings,
  isRetryableError,
  MEANING_BATCH_SIZE,
  MEANING_CONCURRENCY,
  type MeaningModel,
  type MeaningRequest,
} from '@/lib/meaning/generate';
import { GarbledOutputError } from '@/lib/meaning/gemini';

const requests = (n: number): MeaningRequest[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, word: `w${i + 1}`, sentence: 's.' }));

const echoModel: MeaningModel = async (batch) =>
  batch.map((r) => ({ id: r.id, meaningKo: `뜻${r.id}` }));

describe('generateMeanings', () => {
  it('sends batches of 50 and collects every meaning', async () => {
    const sizes: number[] = [];
    const model: MeaningModel = async (batch) => {
      sizes.push(batch.length);
      return echoModel(batch);
    };
    const outcome = await generateMeanings(requests(460), model);
    expect(MEANING_BATCH_SIZE).toBe(50);
    expect(sizes).toEqual([50, 50, 50, 50, 50, 50, 50, 50, 50, 10]);
    expect(outcome.done).toHaveLength(460);
    expect(outcome.failedIds).toEqual([]);
  });

  it('keeps at most 5 batches in flight at once', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const model: MeaningModel = async (batch) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return echoModel(batch);
    };
    const outcome = await generateMeanings(requests(1000), model);
    expect(MEANING_CONCURRENCY).toBe(5);
    expect(maxInFlight).toBe(5);
    expect(outcome.done).toHaveLength(1000);
  });

  it('returns results in batch order even when later batches finish first', async () => {
    const finished: number[] = [];
    const model: MeaningModel = async (batch) => {
      const batchNo = (batch[0].id - 1) / 50;
      await new Promise((resolve) => setTimeout(resolve, (5 - batchNo) * 10));
      finished.push(batchNo);
      return echoModel(batch);
    };
    const outcome = await generateMeanings(requests(230), model);
    expect(finished).toEqual([4, 3, 2, 1, 0]);
    expect(outcome.done.map((d) => d.id)).toEqual(Array.from({ length: 230 }, (_, i) => i + 1));
  });

  it('fails ids that are missing, blank, or not part of the batch', async () => {
    const model: MeaningModel = async () => [
      { id: 1, meaningKo: ' 견고한 ' },
      { id: 2, meaningKo: '   ' },
      { id: 99, meaningKo: '엉뚱한' },
    ];
    const outcome = await generateMeanings(requests(3), model);
    expect(outcome.done).toEqual([{ id: 1, meaningKo: '견고한' }]);
    expect(outcome.failedIds).toEqual([2, 3]);
  });

  it('fails only the batch whose request threw', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const model: MeaningModel = async (batch) => {
      if (batch[0].id === 51) throw new Error('rate limited');
      return echoModel(batch);
    };
    const outcome = await generateMeanings(requests(210), model);
    expect(outcome.failedIds).toEqual(Array.from({ length: 50 }, (_, i) => 51 + i));
    expect(outcome.done.map((d) => d.id)).toEqual([
      ...Array.from({ length: 50 }, (_, i) => 1 + i),
      ...Array.from({ length: 110 }, (_, i) => 101 + i),
    ]);
    error.mockRestore();
  });

  it('does nothing for an empty request list', async () => {
    expect(await generateMeanings([], echoModel)).toEqual({ done: [], failedIds: [] });
  });
});

// 재시도: 실제로 기다리지 않도록 sleep과 random을 주입하고, 기다린 시간만 기록한다.
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

function retryHarness(random = () => 0.5) {
  const waits: number[] = [];
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const options = { sleep: async (ms: number) => void waits.push(ms), random };
  return { waits, warn, options, restore: () => (warn.mockRestore(), error.mockRestore()) };
}

describe('generateMeanings retries', () => {
  it('retries a batch after 503s and keeps it when a later try succeeds', async () => {
    const h = retryHarness();
    let calls = 0;
    const model: MeaningModel = async (batch) => {
      if (++calls <= 2) throw httpError(503);
      return echoModel(batch);
    };
    const outcome = await generateMeanings(requests(3), model, h.options);
    expect(calls).toBe(3);
    expect(outcome.done).toHaveLength(3);
    expect(outcome.failedIds).toEqual([]);
    expect(h.waits).toEqual([1000, 2000]);
    expect(h.warn).toHaveBeenCalledTimes(2);
    expect(String(h.warn.mock.calls[0])).toContain('503');
    h.restore();
  });

  it('fails only that batch after 4 tries of 503', async () => {
    const h = retryHarness();
    let firstBatchCalls = 0;
    const model: MeaningModel = async (batch) => {
      if (batch[0].id === 1) {
        firstBatchCalls++;
        throw httpError(503);
      }
      return echoModel(batch);
    };
    const outcome = await generateMeanings(requests(210), model, h.options);
    expect(firstBatchCalls).toBe(4);
    expect(outcome.failedIds).toHaveLength(50);
    expect(outcome.done).toHaveLength(160);
    expect(h.waits).toEqual([1000, 2000, 4000]);
    h.restore();
  });

  it('does not retry client errors such as 400', async () => {
    const h = retryHarness();
    let calls = 0;
    const model: MeaningModel = async () => {
      calls++;
      throw httpError(400);
    };
    const outcome = await generateMeanings(requests(3), model, h.options);
    expect(calls).toBe(1);
    expect(outcome.failedIds).toEqual([1, 2, 3]);
    expect(h.waits).toEqual([]);
    h.restore();
  });

  it('spreads waits within ±20% of 1, 2 and 4 seconds', async () => {
    for (const [random, factor] of [
      [0, 0.8],
      [1, 1.2],
    ]) {
      const h = retryHarness(() => random);
      await generateMeanings(requests(1), async () => Promise.reject(httpError(429)), h.options);
      expect(h.waits).toEqual([1000 * factor, 2000 * factor, 4000 * factor]);
      h.restore();
    }
  });
});

describe('generateMeanings with garbled responses', () => {
  it('retries a garbled response and keeps the batch when a later try is clean', async () => {
    const h = retryHarness();
    let calls = 0;
    const model: MeaningModel = async (batch) => {
      if (++calls === 1) throw new GarbledOutputError(2);
      return echoModel(batch);
    };
    const outcome = await generateMeanings(requests(3), model, h.options);
    expect(calls).toBe(2);
    expect(outcome.done).toHaveLength(3);
    expect(h.warn.mock.calls.some((c) => /묶음 1/.test(String(c)) && /2개/.test(String(c)))).toBe(true);
    h.restore();
  });

  it('fails the batch when every try comes back garbled', async () => {
    const h = retryHarness();
    let calls = 0;
    const model: MeaningModel = async () => {
      calls++;
      throw new GarbledOutputError(5);
    };
    const outcome = await generateMeanings(requests(3), model, h.options);
    expect(calls).toBe(4);
    expect(outcome.failedIds).toEqual([1, 2, 3]);
    h.restore();
  });
});

describe('isRetryableError', () => {
  it('retries rate limits, server errors and network failures only', () => {
    for (const status of [429, 500, 502, 503, 504]) expect(isRetryableError(httpError(status))).toBe(true);
    for (const status of [400, 401, 403, 404]) expect(isRetryableError(httpError(status))).toBe(false);
    expect(isRetryableError(new TypeError('fetch failed'))).toBe(true);
    expect(isRetryableError(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))).toBe(true);
    expect(isRetryableError(Object.assign(new Error('socket'), { cause: { code: 'ECONNRESET' } }))).toBe(true);
    expect(isRetryableError(new SyntaxError('Unexpected end of JSON input'))).toBe(false);
    expect(isRetryableError(new Error('응답이 비었습니다: SAFETY'))).toBe(false);
    expect(isRetryableError(new GarbledOutputError(3))).toBe(true); // 형식 오류 중 유일한 예외
  });
});
```

`tests/lib/meaning/gemini.test.ts`에서 첫 테스트의 이름과 기대값을 바꾼다.

```ts
  it('asks Gemini 3.5 Flash-Lite for JSON at low thinking and maps the result', async () => {
```

```ts
        thinkingConfig: { thinkingLevel: 'LOW' },
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run tests/lib/meaning`
Expected: 6개가 실패한다(PM이 프로토타입에서 확인).
- low thinking
- sends batches of 50
- keeps at most 5 batches in flight
- returns results in batch order
- fails only the batch whose request threw
- fails only that batch after 4 tries of 503

나머지 11개는 통과한다.

- [ ] **Step 4: 구현**

`src/lib/meaning/generate.ts`를 아래로 바꾼다.

```ts
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

// 단어 묶음 하나를 받아 문맥 뜻을 돌려주는 모델. 실제 구현은 gemini.ts, 테스트는 가짜를 쓴다.
export type MeaningModel = (batch: MeaningRequest[]) => Promise<MeaningResult[]>;

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
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function requestWithRetry(
  batch: MeaningRequest[],
  batchNo: number,
  model: MeaningModel,
  { sleep = wait, random = Math.random, isRetryable = isRetryableError }: RetryOptions,
): Promise<MeaningResult[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await model(batch);
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
```

`src/lib/meaning/gemini.ts`에서 두 곳을 바꾼다.

```ts
        // 2026-10-16 실측(M4-4): LOW가 MINIMAL보다 문맥 오답이 적었고 비용은 같았다(사고 토큰은 출력 요금에 포함).
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        // 묶음 50개의 출력은 약 1,500토큰이지만, 200개 묶음(약 5,500토큰)에 맞춘 여유를 그대로 둔다. 과금은 실제 출력량만큼이다.
        maxOutputTokens: 16384,
```

(바꾸기 전: `// 3.x는 사고를 끌 수 없다. 가장 낮은 MINIMAL로 …` + `ThinkingLevel.MINIMAL`, `// 200개 묶음의 출력이 약 5,500토큰(실측)이라 여유를 둔다. …`)

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run`
Expected: 30 files, 191 tests 통과(PM 프로토타입과 같음).

Run: `npm run typecheck`, `npx eslint src tests`
Expected: 오류 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/meaning/generate.ts src/lib/meaning/gemini.ts tests/lib/meaning/generate.test.ts tests/lib/meaning/gemini.test.ts
git commit -m "feat: send meaning batches of 50 concurrently at low thinking"
```

---

### Task 2: 실제 호출 확인, 설계서 갱신, 리뷰, 병합

**Files:**
- Modify: `docs/superpowers/specs/2026-10-13-slave-voca-design.md`

- [ ] **Step 1: 빌드**

Run: `npm run build`
Expected: 빌드 표가 main과 같다(`◐ /`, `◐ /_not-found`, `ƒ /api/usage-meaning`, `◐ /documents`, `/documents/[id]`, `/documents/[id]/review`, `◐ /settings`, `◐ /study`).

- [ ] **Step 2: 실제 호출 한 번** (약 $0.015)

데모 DB 사본으로 `next start -p 3300`을 띄우고 `attention.pdf`를 올려 저장한다. PDF는 PM 작업 폴더 `C:\Users\iwtkm\AppData\Local\Temp\claude\C--Users-iwtkm-workspace-slave-voca\d44d2645-12b6-43b3-abd5-0818f7c137c2\scratchpad\pdfs`에 있다. 확인할 것은 세 가지다.
- 서버 로그에 `문맥 뜻 생성 실패`가 없다.
- 문서 단어 목록에 실패한 뜻이 0개다.
- 저장부터 뜻이 다 찰 때까지 걸린 시간을 잰다. PM 프로토타입에서 `generateMeanings` 자체는 211개에 약 3초였다(지금 설정은 약 9초).

정확도 채점은 하지 않는다. PM이 프로토타입에서 6회로 마쳤고, 한 회만 채점하면 흔들림이 커서 기준으로 쓸 수 없다(설계서 5장).

- [ ] **Step 3: 상위 설계서 갱신**

`docs/superpowers/specs/2026-10-13-slave-voca-design.md` 8.4에서 세 군데를 고친다.
1. 첫 항목의 `` `thinkingConfig.thinkingLevel: MINIMAL`(3.x는 사고를 끌 수 없어 가장 낮은 단계를 명시한다) ``를 아래로 바꾼다.

   `` `thinkingConfig.thinkingLevel: LOW`(2026-10-16 M4-4 실측: MINIMAL보다 문맥 오답이 적고 비용은 같다) ``

2. "한 요청에 최대 200개의 …" 항목을 아래로 바꾼다.

   - 한 요청에 최대 50개의 (id, 단어, 원문 문장)을 담고, 묶음은 최대 5개까지 동시에 보낸다. 논문 한 편(후보 약 200개)이 한 번에 나간다. 결과 순서는 묶음 순서다. (2026-10-16 M4-4에서 200개 순서대로 보내기에서 변경: 50개 묶음이 실측에서 틀린 뜻이 적었다. 200개는 무료 등급 분당 5요청 한도 때문이었는데 유료 등급 키라 그 제약이 없다.)

3. 가격 항목의 "실측으로 논문 한 편(단어 211개)에 약 $0.018" 뒤에 이렇게 덧붙인다: `` (M4-4 설정에서 $0.013~0.015) ``

11장 M4-4 줄의 `**M4-4 (설계, 2026-10-16):**`를 `**M4-4 (완료, 2026-10-16, 병합 <해시>):**`로 바꾸고, 줄 끝에 `` , 계획 `docs/superpowers/plans/2026-10-16-m4-4-meaning-quality.md` ``를 붙인다. 같은 11장의 "뜻 품질 개선 검토" 줄 끝에는 `` (M4-4에서 사고 단계·묶음 크기로 해결. 표기 흔들림은 남음) ``를 붙인다. 11장 "M2 리뷰에서 넘어온 항목"의 "뜻 묶음 동시 요청(키로 측정 후)"은 해결된 항목이므로 앞에 `(M4-4에서 해결)`을 붙인다. 13장 끝에 이력 한 줄을 넣는다.

```
- 2026-10-16: M4-4 완료 반영(사고 단계 LOW, 묶음 50개, 동시 5개)
```

병합 해시는 Step 4의 병합 뒤에 채워 따로 커밋한다.

- [ ] **Step 4: Codex 리뷰와 병합**

Orca의 Codex 터미널에 브랜치 전체 리뷰를 맡긴다(범위 `main..feat/m4-4-meaning-quality`). Review Focus 1~5를 함께 보낸다. Important 이상은 테스트를 먼저 써서 고친다. `git status`로 데모 DB 사본·로그가 커밋에 들어가지 않았는지 본 뒤 main에 로컬 병합(`--no-ff`)한다. 다음을 PM에게 보낸다.
- main에서 돌린 test·typecheck·lint·build 결과(빌드 표 포함)
- Step 2의 실패 수와 걸린 시간
- 병합 커밋 해시
- 리뷰 요약
