export class NoTextError extends Error {
  constructor() {
    super('텍스트를 찾지 못했습니다. 스캔 PDF는 지원하지 않습니다.');
    this.name = 'NoTextError';
  }
}

const MIN_TEXT_CHARS = 200;
// 대소문자를 구분한다: 본문의 소문자 "references"가 줄 바꿈으로 혼자 남아도 제목으로 보지 않는다.
// 앞에 장 번호("6 References", "7. REFERENCES")가 붙어도 제목으로 본다.
const REFERENCES_HEADING =
  /^[ \t]*(?:\d+(?:\.\d+)*\.?[ \t]+)?(References|REFERENCES|Bibliography|BIBLIOGRAPHY|참고문헌)[ \t]*$/gm;
const LINE_END_HYPHEN = /([A-Za-z]+)-\n([a-z]+)/g;
const URL = /https?:\/\/\S+/g;
const EMAIL = /\S+@\S+/g;

export interface CleanOptions {
  // 빈도표에 있는 단어인지. 주면 줄 끝에서 잘린 합성어(fine-\ntuning)의 하이픈을 남긴다.
  isKnownWord?: (word: string) => boolean;
}

function restoreHyphen(left: string, right: string, isKnownWord?: (w: string) => boolean) {
  const joined = left + right;
  const lower = (w: string) => w.toLowerCase();
  const keepHyphen =
    isKnownWord !== undefined &&
    !isKnownWord(lower(joined)) &&
    isKnownWord(lower(left)) &&
    isKnownWord(lower(right));
  return keepHyphen ? `${left}-${right}` : joined;
}

// 합자(ﬁ 등) 펼치기 → 줄 끝 하이픈 복원 → 이메일·URL 제거 → 마지막 참고문헌 제목 이후 제거 → 공백 정리
export function cleanText(raw: string, options: CleanOptions = {}): string {
  let text = raw.normalize('NFKC');
  text = text.replace(LINE_END_HYPHEN, (_, left: string, right: string) =>
    restoreHyphen(left, right, options.isKnownWord),
  );
  text = text.replace(URL, ' ').replace(EMAIL, ' ');
  const heading = [...text.matchAll(REFERENCES_HEADING)].at(-1);
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

export async function parsePdf(bytes: Uint8Array, options: CleanOptions = {}): Promise<string[]> {
  const text = cleanText(await extractPdfText(bytes), options);
  if (text.replace(/\s/g, '').length < MIN_TEXT_CHARS) throw new NoTextError();
  return splitSentences(text);
}
