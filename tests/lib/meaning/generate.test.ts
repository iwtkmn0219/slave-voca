import { describe, expect, it, vi } from 'vitest';
import {
  generateMeanings,
  isRetryableError,
  MEANING_BATCH_SIZE,
  type MeaningModel,
  type MeaningRequest,
} from '@/lib/meaning/generate';
import { GarbledOutputError } from '@/lib/meaning/gemini';

const requests = (n: number): MeaningRequest[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, word: `w${i + 1}`, sentence: 's.' }));

const echoModel: MeaningModel = async (batch) =>
  batch.map((r) => ({ id: r.id, meaningKo: `뜻${r.id}` }));

describe('generateMeanings', () => {
  it('sends batches of 200 and collects every meaning', async () => {
    const sizes: number[] = [];
    const model: MeaningModel = async (batch) => {
      sizes.push(batch.length);
      return echoModel(batch);
    };
    const outcome = await generateMeanings(requests(450), model);
    expect(MEANING_BATCH_SIZE).toBe(200);
    expect(sizes).toEqual([200, 200, 50]);
    expect(outcome.done).toHaveLength(450);
    expect(outcome.failedIds).toEqual([]);
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
    let call = 0;
    const model: MeaningModel = async (batch) => {
      call++;
      if (call === 1) throw new Error('rate limited');
      return echoModel(batch);
    };
    const outcome = await generateMeanings(requests(210), model);
    expect(outcome.failedIds).toHaveLength(200);
    expect(outcome.done.map((d) => d.id)).toEqual(Array.from({ length: 10 }, (_, i) => 201 + i));
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
    expect(outcome.failedIds).toHaveLength(200);
    expect(outcome.done).toHaveLength(10);
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
