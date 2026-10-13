import { describe, expect, it } from 'vitest';
import { arpabetToIpa } from '@/lib/phonetic/arpabet';
import { cmudictLookup, createCmudict, withCmudictFallback } from '@/lib/phonetic/cmudict';

describe('arpabetToIpa', () => {
  it('converts phones and marks stress before the onset consonant', () => {
    expect(arpabetToIpa('R OW0 B AH1 S T')).toBe('/roʊˈbʌst/');
    expect(arpabetToIpa('P EH1 R AH0 D AY2 M')).toBe('/ˈpɛrəˌdaɪm/');
    expect(arpabetToIpa('R IH0 Z IH1 JH UW0 AH0 L')).toBe('/rɪˈzɪdʒuəl/');
  });

  it('uses schwa and r-colored schwa for unstressed AH and ER', () => {
    expect(arpabetToIpa('HH EH2 T ER0 AH0 JH IY1 N Y AH0 S')).toBe('/ˌhɛtɚəˈdʒinjəs/');
  });

  it('omits stress marks for one-vowel words', () => {
    expect(arpabetToIpa('DH AH0')).toBe('/ðə/');
    expect(arpabetToIpa('S T R EH1 NG K TH')).toBe('/strɛŋkθ/');
  });

  it('returns null for unknown symbols', () => {
    expect(arpabetToIpa('XX AH1')).toBeNull();
    expect(arpabetToIpa('B1 AH1')).toBeNull();
  });
});

describe('createCmudict', () => {
  const lookup = createCmudict('read R EH1 D\nread R IY1 D\nrobust R OW0 B AH1 S T\n');

  it('looks up words case-insensitively and keeps the first pronunciation', () => {
    expect(lookup('Robust')).toBe('/roʊˈbʌst/');
    expect(lookup('read')).toBe('/rɛd/');
    expect(lookup('missing')).toBeNull();
  });
});

describe('cmudictLookup', () => {
  it('reads the bundled data file', () => {
    expect(cmudictLookup('residual')).toBe('/rɪˈzɪdʒuəl/');
    expect(cmudictLookup('constructor')).not.toBeNull();
    expect(cmudictLookup('dmodel')).toBeNull();
  });
});

describe('withCmudictFallback', () => {
  it('prefers the API result and falls back when it is null', async () => {
    const api = async (w: string) => (w === 'robust' ? '/rəʊˈbʌst/' : null);
    const lookup = withCmudictFallback(api, (w) => (w === 'paradigm' ? '/ˈpɛrəˌdaɪm/' : null));
    expect(await lookup('robust')).toBe('/rəʊˈbʌst/');
    expect(await lookup('paradigm')).toBe('/ˈpɛrəˌdaɪm/');
    expect(await lookup('dmodel')).toBeNull();
  });
});
