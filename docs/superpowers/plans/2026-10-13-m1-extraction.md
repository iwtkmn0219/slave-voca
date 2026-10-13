# 마일스톤 1: 단어 추출 검증 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF를 올리면 외울 후보 단어 목록을 뽑아 검토 화면에 보여주는 데까지 만들고, 실제 논문 3편으로 추출 품질을 확인한다.

**Architecture:** Next.js 16(App Router) 앱 하나. 순수 함수 모듈(`src/lib/`: PDF 파싱, 원형 처리, 단어 추출)은 DB를 모르고, DB 접근은 `src/server/repo/`에서만 한다. 업로드는 Server Action → `ingestPdf` 서비스 → 후보를 SQLite에 저장 → 검토 화면에서 읽는다.

**Tech Stack:** Next.js 16.4.0, React 19.3, TypeScript, Tailwind 4, pdfjs-dist 6.4.299, wink-lemmatizer 3.0.4, Drizzle ORM 0.45.4 + better-sqlite3 13.0.3, Vitest 5.0.4, tsx 4.23.15

**Spec:** `docs/superpowers/specs/2026-10-13-slave-voca-design.md` (이 계획은 스펙의 마일스톤 1이다. 마일스톤 2~4는 이 계획의 품질 확인 결과를 보고 별도 계획서로 쓴다.)

## Global Constraints

- Node 24, npm 11 (작성 시 확인한 버전: Node v24.18.0, npm 11.18.0)
- 이 계획에 적힌 패키지 버전을 그대로 고정해서 설치한다.
- 흔한 단어 제외 기준 기본값: 상위 5,000개 (`exclude_top_n`), 하루 새 카드 상한 기본값: 20 (`daily_new_limit`)
- 업로드 최대 크기: 50MB. PDF가 아니면 거부한다.
- 추출 텍스트(공백 제외)가 200자 미만이면 오류: "텍스트를 찾지 못했습니다. 스캔 PDF는 지원하지 않습니다."
- 원문 문장은 최대 300자로 자른다.
- 원본 PDF는 저장하지 않는다.
- 화면 문구는 한국어로 쓴다.
- Next.js 16은 학습 데이터와 다르다. 모르는 API는 `node_modules/next/dist/docs/`를 먼저 읽는다(`AGENTS.md` 참고). 특히 `cacheComponents: true` 상태에서 DB를 읽는 서버 컴포넌트는 `await connection()`을 먼저 호출하고 `<Suspense>` 안에 둔다.
- 작업 브랜치: `feat/m1-extraction` (main에서 분기). 각 태스크 끝에 커밋한다.

## Review Focus

1. 합자 글자(ﬁ, ﬃ)가 든 PDF: `efficient`가 `ef`+`cient`로 쪼개지지 않고 한 단어로 추출돼야 한다. (Task 2 `cleanText` 테스트)
2. 흔한 단어인데 원형이 드문 경우(`data` → `datum`): 후보에 나오면 안 된다. (Task 3 테스트)
3. 문장 첫머리에서만 대문자로 나온 드문 단어(`Notwithstanding`): 고유명사로 오인해 버리면 안 된다. (Task 3 테스트)
4. PDF가 아니거나 비었거나 50MB를 넘는 파일: 문서를 만들지 않고 읽을 수 있는 메시지로 거부해야 한다. (Task 5 테스트)
5. 문장 안에 "references"라는 단어가 있는 경우: 참고문헌 제목으로 오인해 본문을 자르면 안 된다. (Task 2 테스트)

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/types/wink-lemmatizer.d.ts` | 타입 없는 라이브러리의 선언 |
| `src/lib/extract/lemma.ts` | 단어 → 원형 |
| `src/lib/extract/build-frequency-map.ts` | 빈도순 단어 목록 → 단어·원형별 순위표 (순수 함수) |
| `scripts/build-frequency.ts` | 공개 빈도 목록을 내려받아 `data/frequency.json` 생성 |
| `data/frequency.json` | 생성된 순위표 (커밋함) |
| `src/lib/extract/frequency.ts` | 순위 조회 `rankOf` |
| `src/lib/pdf/parse.ts` | PDF → 정제된 문장 배열 |
| `src/lib/extract/extract.ts` | 문장 배열 → 후보 단어 |
| `src/lib/text/highlight.ts` | 문장 속 단어 강조 조각 |
| `src/server/db/schema.ts` | Drizzle 스키마 |
| `src/server/db/client.ts` | DB 연결·마이그레이션 (교체 지점) |
| `src/server/repo/*.ts` | 테이블별 읽기·쓰기 |
| `src/server/services/ingest.ts` | 업로드 검증 → 추출 → 저장 |
| `src/app/documents/*` | 업로드 폼, Server Action, 문서 목록 |
| `src/app/documents/[id]/review/*` | 검토 화면 |
| `tests/**` | Vitest 테스트, `tests/helpers/make-pdf.ts`는 테스트용 PDF 생성기 |

---

### Task 1: 프로젝트 골격 + 원형 처리 + 빈도표

**Files:**
- Create: Next.js 골격 (`create-next-app`), `vitest.config.mts`, `drizzle.config.ts`(Task 4에서 사용하지만 설치와 함께 둔다 — 아래 Step 4)
- Create: `src/types/wink-lemmatizer.d.ts`, `src/lib/extract/lemma.ts`, `src/lib/extract/build-frequency-map.ts`, `src/lib/extract/frequency.ts`, `scripts/build-frequency.ts`, `data/frequency.json`
- Modify: `package.json` (scripts), `.gitignore`
- Test: `tests/lib/extract/lemma.test.ts`

**Interfaces:**
- Produces: `lemmatize(word: string): string`, `buildFrequencyMap(words: string[]): Record<string, number>`, `type RankOf = (word: string) => number | undefined`, `rankOf: RankOf`

- [ ] **Step 1: 브랜치를 만들고 Next.js 골격을 저장소 루트에 생성**

```bash
git checkout -b feat/m1-extraction
npx -y create-next-app@16.4.0 . --ts --app --src-dir --eslint --tailwind --import-alias "@/*" --use-npm --yes
```

기존 `docs/`가 있어도 그대로 생성된다(확인함). 생성 후 `AGENTS.md`, `next.config.ts`, `src/app/` 등이 생긴다. `AGENTS.md`는 지우지 말고 커밋한다.

- [ ] **Step 2: 의존성 설치**

```bash
npm i pdfjs-dist@6.4.299 wink-lemmatizer@3.0.4 better-sqlite3@13.0.3 drizzle-orm@0.45.4
npm i -D @types/node@24 vitest@5.0.4 drizzle-kit@0.31.11 tsx@4.23.15 @types/better-sqlite3@9.6.0
npm install-scripts approve better-sqlite3
npm rebuild better-sqlite3
node -e "const D=require('better-sqlite3');console.log(new D(':memory:').prepare('select 1 x').get())"
```

Expected 마지막 줄: `{ x: 1 }`

주의: npm 11은 설치 스크립트를 기본으로 막는다. `install-scripts approve`를 하지 않으면 better-sqlite3 네이티브 모듈이 없어 런타임에 실패한다. `@types/node`는 Vitest 5의 peer 조건(`^22 || >=24`) 때문에 24로 올린다.

- [ ] **Step 3: package.json scripts와 .gitignore 수정**

`package.json`의 `"scripts"`를 다음으로 바꾼다:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "typecheck": "next typegen && tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "freq:build": "tsx scripts/build-frequency.ts"
  },
```

`.gitignore` 끝에 추가:

```
# local database
/data/*.db
/data/*.db-*
```

- [ ] **Step 4: Vitest와 drizzle-kit 설정 파일 생성**

`vitest.config.mts` (`.mts`여야 Vite의 ESM 경고가 나지 않는다):

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

`drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
});
```

- [ ] **Step 5: 실패하는 테스트 작성** — `tests/lib/extract/lemma.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { lemmatize } from '@/lib/extract/lemma';
import { buildFrequencyMap } from '@/lib/extract/build-frequency-map';

describe('lemmatize', () => {
  it('merges inflected forms into one lemma', () => {
    expect(lemmatize('studies')).toBe('study');
    expect(lemmatize('studied')).toBe('study');
    expect(lemmatize('Analyses')).toBe('analysis');
    expect(lemmatize('leveraging')).toBe('leverage');
  });

  it('returns the lowercase word when no form applies', () => {
    expect(lemmatize('robust')).toBe('robust');
  });
});

describe('buildFrequencyMap', () => {
  it('ranks by line order and keeps the best rank for a lemma', () => {
    const map = buildFrequencyMap(['the', 'studies', 'study', 'x-ray', '']);
    expect(map.the).toBe(1);
    expect(map.studies).toBe(2);
    expect(map.study).toBe(2);
  });

  it('skips entries that are not plain letters', () => {
    const map = buildFrequencyMap(['x-ray', 'abc1']);
    expect(Object.keys(map)).toEqual([]);
  });
});
```

- [ ] **Step 6: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/extract/lemma'` 계열 오류

- [ ] **Step 7: 구현**

`src/types/wink-lemmatizer.d.ts`:

```ts
declare module 'wink-lemmatizer' {
  const lemmatizer: {
    noun(word: string): string;
    verb(word: string): string;
    adjective(word: string): string;
  };
  export default lemmatizer;
}
```

`src/lib/extract/lemma.ts`:

```ts
import lemmatizer from 'wink-lemmatizer';

// 명사 → 동사 → 형용사 순으로 시도해, 처음으로 형태가 바뀐 결과를 원형으로 쓴다.
export function lemmatize(word: string): string {
  const lower = word.toLowerCase();
  for (const fn of [lemmatizer.noun, lemmatizer.verb, lemmatizer.adjective]) {
    const lemma = fn(lower);
    if (lemma !== lower) return lemma;
  }
  return lower;
}
```

`src/lib/extract/build-frequency-map.ts`:

```ts
import { lemmatize } from './lemma';

// 빈도순 단어 목록(1번째 줄 = 1위)을 단어·원형 → 최고 순위 표로 바꾼다.
export function buildFrequencyMap(words: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  words.forEach((raw, index) => {
    const word = raw.trim().toLowerCase();
    if (!/^[a-z]+$/.test(word)) return;
    const rank = index + 1;
    for (const key of [word, lemmatize(word)]) {
      if (map[key] === undefined || map[key] > rank) map[key] = rank;
    }
  });
  return map;
}
```

단어 자체와 원형을 둘 다 키로 넣는 이유: `data`의 원형은 `datum`으로 바뀌는데, 원형만 저장하면 흔한 단어 `data`를 걸러내지 못한다(Review Focus 2).

- [ ] **Step 8: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (4 tests)

- [ ] **Step 9: 빈도표 생성 스크립트 작성과 실행**

`scripts/build-frequency.ts` (tsx가 CommonJS로 실행하므로 top-level await 대신 `main()`을 쓴다):

```ts
import { writeFileSync } from 'node:fs';
import { buildFrequencyMap } from '../src/lib/extract/build-frequency-map';

const SOURCE_URL =
  'https://raw.githubusercontent.com/first20hours/google-10000-english/master/20k.txt';

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`빈도 목록 다운로드 실패: HTTP ${res.status}`);
  const words = (await res.text()).split(/\r?\n/);
  const map = buildFrequencyMap(words);
  writeFileSync('data/frequency.json', JSON.stringify(map));
  console.log(`data/frequency.json: ${Object.keys(map).length}개 항목`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

```bash
mkdir -p data
npm run freq:build
node -e "const m=require('./data/frequency.json');console.log(m.the, m.data, m.robust, m.heterogeneous)"
```

Expected: `data/frequency.json: 20349개 항목`, 그리고 `1 131 7893 17360`

- [ ] **Step 10: 순위 조회 모듈 작성** — `src/lib/extract/frequency.ts`

```ts
import frequency from '../../../data/frequency.json';

export type RankOf = (word: string) => number | undefined;

const ranks = frequency as Record<string, number>;

// 빈도 순위(1 = 가장 흔함). 목록에 없으면 undefined.
export const rankOf: RankOf = (word) => ranks[word];
```

(이 모듈의 동작은 Task 5의 통합 테스트가 실제 빈도표로 검증한다.)

- [ ] **Step 11: 커밋**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with lemmatizer and frequency table"
```

---

### Task 2: PDF 파싱

**Files:**
- Create: `src/lib/pdf/parse.ts`
- Modify: `next.config.ts`
- Test: `tests/helpers/make-pdf.ts`, `tests/lib/pdf/parse.test.ts`

**Interfaces:**
- Produces: `class NoTextError extends Error`, `cleanText(raw: string): string`, `splitSentences(text: string): string[]`, `extractPdfText(bytes: Uint8Array): Promise<string>`, `parsePdf(bytes: Uint8Array): Promise<string[]>` (텍스트 부족 시 `NoTextError`를 던짐), 테스트 헬퍼 `makePdf(pages: string[][]): Uint8Array`

- [ ] **Step 1: 테스트용 PDF 생성기 작성** — `tests/helpers/make-pdf.ts`

```ts
// 테스트용 최소 PDF. pages[i]는 i번째 페이지의 줄 목록이다.
// 한 줄은 약 100자 이내로: 페이지 밖으로 나간 글자는 pdf.js가 추출하지 않는다.
export function makePdf(pages: string[][]): Uint8Array {
  const escape = (s: string) => s.replace(/[\\()]/g, (c) => '\\' + c);
  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontId = 3;
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  let next = 4;
  for (const lines of pages) {
    const stream =
      'BT /F1 10 Tf 40 760 Td 12 TL\n' +
      lines.map((l) => `(${escape(l)}) Tj T*`).join('\n') +
      '\nET';
    const contentId = next++;
    const pageId = next++;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
    pageIds.push(pageId);
  }
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
```

- [ ] **Step 2: 실패하는 테스트 작성** — `tests/lib/pdf/parse.test.ts`

```ts
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
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run tests/lib/pdf`
Expected: FAIL — `@/lib/pdf/parse`를 찾지 못함

- [ ] **Step 4: 구현** — `src/lib/pdf/parse.ts`

```ts
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
```

주의: 정리는 `task.destroy()`로 한다. pdfjs-dist 6에서는 `doc.destroy()`가 없다(확인함).

- [ ] **Step 5: next.config.ts에 pdf.js 외부 패키지와 업로드 크기 설정 추가**

`next.config.ts` 전체를 다음으로 바꾼다(`create-next-app`이 만든 `cacheComponents`, `partialPrefetching`, `turbopack` 설정은 유지):

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // pdf.js는 번들링하지 않고 Node에서 그대로 불러온다.
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    serverActions: {
      // PDF 50MB + multipart 오버헤드
      bodySizeLimit: "51mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (Task 1 포함 12 tests)

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: parse PDF text into cleaned sentences"
```

---

### Task 3: 후보 단어 추출

**Files:**
- Create: `src/lib/extract/extract.ts`
- Test: `tests/lib/extract/extract.test.ts`

**Interfaces:**
- Consumes: `lemmatize` (Task 1), `RankOf` (Task 1)
- Produces:

```ts
interface Candidate { lemma: string; surface: string; sentence: string; count: number; isExisting: boolean }
interface ExtractOptions { excludeTopN: number; rankOf: RankOf; knownLemmas: ReadonlySet<string>; existingLemmas: ReadonlySet<string> }
function extractCandidates(sentences: string[], opts: ExtractOptions): Candidate[]
```

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/lib/extract/extract.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { extractCandidates, type ExtractOptions } from '@/lib/extract/extract';

function options(overrides: Partial<ExtractOptions> = {}): ExtractOptions {
  const ranks: Record<string, number> = { the: 1, we: 2, model: 300, data: 131, datum: 131 };
  return {
    excludeTopN: 5000,
    rankOf: (w) => ranks[w],
    knownLemmas: new Set(),
    existingLemmas: new Set(),
    ...overrides,
  };
}

const lemmas = (sentences: string[], opts = options()) =>
  extractCandidates(sentences, opts).map((c) => c.lemma);

describe('extractCandidates', () => {
  it('drops words ranked within the top N and keeps rarer or unranked words', () => {
    const opts = options({ rankOf: (w) => ({ the: 1, robust: 7893 })[w] });
    expect(lemmas(['The robust heteroscedastic estimator.'], opts)).toEqual([
      'estimator',
      'heteroscedastic',
      'robust',
    ]);
    expect(lemmas(['The robust estimator.'], { ...opts, excludeTopN: 10000 })).toEqual([
      'estimator',
    ]);
  });

  it('skips short tokens, acronyms and hyphenated compounds', () => {
    expect(lemmas(['An CNN uses state-of-the-art ideas.'])).toEqual(['idea', 'use']);
  });

  it('merges inflected forms and counts every occurrence', () => {
    const result = extractCandidates(
      ['Prior studies exist.', 'We studied it again.'],
      options(),
    );
    const study = result.find((c) => c.lemma === 'study');
    expect(study).toMatchObject({ surface: 'studies', sentence: 'Prior studies exist.', count: 2 });
  });

  it('drops a common surface form even when its lemma looks rare', () => {
    expect(lemmas(['The data looked clean.'])).not.toContain('datum');
  });

  it('drops known lemmas', () => {
    expect(lemmas(['A robust result.'], options({ knownLemmas: new Set(['robust']) }))).toEqual([
      'result',
    ]);
  });

  it('drops words only ever capitalized mid-sentence as proper nouns', () => {
    const result = lemmas(['We thank Vaswani for comments.', 'Vaswani agreed.']);
    expect(result).not.toContain('vaswani');
  });

  it('keeps a rare word that is capitalized only at the start of a sentence', () => {
    expect(lemmas(['Notwithstanding this, it held.'])).toContain('notwithstanding');
  });

  it('marks lemmas that are already cards', () => {
    const result = extractCandidates(
      ['A robust result.'],
      options({ existingLemmas: new Set(['robust']) }),
    );
    expect(result.find((c) => c.lemma === 'robust')?.isExisting).toBe(true);
    expect(result.find((c) => c.lemma === 'result')?.isExisting).toBe(false);
  });

  it('truncates long sentences to 300 characters', () => {
    const long = `Robust ${'word '.repeat(100)}end.`;
    const [first] = extractCandidates([long], options());
    expect(first.sentence).toHaveLength(300);
    expect(first.sentence.endsWith('…')).toBe(true);
  });

  it('sorts by count, then alphabetically', () => {
    expect(lemmas(['Zeta alpha zeta beta.'])).toEqual(['zeta', 'alpha', 'beta']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/lib/extract/extract.test.ts`
Expected: FAIL — `@/lib/extract/extract`를 찾지 못함

- [ ] **Step 3: 구현** — `src/lib/extract/extract.ts`

```ts
import { lemmatize } from './lemma';
import type { RankOf } from './frequency';

export interface Candidate {
  lemma: string;
  surface: string;
  sentence: string;
  count: number;
  isExisting: boolean;
}

export interface ExtractOptions {
  excludeTopN: number;
  rankOf: RankOf;
  knownLemmas: ReadonlySet<string>;
  existingLemmas: ReadonlySet<string>;
}

const TOKEN = /[A-Za-z]+(?:-[A-Za-z]+)*/g;
const MIN_LENGTH = 3;
const MAX_SENTENCE_LENGTH = 300;

interface Tally {
  lemma: string;
  surface: string;
  sentence: string;
  count: number;
  seenLowercase: boolean;
  seenCapitalizedMidSentence: boolean;
}

function isCommon(word: string, opts: ExtractOptions): boolean {
  const rank = opts.rankOf(word);
  return rank !== undefined && rank <= opts.excludeTopN;
}

function truncate(sentence: string): string {
  return sentence.length <= MAX_SENTENCE_LENGTH
    ? sentence
    : `${sentence.slice(0, MAX_SENTENCE_LENGTH - 1)}…`;
}

export function extractCandidates(sentences: string[], opts: ExtractOptions): Candidate[] {
  const tallies = new Map<string, Tally>();

  for (const sentence of sentences) {
    let position = 0;
    for (const [token] of sentence.matchAll(TOKEN)) {
      const isFirst = position++ === 0;
      if (token.includes('-') || token.length < MIN_LENGTH) continue;
      if (token === token.toUpperCase()) continue; // 약어: CNN, BERT
      const lower = token.toLowerCase();
      if (isCommon(lower, opts)) continue; // data → datum처럼 원형이 드문 흔한 단어
      const lemma = lemmatize(lower);
      if (isCommon(lemma, opts) || opts.knownLemmas.has(lemma)) continue;

      let tally = tallies.get(lemma);
      if (!tally) {
        tally = {
          lemma,
          surface: lower,
          sentence: truncate(sentence),
          count: 0,
          seenLowercase: false,
          seenCapitalizedMidSentence: false,
        };
        tallies.set(lemma, tally);
      }
      tally.count++;
      if (token === lower) tally.seenLowercase = true;
      else if (!isFirst) tally.seenCapitalizedMidSentence = true;
    }
  }

  return [...tallies.values()]
    .filter((t) => t.seenLowercase || !t.seenCapitalizedMidSentence) // 고유명사 제외
    .map((t) => ({
      lemma: t.lemma,
      surface: t.surface,
      sentence: t.sentence,
      count: t.count,
      isExisting: opts.existingLemmas.has(t.lemma),
    }))
    .sort((a, b) => b.count - a.count || (a.lemma < b.lemma ? -1 : a.lemma > b.lemma ? 1 : 0));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (22 tests)

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: extract candidate words by frequency rank"
```

---

### Task 4: DB 스키마와 저장소 계층

**Files:**
- Create: `src/server/db/schema.ts`, `src/server/db/client.ts`, `src/server/repo/documents.ts`, `src/server/repo/candidates.ts`, `src/server/repo/settings.ts`, `src/server/repo/vocabulary.ts`, `drizzle/` (생성됨)
- Test: `tests/server/repo.test.ts`

**Interfaces:**
- Consumes: `Candidate` (Task 3)
- Produces:

```ts
type Db = BetterSQLite3Database<typeof schema>
createDb(file: string): Db            // ':memory:' 지원, 마이그레이션 자동 적용
getDb(): Db                           // 앱용 싱글턴, 기본 경로 data/app.db, 환경변수 SLAVE_VOCA_DB로 변경
type DocumentKind = 'paper' | 'presentation'
type DocumentStatus = 'extracting' | 'reviewing' | 'processing' | 'done' | 'error'
type DocumentRow, CandidateRow
createDocument(db, { title, kind }): DocumentRow
updateDocumentStatus(db, id, status, errorMessage?: string | null): void
getDocument(db, id): DocumentRow | undefined
listDocuments(db): DocumentRow[]                       // 최신순
replaceCandidates(db, documentId, list: Candidate[]): void
listCandidates(db, documentId): CandidateRow[]         // count 내림차순, lemma 오름차순
countCandidatesByDocument(db): Map<number, number>
interface Settings { excludeTopN: number; dailyNewLimit: number }
DEFAULT_SETTINGS: Settings
getSettings(db): Settings
listKnownLemmas(db): Set<string>
listWordLemmas(db): Set<string>
```

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/server/repo.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { knownWords, settings, words } from '@/server/db/schema';
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocumentStatus,
} from '@/server/repo/documents';
import {
  countCandidatesByDocument,
  listCandidates,
  replaceCandidates,
} from '@/server/repo/candidates';
import { DEFAULT_SETTINGS, getSettings } from '@/server/repo/settings';
import { listKnownLemmas, listWordLemmas } from '@/server/repo/vocabulary';

const candidate = (lemma: string, count: number) => ({
  lemma,
  surface: lemma,
  sentence: `A ${lemma} here.`,
  count,
  isExisting: false,
});

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

describe('documents repo', () => {
  it('creates a document in the extracting state and updates its status', () => {
    const doc = createDocument(db, { title: 'Paper', kind: 'paper' });
    expect(doc.status).toBe('extracting');
    updateDocumentStatus(db, doc.id, 'error', 'broken');
    expect(getDocument(db, doc.id)).toMatchObject({ status: 'error', errorMessage: 'broken' });
  });

  it('lists the newest document first', () => {
    const first = createDocument(db, { title: 'A', kind: 'paper' });
    const second = createDocument(db, { title: 'B', kind: 'presentation' });
    expect(listDocuments(db).map((d) => d.id)).toEqual([second.id, first.id]);
  });
});

describe('candidates repo', () => {
  it('replaces candidates and lists them by count, then lemma', () => {
    const doc = createDocument(db, { title: 'A', kind: 'paper' });
    replaceCandidates(db, doc.id, [candidate('old', 1)]);
    replaceCandidates(db, doc.id, [
      candidate('beta', 1),
      candidate('alpha', 1),
      candidate('zeta', 3),
    ]);
    expect(listCandidates(db, doc.id).map((c) => c.lemma)).toEqual(['zeta', 'alpha', 'beta']);
  });

  it('counts candidates per document', () => {
    const a = createDocument(db, { title: 'A', kind: 'paper' });
    const b = createDocument(db, { title: 'B', kind: 'paper' });
    replaceCandidates(db, a.id, [candidate('xenon', 1), candidate('xylem', 1)]);
    replaceCandidates(db, b.id, []);
    const counts = countCandidatesByDocument(db);
    expect(counts.get(a.id)).toBe(2);
    expect(counts.get(b.id)).toBeUndefined();
  });
});

describe('settings repo', () => {
  it('returns defaults when nothing is stored', () => {
    expect(getSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it('reads stored values and ignores invalid ones', () => {
    db.insert(settings)
      .values([
        { key: 'exclude_top_n', value: '3000' },
        { key: 'daily_new_limit', value: 'abc' },
      ])
      .run();
    expect(getSettings(db)).toEqual({ excludeTopN: 3000, dailyNewLimit: 20 });
  });
});

describe('vocabulary repo', () => {
  it('lists known lemmas and existing card lemmas', () => {
    db.insert(knownWords).values({ lemma: 'robust' }).run();
    db.insert(words).values({ lemma: 'paradigm' }).run();
    expect(listKnownLemmas(db)).toEqual(new Set(['robust']));
    expect(listWordLemmas(db)).toEqual(new Set(['paradigm']));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/server/repo.test.ts`
Expected: FAIL — `@/server/db/client`를 찾지 못함

- [ ] **Step 3: 스키마 작성** — `src/server/db/schema.ts`

```ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const DOCUMENT_KINDS = ['paper', 'presentation'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_STATUSES = ['extracting', 'reviewing', 'processing', 'done', 'error'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());

export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  kind: text('kind', { enum: DOCUMENT_KINDS }).notNull(),
  status: text('status', { enum: DOCUMENT_STATUSES }).notNull().default('extracting'),
  errorMessage: text('error_message'),
  createdAt: createdAt(),
});

export const candidates = sqliteTable('candidates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  lemma: text('lemma').notNull(),
  surface: text('surface').notNull(),
  sentence: text('sentence').notNull(),
  count: integer('count').notNull(),
  isExisting: integer('is_existing', { mode: 'boolean' }).notNull(),
});

// 카드. 복습(FSRS) 컬럼은 마일스톤 3에서 추가한다.
export const words = sqliteTable('words', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  lemma: text('lemma').notNull().unique(),
  phonetic: text('phonetic'),
  createdAt: createdAt(),
});

export const knownWords = sqliteTable('known_words', {
  lemma: text('lemma').primaryKey(),
  createdAt: createdAt(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type DocumentRow = typeof documents.$inferSelect;
export type CandidateRow = typeof candidates.$inferSelect;
```

`occurrences`, `review_logs` 테이블과 `words`의 FSRS 컬럼은 스펙 7장에 있지만 마일스톤 2~3에서 새 마이그레이션으로 추가한다(YAGNI).

- [ ] **Step 4: 마이그레이션 생성**

Run: `npm run db:generate -- --name init`
Expected: `drizzle/0000_init.sql`과 `drizzle/meta/` 생성

- [ ] **Step 5: DB 클라이언트 작성** — `src/server/db/client.ts`

```ts
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle');

// 배포로 옮길 때 바꾸는 곳은 이 파일과 스키마의 방언뿐이다.
export function createDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

const globalForDb = globalThis as { slaveVocaDb?: Db };

export function getDb(): Db {
  globalForDb.slaveVocaDb ??= createDb(
    process.env.SLAVE_VOCA_DB ?? path.join(process.cwd(), 'data', 'app.db'),
  );
  return globalForDb.slaveVocaDb;
}
```

`globalThis`에 두는 이유: `next dev`의 핫 리로드마다 연결을 새로 열지 않게 하려는 것이다.

- [ ] **Step 6: 저장소 함수 작성**

`src/server/repo/documents.ts`:

```ts
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  documents,
  type DocumentKind,
  type DocumentRow,
  type DocumentStatus,
} from '../db/schema';

export function createDocument(db: Db, input: { title: string; kind: DocumentKind }): DocumentRow {
  return db.insert(documents).values(input).returning().get();
}

export function updateDocumentStatus(
  db: Db,
  id: number,
  status: DocumentStatus,
  errorMessage: string | null = null,
): void {
  db.update(documents).set({ status, errorMessage }).where(eq(documents.id, id)).run();
}

export function getDocument(db: Db, id: number): DocumentRow | undefined {
  return db.select().from(documents).where(eq(documents.id, id)).get();
}

export function listDocuments(db: Db): DocumentRow[] {
  return db.select().from(documents).orderBy(desc(documents.createdAt), desc(documents.id)).all();
}
```

`src/server/repo/candidates.ts`:

```ts
import { asc, count, desc, eq } from 'drizzle-orm';
import type { Candidate } from '@/lib/extract/extract';
import type { Db } from '../db/client';
import { candidates, type CandidateRow } from '../db/schema';

export function replaceCandidates(db: Db, documentId: number, list: Candidate[]): void {
  db.transaction((tx) => {
    tx.delete(candidates).where(eq(candidates.documentId, documentId)).run();
    if (list.length > 0) {
      tx.insert(candidates)
        .values(list.map((c) => ({ ...c, documentId })))
        .run();
    }
  });
}

export function listCandidates(db: Db, documentId: number): CandidateRow[] {
  return db
    .select()
    .from(candidates)
    .where(eq(candidates.documentId, documentId))
    .orderBy(desc(candidates.count), asc(candidates.lemma))
    .all();
}

export function countCandidatesByDocument(db: Db): Map<number, number> {
  const rows = db
    .select({ documentId: candidates.documentId, total: count() })
    .from(candidates)
    .groupBy(candidates.documentId)
    .all();
  return new Map(rows.map((r) => [r.documentId, r.total]));
}
```

`src/server/repo/settings.ts`:

```ts
import type { Db } from '../db/client';
import { settings } from '../db/schema';

export interface Settings {
  excludeTopN: number;
  dailyNewLimit: number;
}

export const DEFAULT_SETTINGS: Settings = { excludeTopN: 5000, dailyNewLimit: 20 };

const KEYS: Record<keyof Settings, string> = {
  excludeTopN: 'exclude_top_n',
  dailyNewLimit: 'daily_new_limit',
};

export function getSettings(db: Db): Settings {
  const stored = new Map(db.select().from(settings).all().map((r) => [r.key, r.value]));
  const read = (key: keyof Settings) => {
    const value = Number(stored.get(KEYS[key]));
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_SETTINGS[key];
  };
  return { excludeTopN: read('excludeTopN'), dailyNewLimit: read('dailyNewLimit') };
}
```

`src/server/repo/vocabulary.ts`:

```ts
import type { Db } from '../db/client';
import { knownWords, words } from '../db/schema';

export function listKnownLemmas(db: Db): Set<string> {
  return new Set(db.select({ lemma: knownWords.lemma }).from(knownWords).all().map((r) => r.lemma));
}

export function listWordLemmas(db: Db): Set<string> {
  return new Set(db.select({ lemma: words.lemma }).from(words).all().map((r) => r.lemma));
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (29 tests)

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: add SQLite schema and repositories"
```

---

### Task 5: 업로드 처리 서비스

**Files:**
- Create: `src/server/services/ingest.ts`
- Test: `tests/server/ingest.test.ts`

**Interfaces:**
- Consumes: `parsePdf`, `NoTextError` (Task 2), `extractCandidates` (Task 3), `rankOf` (Task 1), Task 4의 저장소 함수 전부
- Produces:

```ts
const MAX_PDF_BYTES = 50 * 1024 * 1024
class UploadError extends Error            // 사용자에게 그대로 보여줄 메시지
interface IngestInput { fileName: string; title: string; kind: DocumentKind; bytes: Uint8Array }
interface IngestResult { documentId: number; status: DocumentStatus }
validateUpload(bytes: Uint8Array): void   // 실패 시 UploadError
defaultTitle(fileName: string): string
ingestPdf(db: Db, input: IngestInput): Promise<IngestResult>
```

동작: 검증 실패는 문서를 만들지 않고 `UploadError`를 던진다. 검증을 통과하면 문서를 만들고, 처리 중 실패는 던지지 않고 문서를 `error` 상태(메시지 포함)로 남긴 뒤 결과를 반환한다.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/server/ingest.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { knownWords } from '@/server/db/schema';
import { listCandidates } from '@/server/repo/candidates';
import { getDocument, listDocuments } from '@/server/repo/documents';
import {
  defaultTitle,
  ingestPdf,
  MAX_PDF_BYTES,
  UploadError,
} from '@/server/services/ingest';
import { makePdf } from '../helpers/make-pdf';

// 실제 빈도표(data/frequency.json)를 쓴다. heterogeneous·perturbation은 상위 5,000 밖이다.
const PAPER = [
  'This paper examines heterogeneous datasets with rigor.',
  'The proposed estimator remains stable under perturbations.',
  'We evaluate heterogeneous perturbations on several benchmarks.',
  'Results confirm that the estimator generalizes across domains.',
];

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

const input = (bytes: Uint8Array, title = '') => ({
  fileName: 'attention.pdf',
  title,
  kind: 'paper' as const,
  bytes,
});

describe('ingestPdf', () => {
  it('stores candidates and moves the document to reviewing', async () => {
    const result = await ingestPdf(db, input(makePdf([PAPER])));
    expect(result.status).toBe('reviewing');
    const lemmas = listCandidates(db, result.documentId).map((c) => c.lemma);
    expect(lemmas).toContain('heterogeneous');
    expect(lemmas).toContain('perturbation');
    expect(lemmas).not.toContain('paper');
  });

  it('uses the file name when the title is blank', async () => {
    const result = await ingestPdf(db, input(makePdf([PAPER]), '   '));
    expect(getDocument(db, result.documentId)?.title).toBe('attention');
  });

  it('skips lemmas the user already knows', async () => {
    db.insert(knownWords).values({ lemma: 'heterogeneous' }).run();
    const result = await ingestPdf(db, input(makePdf([PAPER])));
    const lemmas = listCandidates(db, result.documentId).map((c) => c.lemma);
    expect(lemmas).not.toContain('heterogeneous');
  });

  it('marks the document done when nothing is left to learn', async () => {
    const common = Array(6).fill('The people of the world have a good time and work.');
    const result = await ingestPdf(db, input(makePdf([common])));
    expect(result.status).toBe('done');
    expect(listCandidates(db, result.documentId)).toEqual([]);
  });

  it('records a readable error for a PDF without text', async () => {
    const result = await ingestPdf(db, input(makePdf([['Figure 1']])));
    expect(result.status).toBe('error');
    expect(getDocument(db, result.documentId)?.errorMessage).toContain('스캔 PDF');
  });

  it('records a generic error for a corrupt PDF', async () => {
    const corrupt = new TextEncoder().encode('%PDF-1.4\nthis is not really a pdf');
    const result = await ingestPdf(db, input(corrupt));
    expect(result.status).toBe('error');
    expect(getDocument(db, result.documentId)?.errorMessage).toBe('PDF를 처리하지 못했습니다.');
  });

  it('rejects files that are not PDFs without creating a document', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    await expect(ingestPdf(db, input(png))).rejects.toThrow('PDF 파일이 아닙니다.');
    expect(listDocuments(db)).toEqual([]);
  });

  it('rejects empty and oversized files', async () => {
    await expect(ingestPdf(db, input(new Uint8Array()))).rejects.toBeInstanceOf(UploadError);
    const huge = new Uint8Array(MAX_PDF_BYTES + 1);
    huge.set(new TextEncoder().encode('%PDF-'));
    await expect(ingestPdf(db, input(huge))).rejects.toThrow('50MB');
  });
});

describe('defaultTitle', () => {
  it('strips the .pdf extension', () => {
    expect(defaultTitle('My Paper.PDF')).toBe('My Paper');
    expect(defaultTitle('.pdf')).toBe('제목 없음');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/server/ingest.test.ts`
Expected: FAIL — `@/server/services/ingest`를 찾지 못함

- [ ] **Step 3: 구현** — `src/server/services/ingest.ts`

```ts
import { extractCandidates } from '@/lib/extract/extract';
import { rankOf } from '@/lib/extract/frequency';
import { NoTextError, parsePdf } from '@/lib/pdf/parse';
import type { Db } from '../db/client';
import type { DocumentKind, DocumentStatus } from '../db/schema';
import { replaceCandidates } from '../repo/candidates';
import { createDocument, updateDocumentStatus } from '../repo/documents';
import { getSettings } from '../repo/settings';
import { listKnownLemmas, listWordLemmas } from '../repo/vocabulary';

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

export interface IngestInput {
  fileName: string;
  title: string;
  kind: DocumentKind;
  bytes: Uint8Array;
}

export interface IngestResult {
  documentId: number;
  status: DocumentStatus;
}

const PDF_MAGIC = '%PDF-';

export function validateUpload(bytes: Uint8Array): void {
  if (bytes.length === 0) throw new UploadError('PDF 파일을 선택하세요.');
  if (bytes.length > MAX_PDF_BYTES) throw new UploadError('50MB 이하의 PDF만 올릴 수 있습니다.');
  const head = new TextDecoder().decode(bytes.subarray(0, PDF_MAGIC.length));
  if (head !== PDF_MAGIC) throw new UploadError('PDF 파일이 아닙니다.');
}

export function defaultTitle(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').trim() || '제목 없음';
}

// 업로드 검증 → 문서 생성 → 문장 추출 → 후보 저장. 처리 실패는 문서 상태(error)로 남긴다.
export async function ingestPdf(db: Db, input: IngestInput): Promise<IngestResult> {
  validateUpload(input.bytes);
  const title = input.title.trim() || defaultTitle(input.fileName);
  const doc = createDocument(db, { title, kind: input.kind });

  try {
    const sentences = await parsePdf(input.bytes);
    const settings = getSettings(db);
    const found = extractCandidates(sentences, {
      excludeTopN: settings.excludeTopN,
      rankOf,
      knownLemmas: listKnownLemmas(db),
      existingLemmas: listWordLemmas(db),
    });
    replaceCandidates(db, doc.id, found);
    const status: DocumentStatus = found.length === 0 ? 'done' : 'reviewing';
    updateDocumentStatus(db, doc.id, status);
    return { documentId: doc.id, status };
  } catch (err) {
    if (!(err instanceof NoTextError)) console.error('PDF 처리 실패', err);
    const message = err instanceof NoTextError ? err.message : 'PDF를 처리하지 못했습니다.';
    updateDocumentStatus(db, doc.id, 'error', message);
    return { documentId: doc.id, status: 'error' };
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (38 tests). "corrupt PDF" 테스트에서 `PDF 처리 실패` 로그가 찍히는 것은 정상이다.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: ingest uploaded PDFs into candidate lists"
```

---

### Task 6: 화면 (업로드·문서 목록·검토)

**Files:**
- Create: `src/lib/text/highlight.ts`, `src/app/documents/actions.ts`, `src/app/documents/upload-form.tsx`, `src/app/documents/page.tsx`, `src/app/documents/[id]/review/page.tsx`, `src/app/documents/[id]/review/candidate-table.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`
- Test: `tests/lib/text/highlight.test.ts`

**Interfaces:**
- Consumes: `getDb` (Task 4), `ingestPdf`, `UploadError`, `IngestResult` (Task 5), `listDocuments`, `getDocument`, `listCandidates`, `countCandidatesByDocument` (Task 4)
- Produces: `highlight(sentence: string, word: string): { text: string; match: boolean }[]`, Server Action `uploadDocument(prev: UploadState, formData: FormData): Promise<UploadState>`

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/lib/text/highlight.test.ts`

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/lib/text`
Expected: FAIL — `@/lib/text/highlight`를 찾지 못함

- [ ] **Step 3: 구현** — `src/lib/text/highlight.ts`

```ts
export interface Segment {
  text: string;
  match: boolean;
}

// 문장에서 word와 같은 단어(대소문자 무시)를 표시용 조각으로 나눈다.
export function highlight(sentence: string, word: string): Segment[] {
  const pattern = new RegExp(`\\b(${word.replace(/[^A-Za-z-]/g, '')})\\b`, 'gi');
  return sentence
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, match: part.toLowerCase() === word.toLowerCase() }));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (40 tests)

- [ ] **Step 5: 레이아웃과 홈 화면 교체**

`src/app/layout.tsx` 전체:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "slave-voca",
  description: "논문·발표 자료 단어장",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <nav className="flex gap-6 border-b px-8 py-4 text-sm">
          <Link href="/" className="font-semibold">
            slave-voca
          </Link>
          <Link href="/documents">문서</Link>
        </nav>
        <div className="mx-auto w-full max-w-5xl flex-1 px-8 py-8">{children}</div>
      </body>
    </html>
  );
}
```

(`create-next-app`이 넣은 Geist 폰트는 쓰지 않는다. `globals.css`의 `--font-geist-*` 참조는 그대로 둬도 동작한다.)

`src/app/page.tsx` 전체:

```tsx
import Link from "next/link";

// 오늘의 복습 요약은 마일스톤 3에서 채운다.
export default function Home() {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">slave-voca</h1>
      <p>논문·발표 PDF를 올리면 외울 단어를 뽑아줍니다.</p>
      <Link href="/documents" className="inline-block rounded bg-black px-4 py-2 text-white">
        문서 올리기
      </Link>
    </main>
  );
}
```

- [ ] **Step 6: 업로드 Server Action과 폼 작성**

`src/app/documents/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { ingestPdf, UploadError, type IngestResult } from "@/server/services/ingest";

export interface UploadState {
  error: string | null;
}

export async function uploadDocument(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "PDF 파일을 선택하세요." };
  }
  const kind = formData.get("kind") === "presentation" ? "presentation" : "paper";
  const title = String(formData.get("title") ?? "");

  let result: IngestResult;
  try {
    result = await ingestPdf(getDb(), {
      fileName: file.name,
      title,
      kind,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  } catch (err) {
    if (err instanceof UploadError) return { error: err.message };
    throw err;
  }

  revalidatePath("/documents");
  if (result.status === "reviewing") redirect(`/documents/${result.documentId}/review`);
  return { error: null };
}
```

`redirect`는 내부적으로 예외를 던지므로 반드시 `try` 밖에서 호출한다.

`src/app/documents/upload-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { uploadDocument, type UploadState } from "./actions";

const initialState: UploadState = { error: null };

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadDocument, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" name="file" accept="application/pdf,.pdf" required />
        <select name="kind" defaultValue="paper" className="rounded border px-2 py-1">
          <option value="paper">논문</option>
          <option value="presentation">발표</option>
        </select>
        <input
          type="text"
          name="title"
          placeholder="제목 (비우면 파일 이름)"
          className="min-w-64 flex-1 rounded border px-2 py-1"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-1 text-white disabled:opacity-50"
        >
          {pending ? "단어 추출 중…" : "올리기"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 7: 문서 목록 화면 작성** — `src/app/documents/page.tsx`

```tsx
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/server/db/client";
import type { DocumentStatus } from "@/server/db/schema";
import { countCandidatesByDocument } from "@/server/repo/candidates";
import { listDocuments } from "@/server/repo/documents";
import { UploadForm } from "./upload-form";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  extracting: "추출 중",
  reviewing: "검토 대기",
  processing: "처리 중",
  done: "완료",
  error: "오류",
};

export default function DocumentsPage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">문서</h1>
      <UploadForm />
      <Suspense fallback={<p>불러오는 중…</p>}>
        <DocumentList />
      </Suspense>
    </main>
  );
}

async function DocumentList() {
  await connection();
  const db = getDb();
  const docs = listDocuments(db);
  const counts = countCandidatesByDocument(db);

  if (docs.length === 0) return <p className="text-gray-500">아직 올린 문서가 없습니다.</p>;

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b">
          <th className="py-2">제목</th>
          <th>종류</th>
          <th>상태</th>
          <th>후보 단어</th>
          <th>올린 날짜</th>
        </tr>
      </thead>
      <tbody>
        {docs.map((doc) => (
          <tr key={doc.id} className="border-b">
            <td className="py-2">
              {doc.status === "reviewing" ? (
                <Link href={`/documents/${doc.id}/review`} className="underline">
                  {doc.title}
                </Link>
              ) : (
                doc.title
              )}
            </td>
            <td>{doc.kind === "paper" ? "논문" : "발표"}</td>
            <td>
              {STATUS_LABEL[doc.status]}
              {doc.errorMessage && (
                <span className="block text-xs text-red-600">{doc.errorMessage}</span>
              )}
            </td>
            <td>{counts.get(doc.id) ?? 0}</td>
            <td>{doc.createdAt.toLocaleDateString("ko-KR")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

`await connection()`이 없으면 Next 16(`cacheComponents: true`)이 빌드 때 DB 결과를 정적 페이지에 굳힌다. better-sqlite3 같은 동기 DB도 마찬가지다(`node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` 참고).

- [ ] **Step 8: 검토 화면 작성**

`src/app/documents/[id]/review/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/server/db/client";
import { listCandidates } from "@/server/repo/candidates";
import { getDocument } from "@/server/repo/documents";
import { CandidateTable } from "./candidate-table";

export default function ReviewPage({ params }: PageProps<"/documents/[id]/review">) {
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <Review params={params} />
    </Suspense>
  );
}

async function Review({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const db = getDb();
  const doc = getDocument(db, id);
  if (!doc) notFound();
  const candidates = listCandidates(db, id);

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">{doc.title} · 단어 검토</h1>
      {candidates.length === 0 ? (
        <p>외울 단어가 없습니다.</p>
      ) : (
        <CandidateTable
          candidates={candidates.map((c) => ({
            id: c.id,
            lemma: c.lemma,
            surface: c.surface,
            sentence: c.sentence,
            count: c.count,
            isExisting: c.isExisting,
          }))}
        />
      )}
    </main>
  );
}
```

`src/app/documents/[id]/review/candidate-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import { highlight } from "@/lib/text/highlight";

export interface CandidateView {
  id: number;
  lemma: string;
  surface: string;
  sentence: string;
  count: number;
  isExisting: boolean;
}

export function CandidateTable({ candidates }: { candidates: CandidateView[] }) {
  const [selected, setSelected] = useState(() => new Set(candidates.map((c) => c.id)));
  const allSelected = selected.size === candidates.length;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(candidates.map((c) => c.id)));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <button type="button" onClick={toggleAll} className="rounded border px-3 py-1">
          {allSelected ? "전체 해제" : "전체 선택"}
        </button>
        <span>
          {candidates.length}개 중 {selected.size}개 선택 · 체크를 해제한 단어는 아는 단어로
          처리됩니다
        </span>
        {/* 저장은 마일스톤 2에서 연결한다. */}
        <button
          type="button"
          disabled
          title="마일스톤 2에서 연결됩니다"
          className="ml-auto rounded bg-black px-4 py-1 text-white opacity-50"
        >
          저장
        </button>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="w-8 py-2" />
            <th>단어</th>
            <th>횟수</th>
            <th>원문 문장</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id} className="border-b align-top">
              <td className="py-2">
                <input
                  type="checkbox"
                  aria-label={`${c.lemma} 선택`}
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
              </td>
              <td className="py-2 font-medium">
                {c.lemma}
                {c.isExisting && (
                  <span className="ml-2 rounded bg-gray-200 px-1 text-xs">이미 학습 중</span>
                )}
              </td>
              <td className="py-2">{c.count}</td>
              <td className="py-2">
                {highlight(c.sentence, c.surface).map((seg, i) =>
                  seg.match ? (
                    <mark key={i}>{seg.text}</mark>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 9: 타입·린트·빌드 확인**

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: 타입 오류 0, 린트 오류 0, 빌드 성공. 빌드 출력의 라우트 표에서 `/documents`와 `/documents/[id]/review`가 `◐ (Partial Prerender)`로 나와야 한다. `typecheck`는 `next typegen`으로 `PageProps`/`LayoutProps` 라우트 타입을 먼저 만든다. 이 단계 없이 `tsc`만 돌리면 `PageProps` 타입 오류가 난다.

- [ ] **Step 10: 직접 실행해 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000/documents`를 연다.
1. 아무 텍스트 PDF를 올린다 → 검토 화면으로 이동하고 후보 표가 보인다. 체크박스, 전체 선택/해제, 원문 문장의 단어 강조가 동작한다.
2. `.png` 파일 이름을 `.pdf`로 바꿔 올린다 → 폼 아래에 "PDF 파일이 아닙니다." 표시, 문서 목록에 행이 생기지 않는다.
3. 문서 목록으로 돌아가면 상태 "검토 대기"와 후보 단어 수가 보인다.

- [ ] **Step 11: 커밋**

```bash
git add -A
git commit -m "feat: add upload, document list and review screens"
```

---

### Task 7: 실제 논문으로 추출 품질 확인

스펙 10장의 수동 확인이다. 결과에 따라 마일스톤 2 계획(제외 기준 N, 추가 필터 규칙)이 바뀐다.

**Files:**
- Create: `docs/superpowers/notes/2026-10-13-m1-extraction-check.md`

- [ ] **Step 1: 논문 3편 내려받기** (저장소 밖 임시 폴더에. 커밋하지 않는다)

| 논문 | 형식 | URL |
|---|---|---|
| Attention Is All You Need | 1단 | https://arxiv.org/pdf/1706.03762 |
| Deep Residual Learning (ResNet) | 2단 | https://arxiv.org/pdf/1512.03385 |
| BERT | 2단 | https://arxiv.org/pdf/1810.04805 |

참고: 계획 작성 시 ResNet으로 확인한 값은 문장 331개, 후보 205개, 파싱+추출 약 0.7초였다. 상위 후보에 `conv`, `relu`, `iter`, `err`, `std` 같은 약칭이 섞여 있었다.

- [ ] **Step 2: `npm run dev`로 세 편을 차례로 올리고 다음을 기록**

각 논문마다:
- 업로드부터 검토 화면이 뜰 때까지 걸린 시간
- 후보 단어 수
- 상위 30개 후보 중 외울 가치가 없는 단어(오탐) 수와 유형: 약칭(`conv`), 수식 기호, 저자명, 단어가 잘린 조각, 2단 편집 때문에 섞인 문장 등
- 외울 만한데 빠진 단어가 눈에 띄면 그 예시

- [ ] **Step 3: 결과 문서 작성** — `docs/superpowers/notes/2026-10-13-m1-extraction-check.md`

아래 틀을 채운다:

```markdown
# 마일스톤 1 추출 품질 확인 (2026-10-13)

| 논문 | 형식 | 처리 시간 | 후보 수 | 상위 30 중 오탐 |
|---|---|---|---|---|
| Attention Is All You Need | 1단 | (초) | (개) | (개) |
| ResNet | 2단 | (초) | (개) | (개) |
| BERT | 2단 | (초) | (개) | (개) |

## 오탐 유형
- (유형): (예시 단어들)

## 빠진 단어
- (예시)

## 제안
- 제외 기준 N: (5,000 유지 / 변경값과 이유)
- 추가 필터 규칙: (예: 4글자 이하 약칭 제외 등. 없으면 "없음")
```

- [ ] **Step 4: 커밋하고 PM에게 보고**

```bash
git add docs/superpowers/notes/2026-10-13-m1-extraction-check.md
git commit -m "docs: record milestone 1 extraction quality check"
```

결과 문서의 "제안" 섹션을 PM(ProjectManager 세션)에게 전달한다. 마일스톤 2 계획서는 이 결과를 반영해 작성한다.
