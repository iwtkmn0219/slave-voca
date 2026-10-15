import { describe, expect, it } from 'vitest';
import { highlight } from '@/lib/text/highlight';

describe('highlight', () => {
  it('marks every whole-word match regardless of case', () => {
    expect(highlight('Studies show studies.', 'studies')).toEqual([
      { text: 'Studies', match: true },
      { text: ' show ', match: false },
      { text: 'studies', match: true },
      { text: '.', match: false },
    ]);
  });

  it('marks words with diacritics as whole words', () => {
    expect(highlight('A naïve Naïve baseline, not naïveté.', 'naïve')).toEqual([
      { text: 'A ', match: false },
      { text: 'naïve', match: true },
      { text: ' ', match: false },
      { text: 'Naïve', match: true },
      { text: ' baseline, not naïveté.', match: false },
    ]);
  });

  it('does not mark the word inside a longer word', () => {
    expect(highlight('A robustness check.', 'robust')).toEqual([
      { text: 'A robustness check.', match: false },
    ]);
  });
});
