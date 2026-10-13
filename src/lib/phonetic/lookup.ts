const ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const TIMEOUT_MS = 5000;
// 사전 API가 응답하지 않으면 요청마다 5초를 기다리게 된다. 연속으로 이만큼 실패하면 남은 조회를 건너뛴다.
const MAX_CONSECUTIVE_FAILURES = 5;

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>;

// found: 발음기호 있음, missing: 사전에 없거나 발음기호가 없음(API는 정상), failed: 시간 초과·네트워크·5xx
type LookupOutcome =
  | { kind: 'found'; phonetic: string }
  | { kind: 'missing' }
  | { kind: 'failed' };

interface Entry {
  phonetic?: unknown;
  phonetics?: { text?: unknown }[];
}

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function pickPhonetic(data: unknown): string | null {
  if (!Array.isArray(data)) return null;
  for (const entry of data as Entry[]) {
    if (nonEmpty(entry.phonetic)) return entry.phonetic.trim();
    for (const p of entry.phonetics ?? []) {
      if (nonEmpty(p.text)) return p.text.trim();
    }
  }
  return null;
}

async function fetchPhonetic(word: string, fetchFn: FetchLike): Promise<LookupOutcome> {
  try {
    const res = await fetchFn(ENDPOINT + encodeURIComponent(word), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return res.status !== undefined && res.status < 500 ? { kind: 'missing' } : { kind: 'failed' };
    const phonetic = pickPhonetic(await res.json());
    return phonetic ? { kind: 'found', phonetic } : { kind: 'missing' };
  } catch {
    return { kind: 'failed' };
  }
}

// Free Dictionary API에서 발음기호를 찾는다. 404·오류·시간 초과는 null(재시도하지 않음).
export async function lookupPhonetic(word: string, fetchFn: FetchLike = fetch): Promise<string | null> {
  const outcome = await fetchPhonetic(word, fetchFn);
  return outcome.kind === 'found' ? outcome.phonetic : null;
}

// 문서 하나를 채우는 동안 쓰는 조회 함수. 연속 5번 장애가 나면 이후 단어는 API를 부르지 않고 null을 준다.
// 404(사전에 없음)는 API가 살아 있다는 뜻이라 장애로 세지 않고, 한 번이라도 찾으면 연속 횟수를 0으로 되돌린다.
export function createPhoneticLookup(fetchFn: FetchLike = fetch): (word: string) => Promise<string | null> {
  let consecutiveFailures = 0;
  return async (word) => {
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) return null;
    const outcome = await fetchPhonetic(word, fetchFn);
    consecutiveFailures = outcome.kind === 'failed' ? consecutiveFailures + 1 : 0;
    return outcome.kind === 'found' ? outcome.phonetic : null;
  };
}
