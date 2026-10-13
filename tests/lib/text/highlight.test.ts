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

  it('does not mark the word inside a longer word', () => {
    expect(highlight('A robustness check.', 'robust')).toEqual([
      { text: 'A robustness check.', match: false },
    ]);
  });
});
