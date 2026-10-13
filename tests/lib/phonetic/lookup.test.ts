import { describe, expect, it } from 'vitest';
import { lookupPhonetic, type FetchLike } from '@/lib/phonetic/lookup';

const respond =
  (body: unknown, ok = true): FetchLike =>
  async () => ({ ok, json: async () => body });

describe('lookupPhonetic', () => {
  it('uses the top-level phonetic field', async () => {
    const fetchFn = respond([{ phonetic: ' /rəʊˈbʌst/ ' }]);
    expect(await lookupPhonetic('robust', fetchFn)).toBe('/rəʊˈbʌst/');
  });

  it('falls back to the first non-empty phonetics text', async () => {
    const fetchFn = respond([{ phonetic: '', phonetics: [{ text: '' }, { text: '/ˈpærədaɪm/' }] }]);
    expect(await lookupPhonetic('paradigm', fetchFn)).toBe('/ˈpærədaɪm/');
  });

  it('returns null for 404s, odd bodies and network errors', async () => {
    expect(await lookupPhonetic('dmodel', respond({ title: 'No Definitions Found' }, false))).toBeNull();
    expect(await lookupPhonetic('x', respond({ unexpected: true }))).toBeNull();
    expect(await lookupPhonetic('x', respond([{ phonetics: [] }]))).toBeNull();
    const failing: FetchLike = async () => {
      throw new Error('network down');
    };
    expect(await lookupPhonetic('x', failing)).toBeNull();
  });

  it('encodes the word into the URL', async () => {
    let requested = '';
    const fetchFn: FetchLike = async (url) => {
      requested = url;
      return { ok: false, json: async () => null };
    };
    await lookupPhonetic('a b', fetchFn);
    expect(requested).toBe('https://api.dictionaryapi.dev/api/v2/entries/en/a%20b');
  });
});
