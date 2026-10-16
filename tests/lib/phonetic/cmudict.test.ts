import { describe, expect, it, vi } from 'vitest';
import { arpabetToIpa } from '@/lib/phonetic/arpabet';
import { cmudictLookup, createCmudict, createCmudictPhonetic } from '@/lib/phonetic/cmudict';

describe('arpabetToIpa', () => {
  it('converts phones and marks stress before the onset consonant', () => {
    expect(arpabetToIpa('R OW0 B AH1 S T')).toBe('/roʊˈbʌst/');
    expect(arpabetToIpa('P EH1 R AH0 D AY2 M')).toBe('/ˈpɛrəˌdaɪm/');
    expect(arpabetToIpa('R IH0 Z IH1 JH UW0 AH0 L')).toBe('/rɪˈzɪdʒuəl/');
  });

  it('puts the stress mark before the longest allowed onset cluster', () => {
    expect(arpabetToIpa('AE0 B S T R AE1 K T')).toBe('/æbˈstrækt/'); // abstract
    expect(arpabetToIpa('AH0 P R OW1 CH')).toBe('/əˈproʊtʃ/'); // approach
    expect(arpabetToIpa('K AH0 N T R OW1 L')).toBe('/kənˈtroʊl/'); // control
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

describe('createCmudictPhonetic', () => {
  it('returns the CMUdict pronunciation, or null when CMUdict has none', async () => {
    const lookup = createCmudictPhonetic((w) => (w === 'robust' ? '/roʊˈbʌst/' : null));
    expect(await lookup('robust')).toBe('/roʊˈbʌst/');
    expect(await lookup('softmax')).toBeNull();
  });

  it('returns null and logs once when CMUdict itself fails', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const lookup = createCmudictPhonetic(() => {
      throw new Error('cmudict.txt not found');
    });
    expect(await lookup('robust')).toBeNull();
    expect(await lookup('paradigm')).toBeNull();
    expect(errors).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });
});
