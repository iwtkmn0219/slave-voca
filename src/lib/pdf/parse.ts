export class NoTextError extends Error {
  constructor() {
    super('텍스트를 찾지 못했습니다. 스캔 PDF는 지원하지 않습니다.');
    this.name = 'NoTextError';
  }
}

const MIN_TEXT_CHARS = 200;
const REFERENCES_HEADING = /^[ \t]*(references|bibliography|참고문헌)[ \t]*$/im;

// 합자(ﬁ 등) 펼치기 → 줄 끝 하이픈 복원 → 참고문헌 이후 제거 → 공백 정리
export function cleanText(raw: string): string {
  let text = raw.normalize('NFKC');
  text = text.replace(/([A-Za-z])-\n([a-z])/g, '$1$2');
  const heading = REFERENCES_HEADING.exec(text);
  if (heading) text = text.slice(0, heading.index);
  return text.replace(/\s+/g, ' ').trim();
}

export function splitSentences(text: string): string[] {
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
  return [...segmenter.segment(text)]
    .map((s) => s.segment.trim())
    .filter((s) => s.length > 0);
}

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // pdf.js는 넘겨받은 버퍼를 분리(detach)하므로 복사본을 넘긴다.
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
          .join(''),
      );
    }
    return pages.join('\n');
  } finally {
    await task.destroy();
  }
}

export async function parsePdf(bytes: Uint8Array): Promise<string[]> {
  const text = cleanText(await extractPdfText(bytes));
  if (text.replace(/\s/g, '').length < MIN_TEXT_CHARS) throw new NoTextError();
  return splitSentences(text);
}
