const ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const TIMEOUT_MS = 5000;

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

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

// Free Dictionary API에서 발음기호를 찾는다. 404·오류·시간 초과는 null(재시도하지 않음).
export async function lookupPhonetic(word: string, fetchFn: FetchLike = fetch): Promise<string | null> {
  try {
    const res = await fetchFn(ENDPOINT + encodeURIComponent(word), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return pickPhonetic(await res.json());
  } catch {
    return null;
  }
}
