import { describe, expect, it } from 'vitest';
import { cleanText, NoTextError, parsePdf, splitSentences } from '@/lib/pdf/parse';
import { makePdf } from '../../helpers/make-pdf';

// 페이지 밖으로 나간 글자는 추출되지 않으므로 줄을 짧게 유지한다.
const FILLER = [
  'This paper examines heterogeneous datasets with rigor.',
  'The proposed method remains robust under perturbations.',
];

describe('cleanText', () => {
  it('joins words split by a line-end hyphen', () => {
    expect(cleanText('the inter-\nnational case')).toBe('the international case');
  });

  it('keeps hyphens that are not at a line end', () => {
    expect(cleanText('a state-of-the-art model')).toBe('a state-of-the-art model');
  });

  it('expands ligatures so words stay whole', () => {
    expect(cleanText('an eﬃcient and signiﬁcant result')).toBe(
      'an efficient and significant result',
    );
  });

  it('drops everything from a standalone References line', () => {
    expect(cleanText('Body text.\nReferences\nSmith, 2020.')).toBe('Body text.');
    expect(cleanText('Body.\n  BIBLIOGRAPHY \nX.')).toBe('Body.');
  });

  it('keeps text when a lowercase "references" wraps onto its own line', () => {
    expect(cleanText('Earlier work, see the\nreferences\nlisted below.')).toBe(
      'Earlier work, see the references listed below.',
    );
  });

  it('cuts at the last References heading, not an earlier one', () => {
    expect(cleanText('Intro.\nReferences\nMore body.\nReferences\nSmith, 2020.')).toBe(
      'Intro. References More body.',
    );
  });

  it('keeps text when "references" appears inside a sentence', () => {
    expect(cleanText('Prior references\nsupport this claim.')).toBe(
      'Prior references support this claim.',
    );
  });
});

describe('splitSentences', () => {
  it('splits text into trimmed sentences', () => {
    expect(splitSentences('One sentence. Another one here.')).toEqual([
      'One sentence.',
      'Another one here.',
    ]);
  });
});

describe('parsePdf', () => {
  it('returns sentences from every page', async () => {
    const pdf = makePdf([FILLER, ['We address the inter-', 'national problem.', ...FILLER]]);
    const sentences = await parsePdf(pdf);
    expect(sentences).toContain('We address the international problem.');
    expect(sentences.length).toBeGreaterThanOrEqual(5);
  });

  it('throws NoTextError when the PDF has almost no text', async () => {
    await expect(parsePdf(makePdf([['Figure 1']]))).rejects.toBeInstanceOf(NoTextError);
  });
});
