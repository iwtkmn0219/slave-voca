import { describe, expect, it } from 'vitest';
import { createPhoneticLookup, type FetchLike } from '@/lib/phonetic/lookup';

type Outcome = 'ok' | 'missing' | 'down' | 'timeout';

// 단어마다 정해 둔 결과를 돌려주는 가짜 fetch. 호출된 단어를 기록한다.
function fakeFetch(outcomes: Outcome[]) {
  const called: string[] = [];
  let i = 0;
  const fetchFn: FetchLike = async (url) => {
    called.push(decodeURIComponent(url.split('/').pop()!));
    const outcome = outcomes[i++] ?? 'ok';
    if (outcome === 'timeout') throw new DOMException('timed out', 'TimeoutError');
    if (outcome === 'down') return { ok: false, status: 522, json: async () => ({}) };
    if (outcome === 'missing') return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => [{ phonetic: '/x/' }] };
  };
  return { fetchFn, called };
}

async function lookupAll(lookup: (w: string) => Promise<string | null>, count: number) {
  const results: (string | null)[] = [];
  for (let n = 0; n < count; n++) results.push(await lookup(`w${n}`));
  return results;
}

describe('createPhoneticLookup', () => {
  it('stops calling the API after 5 consecutive failures', async () => {
    const { fetchFn, called } = fakeFetch(['down', 'timeout', 'down', 'timeout', 'down']);
    const results = await lookupAll(createPhoneticLookup(fetchFn), 8);
    expect(called).toHaveLength(5);
    expect(results).toEqual(Array(8).fill(null));
  });

  it('does not trip on 404s, which mean the API is alive', async () => {
    const { fetchFn, called } = fakeFetch(Array(10).fill('missing'));
    await lookupAll(createPhoneticLookup(fetchFn), 11);
    expect(called).toHaveLength(11);
  });

  it('resets the failure count after a success', async () => {
    const outcomes: Outcome[] = ['down', 'down', 'down', 'down', 'ok', 'down', 'down', 'down', 'down'];
    const { fetchFn, called } = fakeFetch(outcomes);
    const results = await lookupAll(createPhoneticLookup(fetchFn), 10);
    expect(called).toHaveLength(10);
    expect(results[4]).toBe('/x/');
  });
});
