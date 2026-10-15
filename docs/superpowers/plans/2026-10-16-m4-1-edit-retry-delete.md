# 마일스톤 4-1: 뜻 고치기·다시 만들기·카드 삭제 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 저장한 뜻을 믿고 매일 복습할 수 있게 한다. 문서 단어 목록에 뜻 직접 수정, 실패한 뜻 다시 만들기(단어 하나·문서 전체), 카드 삭제를 붙이고, 발음기호는 CMUdict를 먼저 쓴다. 작은 버그 2건과 저장 입력 검사도 고친다.

**Architecture:** 기존 구조 그대로다. 입력 검사(`lib/validate.ts`)와 키 판단(`lib/ui/keys.ts`)은 순수 함수, DB 변경은 `server/repo/cards.ts`, 뜻 생성 재사용은 `server/services/enrich.ts`에 둔다. 화면은 `documents/[id]`의 Server Action 3개(`editMeaning`, `retryFailedMeanings`, `removeCard`)와 클라이언트 표(`WordTable`)로 만든다. 모든 Server Action은 인자를 `unknown`으로 받아 형태부터 확인한다.

**Tech Stack:** 기존 스택 그대로(새 의존성 없음)

**Spec:** `docs/superpowers/specs/2026-10-13-slave-voca-design.md` 11장 M4(1순위 항목), UI 개편안 `docs/superpowers/specs/2026-10-15-ui-redesign.md` 5.4·5.6, 목업 `docs/superpowers/mockups/a-paper.html` 4·6번

## Global Constraints

- 작업 브랜치: `feat/m4-1-edit-retry-delete` (main에서 분기). 태스크마다 커밋한다.
- 리뷰는 Codex로 받는다: 커밋 전 `/codex:review`, 브랜치 전체는 `/codex:adversarial-review`(범위 지정). Important 이상은 테스트를 먼저 써서 고친다.
- 직접 고친 뜻: 앞뒤 공백 제거, NFC, 1~40자, 한 줄. 상태는 `done`.
- 카드 삭제: `words` 행을 지우면 외래 키 `ON DELETE CASCADE`로 모든 문서의 용례와 복습 기록이 함께 지워진다. 삭제한 단어는 아는 단어(`known_words`)에 넣지 않는다(설계서 7장).
- 다시 만들기: 지금 뜻 생성 경로(묶음 200, 재시도, 깨진 글자 검사, B1 지시)를 그대로 쓴다. 키가 없으면 아무것도 바꾸지 않고 안내한다.
- 발음기호: CMUdict를 먼저 찾고, 없는 단어만 사전 API(차단기 포함)로 찾는다.
- 용례 id는 반드시 그 문서 것인지 확인한다(다른 문서의 id로 고치기·다시 시도 금지).
- 색은 토큰만, 단축키는 입력칸에서 끈다(UI 개편 규칙 그대로).
- 실제 API 호출은 Task 6에서만 한다. 키 값은 출력하지 않는다.

## Review Focus

1. 다른 문서의 용례 id로 뜻을 고치거나 다시 만들기: 막혀야 한다(Task 2 `occurrencesBelongTo`, Task 4 action에서 사용).
2. 카드 삭제가 다른 문서의 용례와 복습 기록까지 지우는지, 그리고 아는 단어로는 넣지 않는지(Task 2 `deleteCard` 테스트). 대화상자에 "다른 문서의 용례도 함께 지워집니다"를 보여 준다(Task 4).
3. 저장 Action에 배열이 아닌 값이 오면 "아무것도 선택 안 함"으로 읽혀 후보 전체가 아는 단어가 될 수 있었다. 이제 거부해야 한다(Task 1 `parseIdList`, Task 5).
4. 응답할 때마다 레이아웃을 다시 그리면 복습 세션 상태가 초기화될 수 있다. 진행 표시가 "1 / 20"처럼 이어져야 한다(Task 6 확인. PM이 작성 중 확인함).
5. CMUdict 파일을 읽지 못해도 저장 전체가 오류가 되면 안 되고, API로 넘어가야 한다(Task 1 `withCmudictFirst` 테스트).

---

## 파일 구조

| 파일 | 책임 | 태스크 |
|---|---|---|
| `src/lib/validate.ts` | id·id 목록·직접 고친 뜻 검사 | 1 |
| `src/lib/ui/keys.ts` | `isNativeEnterTarget`(링크 포함) 추가 | 1 |
| `src/lib/phonetic/cmudict.ts` | `withCmudictFallback` → `withCmudictFirst` | 1 |
| `src/server/repo/cards.ts` | `wordId` 노출, 뜻 수정, 실패 목록, 소속 확인, 카드별 용례 수, 카드 삭제 | 2 |
| `src/server/services/enrich.ts` | CMUdict 우선, `defaultMeaningModel`, `retryMeanings` | 1, 3 |
| `src/app/documents/[id]/{actions.ts, word-table.tsx, retry-all-button.tsx, page.tsx}` | 단어 목록 화면 | 4 |
| `src/app/documents/[id]/review/actions.ts`, `src/app/study/{actions.ts, study-session.tsx}` | 저장 입력 검사, 메뉴 배지 갱신, 완료 화면 Enter | 5 |

테스트 수: 시작 144 → Task 1 후 149 → Task 2 후 155 → Task 3 후 158.

---

### Task 1: 입력 검사, Enter 대상 판단, CMUdict 우선

**Files:**
- Create: `src/lib/validate.ts`, `tests/lib/validate.test.ts`
- Modify: `src/lib/ui/keys.ts`(함수 추가), `tests/lib/ui/keys.test.ts`(테스트 추가), `src/lib/phonetic/cmudict.ts`(전체 교체), `tests/lib/phonetic/cmudict.test.ts`(마지막 describe 교체), `src/server/services/enrich.ts`(Task 3에서 전체 교체. 여기서는 import 한 줄과 한 곳)

**Interfaces:**
- Produces: `isId(v): v is number`, `parseIdList(v): number[] | null`, `MAX_MEANING_LENGTH = 40`, `normalizeMeaningInput(v): string | null`, `isNativeEnterTarget(target): boolean`, `withCmudictFirst(apiLookup, primary?)`

- [ ] **Step 1: 브랜치**

```bash
git checkout main
git checkout -b feat/m4-1-edit-retry-delete
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/lib/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isId, MAX_MEANING_LENGTH, normalizeMeaningInput, parseIdList } from '@/lib/validate';

describe('isId and parseIdList', () => {
  it('accepts positive integer ids and removes duplicates', () => {
    expect(isId(3)).toBe(true);
    expect(parseIdList([3, 1, 3])).toEqual([3, 1]);
    expect(parseIdList([])).toEqual([]);
  });

  it('rejects anything else', () => {
    expect(isId(0)).toBe(false);
    expect(isId(1.5)).toBe(false);
    expect(isId('3')).toBe(false);
    expect(parseIdList('1,2')).toBeNull();
    expect(parseIdList([1, '2'])).toBeNull();
    expect(parseIdList([1, -2])).toBeNull();
    expect(parseIdList(null)).toBeNull();
  });
});

describe('normalizeMeaningInput', () => {
  it('trims and composes Hangul', () => {
    expect(normalizeMeaningInput('  수열 ')).toBe('수열');
    expect(normalizeMeaningInput('수열'.normalize('NFD'))).toBe('수열');
  });

  it('rejects empty, multi-line, too long or non-string input', () => {
    expect(normalizeMeaningInput('   ')).toBeNull();
    expect(normalizeMeaningInput('한 줄\n두 줄')).toBeNull();
    expect(normalizeMeaningInput('가'.repeat(MAX_MEANING_LENGTH + 1))).toBeNull();
    expect(normalizeMeaningInput('가'.repeat(MAX_MEANING_LENGTH))).toHaveLength(MAX_MEANING_LENGTH);
    expect(normalizeMeaningInput(42)).toBeNull();
  });
});
```

`tests/lib/ui/keys.test.ts`: import를 `import { isNativeEnterTarget, isNativeSpaceTarget, isTypingTarget } from '@/lib/ui/keys';`로 바꾸고 맨 끝에 추가:

```ts
describe('isNativeEnterTarget', () => {
  it('also covers links, where Enter follows the link', () => {
    expect(isNativeEnterTarget({ tagName: 'A' })).toBe(true);
    expect(isNativeEnterTarget({ tagName: 'BUTTON' })).toBe(true);
    expect(isNativeEnterTarget({ tagName: 'BODY' })).toBe(false);
    expect(isNativeEnterTarget(null)).toBe(false);
  });
});
```

`tests/lib/phonetic/cmudict.test.ts`: import의 `withCmudictFallback`를 `withCmudictFirst`로 바꾸고, 마지막 `describe('withCmudictFallback', …)` 블록 전체를 아래로 교체:

```ts
describe('withCmudictFirst', () => {
  it('uses CMUdict first and only calls the API when CMUdict has nothing', async () => {
    const asked: string[] = [];
    const api = async (w: string) => {
      asked.push(w);
      return w === 'dmodel' ? null : '/api/';
    };
    const lookup = withCmudictFirst(api, (w) => (w === 'robust' ? '/roʊˈbʌst/' : null));
    expect(await lookup('robust')).toBe('/roʊˈbʌst/');
    expect(await lookup('softmax')).toBe('/api/');
    expect(await lookup('dmodel')).toBeNull();
    expect(asked).toEqual(['softmax', 'dmodel']);
  });

  it('falls back to the API and logs once when CMUdict itself fails', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const lookup = withCmudictFirst(async () => '/api/', () => {
      throw new Error('cmudict.txt not found');
    });
    expect(await lookup('robust')).toBe('/api/');
    expect(await lookup('paradigm')).toBe('/api/');
    expect(errors).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });
});
```

Run: `npm test`
Expected: FAIL — `@/lib/validate` 없음, `isNativeEnterTarget`·`withCmudictFirst` 없음

- [ ] **Step 3: 구현**

`src/lib/validate.ts`:

```ts
// Server Action은 브라우저에서 아무 값이나 받을 수 있으므로, DB에 닿기 전에 형태를 확인한다.

export function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

// 양의 정수 배열만 받는다. 중복은 하나로 줄인다. 형태가 다르면 null.
export function parseIdList(value: unknown): number[] | null {
  if (!Array.isArray(value) || !value.every(isId)) return null;
  return [...new Set(value)];
}

export const MAX_MEANING_LENGTH = 40;

// 직접 고친 뜻: 앞뒤 공백을 지우고 NFC로 합친다. 비었거나 줄바꿈이 있거나 너무 길면 null.
export function normalizeMeaningInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.normalize('NFC').trim();
  if (text.length === 0 || text.length > MAX_MEANING_LENGTH || /[\r\n]/.test(text)) return null;
  return text;
}
```

`src/lib/ui/keys.ts` 맨 끝에 추가:

```ts
// Enter는 포커스된 버튼·링크·체크박스를 브라우저가 누른다. 그 위에서는 Enter 단축키를 쓰지 않는다.
export function isNativeEnterTarget(target: KeyTarget | null): boolean {
  return target?.tagName?.toUpperCase() === 'A' || isNativeSpaceTarget(target);
}
```

`src/lib/phonetic/cmudict.ts` 전체:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { arpabetToIpa } from './arpabet';

export type PhoneticSource = (word: string) => string | null;

// "word PH ONES" 줄 목록으로 조회 함수를 만든다. 같은 단어가 여러 번 나오면 첫 줄을 쓴다.
export function createCmudict(text: string): PhoneticSource {
  const entries = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const space = line.indexOf(' ');
    if (space <= 0) continue;
    const word = line.slice(0, space);
    if (!entries.has(word)) entries.set(word, line.slice(space + 1));
  }
  return (word) => {
    const arpabet = entries.get(word.toLowerCase());
    return arpabet === undefined ? null : arpabetToIpa(arpabet);
  };
}

let cached: PhoneticSource | undefined;

// data/cmudict.txt(약 13만 단어)를 처음 쓸 때 한 번만 읽는다. 번들에 넣지 않으려고 fs로 읽는다.
export function cmudictLookup(word: string): string | null {
  cached ??= createCmudict(fs.readFileSync(path.join(process.cwd(), 'data', 'cmudict.txt'), 'utf8'));
  return cached(word);
}

// CMUdict(미국식, 발음 듣기 en-US와 같은 표기)를 먼저 찾고, 없을 때만 사전 API를 부른다.
// 자주 멈추는 API 호출이 줄어든다. CMUdict 조회가 실패해도(파일 없음 등) 저장 전체를 오류로 만들지 않고
// API로 넘어간다. 로그는 한 번만 남긴다.
export function withCmudictFirst(
  apiLookup: (word: string) => Promise<string | null>,
  primary: PhoneticSource = cmudictLookup,
): (word: string) => Promise<string | null> {
  let logged = false;
  return async (word) => {
    try {
      const found = primary(word);
      if (found) return found;
    } catch (err) {
      if (!logged) console.error('CMUdict 발음기호 조회 실패', err);
      logged = true;
    }
    return apiLookup(word);
  };
}
```

`src/server/services/enrich.ts`: import를 `import { withCmudictFirst } from '@/lib/phonetic/cmudict';`로 바꾸고, `defaultEnrichDeps`의 `lookupPhonetic`을 `withCmudictFirst(createPhoneticLookup())`로 바꾼다(주석은 Task 3의 최종 파일과 같게).

- [ ] **Step 4: 통과 확인과 커밋**

Run: `npm test`
Expected: PASS (149 tests)

```bash
git add -A
git commit -m "feat: validate action input, treat links as Enter targets, look up CMUdict first"
```

---

### Task 2: 카드 저장소: 뜻 수정, 실패 목록, 카드 삭제

**Files:**
- Modify: `src/server/repo/cards.ts`
- Create: `tests/server/card-edits.test.ts`

**Interfaces:**
- Produces: `OccurrenceView.wordId: number`, `updateMeaning(db, occurrenceId, meaningKo): boolean`, `listFailedMeaningIds(db, documentId): number[]`, `occurrencesBelongTo(db, documentId, ids): boolean`, `countOccurrencesByWord(db, wordIds): Map<number, number>`, `deleteCard(db, wordId): boolean`

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/server/card-edits.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { knownWords, occurrences, reviewLogs, words } from '@/server/db/schema';
import {
  countOccurrencesByWord,
  deleteCard,
  listFailedMeaningIds,
  listOccurrencesByDocument,
  markMeaningsFailed,
  occurrencesBelongTo,
  saveReviewSelection,
  updateMeaning,
} from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, updateDocumentStatus } from '@/server/repo/documents';
import { recordAnswer } from '@/server/repo/study';

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

// 문서 하나를 만들어 lemmas를 모두 카드로 저장한다.
function savedDocument(title: string, lemmas: string[]) {
  const doc = createDocument(db, { title, kind: 'paper' });
  replaceCandidates(
    db,
    doc.id,
    lemmas.map((lemma) => ({
      lemma,
      surface: lemma,
      sentence: `In ${title}, ${lemma} matters.`,
      count: 1,
      isExisting: false,
      inDictionary: true,
    })),
  );
  updateDocumentStatus(db, doc.id, 'reviewing');
  const saved = saveReviewSelection(db, doc.id, listCandidates(db, doc.id).map((c) => c.id));
  return { doc, saved };
}

describe('updateMeaning', () => {
  it('stores a hand-written meaning and marks it done', () => {
    const { doc, saved } = savedDocument('A', ['progression']);
    markMeaningsFailed(db, saved.occurrenceIds);
    expect(updateMeaning(db, saved.occurrenceIds[0], '수열')).toBe(true);
    expect(listOccurrencesByDocument(db, doc.id)[0]).toMatchObject({
      meaningKo: '수열',
      meaningStatus: 'done',
    });
  });

  it('returns false for a missing occurrence', () => {
    expect(updateMeaning(db, 999, '수열')).toBe(false);
  });
});

describe('listFailedMeaningIds and occurrencesBelongTo', () => {
  it('lists only failed occurrences of the document', () => {
    const a = savedDocument('A', ['alpha', 'beta']);
    const b = savedDocument('B', ['gamma']);
    markMeaningsFailed(db, [a.saved.occurrenceIds[1], b.saved.occurrenceIds[0]]);
    expect(listFailedMeaningIds(db, a.doc.id)).toEqual([a.saved.occurrenceIds[1]]);
  });

  it('checks that every id belongs to the document', () => {
    const a = savedDocument('A', ['alpha', 'beta']);
    const b = savedDocument('B', ['gamma']);
    expect(occurrencesBelongTo(db, a.doc.id, a.saved.occurrenceIds)).toBe(true);
    expect(occurrencesBelongTo(db, a.doc.id, [a.saved.occurrenceIds[0], b.saved.occurrenceIds[0]])).toBe(
      false,
    );
    expect(occurrencesBelongTo(db, a.doc.id, [])).toBe(true);
  });
});

describe('deleteCard', () => {
  it('removes the card with its usages in every document and its review log', () => {
    const a = savedDocument('A', ['robust', 'paradigm']);
    savedDocument('B', ['robust']);
    const robust = db.select().from(words).all().find((w) => w.lemma === 'robust')!;
    recordAnswer(db, robust.id, 'good', new Date());
    expect(countOccurrencesByWord(db, [robust.id]).get(robust.id)).toBe(2);

    expect(deleteCard(db, robust.id)).toBe(true);
    expect(db.select().from(words).all().map((w) => w.lemma)).toEqual(['paradigm']);
    expect(db.select().from(occurrences).all()).toHaveLength(1);
    expect(db.select().from(reviewLogs).all()).toEqual([]);
    expect(db.select().from(knownWords).all()).toEqual([]);
    expect(listOccurrencesByDocument(db, a.doc.id).map((r) => r.lemma)).toEqual(['paradigm']);
  });

  it('returns false for a missing card', () => {
    expect(deleteCard(db, 999)).toBe(false);
  });
});
```

Run: `npx vitest run tests/server/card-edits.test.ts`
Expected: FAIL — 새 함수들이 없음

- [ ] **Step 2: 구현** — `src/server/repo/cards.ts`

`OccurrenceView`에 `wordId: number;`를 `id` 다음에 넣고, `listOccurrencesByDocument`의 select에 `wordId: words.id,`를 `id` 다음에 넣는다. 파일 맨 끝에 추가:

```ts
// 사용자가 직접 고친 뜻. 상태를 done으로 바꾼다. 용례가 없으면 false.
export function updateMeaning(db: Db, occurrenceId: number, meaningKo: string): boolean {
  const row = db
    .update(occurrences)
    .set({ meaningKo, meaningStatus: 'done' })
    .where(eq(occurrences.id, occurrenceId))
    .returning({ id: occurrences.id })
    .get();
  return row !== undefined;
}

// 문서에서 뜻 생성에 실패한 용례. "모두 다시 시도"가 쓴다.
export function listFailedMeaningIds(db: Db, documentId: number): number[] {
  return db
    .select({ id: occurrences.id })
    .from(occurrences)
    .where(and(eq(occurrences.documentId, documentId), eq(occurrences.meaningStatus, 'failed')))
    .orderBy(asc(occurrences.id))
    .all()
    .map((r) => r.id);
}

// 용례가 문서 안에 있는지. 다른 문서의 용례 id로 고치거나 다시 시도하지 못하게 막는다.
export function occurrencesBelongTo(db: Db, documentId: number, occurrenceIds: readonly number[]): boolean {
  if (occurrenceIds.length === 0) return true;
  const found = db
    .select({ id: occurrences.id })
    .from(occurrences)
    .where(and(eq(occurrences.documentId, documentId), inArray(occurrences.id, [...occurrenceIds])))
    .all();
  return found.length === new Set(occurrenceIds).size;
}

// 카드별 용례 수(모든 문서). 카드 삭제 확인 문구에 쓴다.
export function countOccurrencesByWord(db: Db, wordIds: readonly number[]): Map<number, number> {
  if (wordIds.length === 0) return new Map();
  const rows = db
    .select({ wordId: occurrences.wordId, total: count() })
    .from(occurrences)
    .where(inArray(occurrences.wordId, [...new Set(wordIds)]))
    .groupBy(occurrences.wordId)
    .all();
  return new Map(rows.map((r) => [r.wordId, r.total]));
}

// 카드 삭제: 카드(words)를 지우면 외래 키(ON DELETE CASCADE)로 모든 문서의 용례와 복습 기록이 함께 지워진다.
// 삭제한 단어는 아는 단어(known_words)에 넣지 않는다(스펙 7장). 카드가 없으면 false.
export function deleteCard(db: Db, wordId: number): boolean {
  const row = db.delete(words).where(eq(words.id, wordId)).returning({ id: words.id }).get();
  return row !== undefined;
}
```

- [ ] **Step 3: 통과 확인과 커밋**

Run: `npm test`
Expected: PASS (155 tests). 삭제 테스트는 `review_logs`와 다른 문서 용례가 함께 지워지는 것으로 CASCADE(`createDb`의 `foreign_keys = ON`)를 확인한다.

```bash
git add -A
git commit -m "feat: add meaning edit, failed meaning list and card deletion to the card repository"
```

---

### Task 3: 실패한 뜻 다시 만들기 서비스

**Files:**
- Modify: `src/server/services/enrich.ts` (전체 교체)
- Create: `tests/server/retry-meanings.test.ts`

**Interfaces:**
- Produces: `defaultMeaningModel(): MeaningModel | null`, `type RetryResult = { error: 'missing-key' } | { error: null; done: number; failed: number }`, `retryMeanings(db, occurrenceIds, model): Promise<RetryResult>`
- 저장 직후 채우기(`fillMeanings`)와 다시 만들기가 같은 `generateAndStore`를 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/server/retry-meanings.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  listOccurrencesByDocument,
  markMeaningsFailed,
  saveReviewSelection,
} from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, updateDocumentStatus } from '@/server/repo/documents';
import { retryMeanings } from '@/server/services/enrich';
import type { MeaningModel } from '@/lib/meaning/generate';

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

function failedDocument(lemmas: string[]) {
  const doc = createDocument(db, { title: 'Paper', kind: 'paper' });
  replaceCandidates(
    db,
    doc.id,
    lemmas.map((lemma) => ({
      lemma,
      surface: lemma,
      sentence: `The ${lemma} matters.`,
      count: 1,
      isExisting: false,
      inDictionary: true,
    })),
  );
  updateDocumentStatus(db, doc.id, 'reviewing');
  const saved = saveReviewSelection(db, doc.id, listCandidates(db, doc.id).map((c) => c.id));
  markMeaningsFailed(db, saved.occurrenceIds);
  return { doc, saved };
}

describe('retryMeanings', () => {
  it('fills the meanings it can and leaves the rest failed', async () => {
    const { doc, saved } = failedDocument(['robust', 'paradigm']);
    const model: MeaningModel = async (batch) =>
      batch.filter((r) => r.word === 'robust').map((r) => ({ id: r.id, meaningKo: '강건한' }));

    expect(await retryMeanings(db, saved.occurrenceIds, model)).toEqual({ error: null, done: 1, failed: 1 });
    expect(listOccurrencesByDocument(db, doc.id)).toMatchObject([
      { lemma: 'paradigm', meaningStatus: 'failed' },
      { lemma: 'robust', meaningStatus: 'done', meaningKo: '강건한' },
    ]);
  });

  it('changes nothing without an API key', async () => {
    const { doc, saved } = failedDocument(['robust']);
    expect(await retryMeanings(db, saved.occurrenceIds, null)).toEqual({ error: 'missing-key' });
    expect(listOccurrencesByDocument(db, doc.id)[0].meaningStatus).toBe('failed');
  });

  it('does nothing for an empty list', async () => {
    const model: MeaningModel = async () => {
      throw new Error('should not be called');
    };
    expect(await retryMeanings(db, [], model)).toEqual({ error: null, done: 0, failed: 0 });
  });
});
```

Run: `npx vitest run tests/server/retry-meanings.test.ts`
Expected: FAIL — `retryMeanings` 없음

- [ ] **Step 2: 구현** — `src/server/services/enrich.ts` 전체

```ts
import { mapWithConcurrency } from '@/lib/async/pool';
import { createGeminiMeaningModel } from '@/lib/meaning/gemini';
import { generateMeanings, type MeaningModel } from '@/lib/meaning/generate';
import { withCmudictFirst } from '@/lib/phonetic/cmudict';
import { createPhoneticLookup } from '@/lib/phonetic/lookup';
import type { Db } from '../db/client';
import {
  listMeaningRequests,
  listWordsMissingPhonetic,
  markMeaningsFailed,
  markPendingMeaningsFailed,
  setMeanings,
  setPhonetic,
  type SavedCards,
} from '../repo/cards';
import { updateDocumentStatus } from '../repo/documents';

const PHONETIC_CONCURRENCY = 5;

export interface EnrichDeps {
  // null이면 API 키가 없는 것: 뜻은 모두 failed로 둔다.
  meaningModel: MeaningModel | null;
  lookupPhonetic: (word: string) => Promise<string | null>;
}

// 키가 없으면 null: 뜻을 만들 수 없다는 뜻이다.
export function defaultMeaningModel(): MeaningModel | null {
  return process.env.GEMINI_API_KEY ? createGeminiMeaningModel() : null;
}

export function defaultEnrichDeps(): EnrichDeps {
  return {
    meaningModel: defaultMeaningModel(),
    // CMUdict를 먼저 쓰고, 없는 단어만 사전 API로 찾는다. API는 저장마다 새 차단기를 쓴다
    // (사전 API가 죽어 있으면 연속 5번 실패 후 나머지 조회를 건너뛴다).
    lookupPhonetic: withCmudictFirst(createPhoneticLookup()),
  };
}

// 용례들의 뜻을 만들어 저장한다. 성공은 done, 실패는 failed. 저장 직후 채우기와 다시 시도가 함께 쓴다.
async function generateAndStore(db: Db, occurrenceIds: readonly number[], model: MeaningModel) {
  const rows = listMeaningRequests(db, occurrenceIds);
  const outcome = await generateMeanings(
    rows.map((r) => ({ id: r.id, word: r.lemma, sentence: r.sentence })),
    model,
  );
  setMeanings(db, outcome.done);
  markMeaningsFailed(db, outcome.failedIds);
  return { done: outcome.done.length, failed: outcome.failedIds.length };
}

async function fillMeanings(db: Db, occurrenceIds: number[], model: MeaningModel | null) {
  if (!model) {
    markMeaningsFailed(db, listMeaningRequests(db, occurrenceIds).map((r) => r.id));
    return;
  }
  await generateAndStore(db, occurrenceIds, model);
}

export type RetryResult = { error: 'missing-key' } | { error: null; done: number; failed: number };

// 실패한 뜻 다시 만들기(단어 하나 또는 문서 전체). 키가 없으면 아무것도 바꾸지 않고 알린다.
export async function retryMeanings(
  db: Db,
  occurrenceIds: readonly number[],
  model: MeaningModel | null,
): Promise<RetryResult> {
  if (!model) return { error: 'missing-key' };
  if (occurrenceIds.length === 0) return { error: null, done: 0, failed: 0 };
  return { error: null, ...(await generateAndStore(db, occurrenceIds, model)) };
}

async function fillPhonetics(db: Db, wordIds: number[], lookup: EnrichDeps['lookupPhonetic']) {
  const missing = listWordsMissingPhonetic(db, wordIds);
  await mapWithConcurrency(missing, PHONETIC_CONCURRENCY, async (word) => {
    const phonetic = await lookup(word.lemma);
    if (phonetic) setPhonetic(db, word.id, phonetic);
  });
}

const ENRICH_FAILED_MESSAGE = '뜻과 발음을 채우지 못했습니다.';

// 저장 직후 문맥 뜻과 발음기호를 채우고 문서를 완료로 바꾼다. 개별 실패는 용례 상태로 남긴다.
// 예상하지 못한 예외가 나도 문서가 processing에 멈추지 않게 error로 끝내고, 남은 뜻은 failed로 둔다.
export async function enrichDocument(
  db: Db,
  documentId: number,
  saved: SavedCards,
  deps: EnrichDeps,
): Promise<void> {
  const results = await Promise.allSettled([
    fillMeanings(db, saved.occurrenceIds, deps.meaningModel),
    fillPhonetics(db, saved.wordIds, deps.lookupPhonetic),
  ]);
  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length === 0) {
    updateDocumentStatus(db, documentId, 'done');
    return;
  }
  for (const f of failures) console.error('뜻·발음 채우기 실패', f.reason);
  markPendingMeaningsFailed(db, saved.occurrenceIds);
  updateDocumentStatus(db, documentId, 'error', ENRICH_FAILED_MESSAGE);
}
```

- [ ] **Step 3: 통과 확인과 커밋**

Run: `npm test`
Expected: PASS (158 tests)

```bash
git add -A
git commit -m "feat: add a retry service for failed meanings"
```

---

### Task 4: 문서 단어 목록 화면

**Files:**
- Create: `src/app/documents/[id]/actions.ts`, `src/app/documents/[id]/word-table.tsx`, `src/app/documents/[id]/retry-all-button.tsx`
- Modify: `src/app/documents/[id]/page.tsx` (전체 교체)

화면 규칙(개편안 5.4·5.6, 목업 4·6): 행에 마우스를 올리거나 포커스가 들어오면 "뜻 고치기 · 다시 시도(실패한 행만) · 카드 삭제"가 나온다. 뜻 고치기는 그 자리 입력칸이고 `Enter` 저장, `Esc` 취소, 아래에 단축키 안내가 붙는다. 카드 삭제는 브라우저 `<dialog>` 확인창이고, 용례 수와 "다른 문서의 용례도 함께 지워집니다"(2개 이상일 때)를 보여 준다. 실패 안내 줄에는 키가 있으면 "모두 다시 시도"를, 없으면 키 안내를 둔다. Action은 성공하면 `revalidatePath`로 단어 목록·문서 목록·홈을 다시 그린다.

- [ ] **Step 1: Server Action** — `src/app/documents/[id]/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { isId, MAX_MEANING_LENGTH, normalizeMeaningInput, parseIdList } from "@/lib/validate";
import { getDb } from "@/server/db/client";
import {
  deleteCard,
  listFailedMeaningIds,
  occurrencesBelongTo,
  updateMeaning,
} from "@/server/repo/cards";
import { defaultMeaningModel, retryMeanings } from "@/server/services/enrich";

const BAD_REQUEST = "잘못된 요청입니다.";

// 단어 목록과, 수가 바뀌는 홈·문서 목록을 다시 그린다.
function refresh(documentId: number) {
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/documents");
  revalidatePath("/");
}

// 뜻 직접 수정. 용례가 이 문서 것인지 확인한 뒤 저장한다.
export async function editMeaning(
  documentId: unknown,
  occurrenceId: unknown,
  text: unknown,
): Promise<{ error: string | null }> {
  if (!isId(documentId) || !isId(occurrenceId)) return { error: BAD_REQUEST };
  const meaning = normalizeMeaningInput(text);
  if (meaning === null) return { error: `뜻은 1~${MAX_MEANING_LENGTH}자 한 줄로 적어 주세요.` };
  const db = getDb();
  if (!occurrencesBelongTo(db, documentId, [occurrenceId]) || !updateMeaning(db, occurrenceId, meaning)) {
    return { error: "용례를 찾을 수 없습니다." };
  }
  refresh(documentId);
  return { error: null };
}

export type RetryActionResult = { error: string } | { error: null; done: number; failed: number };

// 뜻 다시 만들기. occurrenceIds가 비어 있으면 이 문서의 실패한 뜻 전체를 다시 만든다.
export async function retryFailedMeanings(
  documentId: unknown,
  occurrenceIds: unknown,
): Promise<RetryActionResult> {
  const ids = parseIdList(occurrenceIds);
  if (!isId(documentId) || ids === null) return { error: BAD_REQUEST };
  const db = getDb();
  if (!occurrencesBelongTo(db, documentId, ids)) return { error: BAD_REQUEST };
  const targets = ids.length > 0 ? ids : listFailedMeaningIds(db, documentId);
  const result = await retryMeanings(db, targets, defaultMeaningModel());
  if (result.error === "missing-key") {
    return { error: "GEMINI_API_KEY가 없어 뜻을 만들 수 없습니다. .env.local에 키를 넣고 서버를 다시 시작하세요." };
  }
  refresh(documentId);
  return result;
}

// 카드 삭제: 모든 문서의 용례와 복습 기록이 함께 지워진다.
export async function removeCard(documentId: unknown, wordId: unknown): Promise<{ error: string | null }> {
  if (!isId(documentId) || !isId(wordId)) return { error: BAD_REQUEST };
  if (!deleteCard(getDb(), wordId)) return { error: "카드를 찾을 수 없습니다." };
  refresh(documentId);
  revalidatePath("/study");
  return { error: null };
}
```

- [ ] **Step 2: 단어 표** — `src/app/documents/[id]/word-table.tsx`

```tsx
"use client";

import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import { Highlighted } from "@/components/ui/highlighted";
import { Kbd } from "@/components/ui/kbd";
import { Failed, Spinner } from "@/components/ui/status";
import { MAX_MEANING_LENGTH } from "@/lib/validate";
import type { OccurrenceView } from "@/server/repo/cards";
import { editMeaning, removeCard, retryFailedMeanings } from "./actions";

export interface WordRow extends OccurrenceView {
  usageCount: number; // 이 카드의 용례 수(모든 문서)
}

const linkClass = "text-[13px] font-semibold text-accent hover:underline disabled:opacity-55";

function MeaningText({ row, busy }: { row: WordRow; busy: boolean }) {
  if (busy) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
        <Spinner /> 뜻 만드는 중
      </span>
    );
  }
  if (row.meaningStatus === "done") return <span className="text-[15px] font-semibold text-ink">{row.meaningKo}</span>;
  if (row.meaningStatus === "failed") return <Failed>생성 실패</Failed>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      <Spinner /> 뜻 만드는 중
    </span>
  );
}

// 문서 단어 목록 표. 행에 마우스를 올리거나 포커스가 들어오면 "뜻 고치기 · 다시 시도 · 카드 삭제"가 나온다(개편안 5.4).
export function WordTable({ documentId, rows }: { documentId: number; rows: WordRow[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);
  const [deleting, setDeleting] = useState<WordRow | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);

  const run = (id: number, task: () => Promise<{ error: string | null }>, after?: () => void) => {
    setBusyId(id);
    setRowError(null);
    startTransition(async () => {
      const result = await task();
      setBusyId(null);
      if (result.error) setRowError({ id, message: result.error });
      else after?.();
    });
  };

  const saveEdit = (row: WordRow, text: string) =>
    run(row.id, () => editMeaning(documentId, row.id, text), () => setEditingId(null));

  const onEditKey = (row: WordRow) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit(row, e.currentTarget.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingId(null);
      setRowError(null);
    }
  };

  const openDelete = (row: WordRow) => {
    setDeleting(row);
    dialog.current?.showModal();
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const row = deleting;
    run(row.id, () => removeCard(documentId, row.wordId), () => dialog.current?.close());
  };

  return (
    <>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line-strong text-left text-xs font-semibold whitespace-nowrap text-muted">
              <th className="w-[200px] px-3 py-2">단어</th>
              <th className="w-[280px] px-3 py-2">문맥 뜻</th>
              <th className="px-3 py-2">원문 문장</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const editing = editingId === r.id;
              const busy = busyId === r.id && pending;
              return (
                <tr key={r.id} className="group border-b border-line align-top hover:bg-sunken/60 focus-within:bg-sunken/60">
                  <td className="px-3 py-2.5">
                    <div className="font-en text-[17px] font-bold">{r.lemma}</div>
                    <div className="font-en text-sm text-muted">
                      {r.phonetic ?? "발음기호 없음"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {editing ? (
                      <>
                        <input
                          autoFocus
                          defaultValue={r.meaningKo ?? ""}
                          maxLength={MAX_MEANING_LENGTH}
                          aria-label={`${r.lemma} 문맥 뜻`}
                          disabled={busy}
                          onKeyDown={onEditKey(r)}
                          className="w-full rounded-md border-[1.5px] border-accent bg-surface px-2 py-[5px] text-[15px] font-semibold text-ink"
                        />
                        <p className="mt-1 text-[11.5px] text-muted">
                          <Kbd>Enter</Kbd> 저장 · <Kbd>Esc</Kbd> 취소
                        </p>
                      </>
                    ) : (
                      <MeaningText row={r} busy={busy} />
                    )}
                    {rowError?.id === r.id && (
                      <p role="alert" className="mt-1 text-[13px] text-again">
                        {rowError.message}
                      </p>
                    )}
                    {!editing && (
                      <div className="mt-1.5 flex gap-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                        <button type="button" className={linkClass} disabled={pending} onClick={() => setEditingId(r.id)}>
                          뜻 고치기
                        </button>
                        {r.meaningStatus === "failed" && (
                          <button
                            type="button"
                            className={linkClass}
                            disabled={pending}
                            onClick={() => run(r.id, () => retryFailedMeanings(documentId, [r.id]))}
                          >
                            다시 시도
                          </button>
                        )}
                        <button
                          type="button"
                          className={`${linkClass} text-muted`}
                          disabled={pending}
                          onClick={() => openDelete(r)}
                        >
                          카드 삭제
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-en text-[15.5px] leading-[1.55] text-ink-2">
                    <Highlighted sentence={r.sentence} word={r.surface} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 브라우저 기본 <dialog>: 포커스 가두기와 Esc 닫기를 기본으로 한다(개편안 4.2) */}
      <dialog
        ref={dialog}
        onClose={() => setDeleting(null)}
        className="m-auto w-[400px] max-w-[calc(100%-32px)] rounded-lg border border-line bg-surface p-[22px] text-ink shadow-2 backdrop:bg-ink/30"
      >
        {deleting && (
          <>
            <h2 className="mb-1.5 text-[17px] font-bold">카드를 삭제할까요?</h2>
            <p className="mb-[18px] text-sm text-ink-2">
              <b className="font-en text-base">{deleting.lemma}</b> 카드와 용례 {deleting.usageCount}개, 복습 기록이 모두
              지워집니다.{deleting.usageCount > 1 && " 다른 문서의 용례도 함께 지워집니다."} 되돌릴 수 없습니다.
            </p>
            {rowError?.id === deleting.id && (
              <p role="alert" className="mb-3 text-[13px] text-again">
                {rowError.message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className={buttonClass()} onClick={() => dialog.current?.close()}>
                취소 <Kbd>Esc</Kbd>
              </button>
              <button
                type="button"
                className={buttonClass({ variant: "danger" })}
                disabled={pending}
                onClick={confirmDelete}
              >
                삭제
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
```

- [ ] **Step 3: 모두 다시 시도 버튼** — `src/app/documents/[id]/retry-all-button.tsx`

```tsx
"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/status";
import { retryFailedMeanings } from "./actions";

// 안내 줄의 "모두 다시 시도": 이 문서의 실패한 뜻을 한 번에 다시 만든다.
export function RetryAllButton({ documentId }: { documentId: number }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const retry = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await retryFailedMeanings(documentId, []);
      if (result.error !== null) setMessage(result.error);
      else if (result.failed > 0) setMessage(`${result.done}개를 채웠고 ${result.failed}개는 다시 실패했습니다.`);
    });

  return (
    <>
      <button
        type="button"
        onClick={retry}
        disabled={pending}
        className="ml-1.5 inline-flex items-center gap-1.5 font-semibold text-accent hover:underline disabled:opacity-55"
      >
        {pending && <Spinner />}
        {pending ? "다시 만드는 중…" : "모두 다시 시도"}
      </button>
      {message && (
        <span role="alert" className="ml-2 text-again">
          {message}
        </span>
      )}
    </>
  );
}
```

- [ ] **Step 4: 페이지** — `src/app/documents/[id]/page.tsx`

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { KIND_LABEL } from "@/components/document-status";
import { Notice } from "@/components/ui/notice";
import { getDb } from "@/server/db/client";
import { countOccurrencesByWord, listOccurrencesByDocument } from "@/server/repo/cards";
import { getDocument } from "@/server/repo/documents";
import { RetryAllButton } from "./retry-all-button";
import { WordTable } from "./word-table";

// 문서 단어 목록. 뜻 고치기·다시 시도·카드 삭제는 표(WordTable)에서, 문서 전체 다시 시도는 안내 줄에서 한다.
export default function DocumentWordsPage({ params }: PageProps<"/documents/[id]">) {
  return (
    <Suspense fallback={<p className="px-10 py-8 text-muted">불러오는 중…</p>}>
      <DocumentWords params={params} />
    </Suspense>
  );
}

async function DocumentWords({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const db = getDb();
  const doc = getDocument(db, id);
  if (!doc) notFound();
  const rows = listOccurrencesByDocument(db, id);
  const usage = countOccurrencesByWord(db, rows.map((r) => r.wordId));
  const failed = rows.filter((r) => r.meaningStatus === "failed").length;
  const missingKey = !process.env.GEMINI_API_KEY;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-10 py-8 max-[900px]:px-4">
      <p className="text-[13px] text-muted">
        <Link href="/documents" className="hover:text-ink">
          문서
        </Link>
      </p>
      <h1 className="mt-1 font-en text-[26px] leading-[1.3] font-bold">{doc.title}</h1>
      <p className="mt-1 text-[13px] text-muted">
        {KIND_LABEL[doc.kind]} · 단어 <span className="tabular-nums">{rows.length}</span>개 ·{" "}
        {doc.createdAt.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 올림
      </p>

      {doc.status === "reviewing" && (
        <Notice className="mt-4">
          아직 검토하지 않은 문서입니다.
          <Link href={`/documents/${doc.id}/review`} className="font-semibold text-accent">
            검토하러 가기
          </Link>
        </Notice>
      )}
      {doc.status === "error" && doc.errorMessage && <Notice className="mt-4">{doc.errorMessage}</Notice>}
      {failed > 0 && (
        <Notice className="mt-4">
          뜻 <span className="tabular-nums">{failed}</span>개를 만들지 못했습니다
          {missingKey ? (
            <>
              {" "}
              · GEMINI_API_KEY 없음. <span className="text-muted">.env.local에 키를 넣고 서버를 다시 시작하세요.</span>
            </>
          ) : (
            <RetryAllButton documentId={doc.id} />
          )}
        </Notice>
      )}

      <WordTable documentId={doc.id} rows={rows.map((r) => ({ ...r, usageCount: usage.get(r.wordId) ?? 1 }))} />
    </main>
  );
}
```

- [ ] **Step 5: 확인과 커밋**

Run: `npm run typecheck`, `npm run lint`
Expected: 오류 0

```bash
git add -A
git commit -m "feat: edit meanings, retry failed meanings and delete cards from the word list"
```

---

### Task 5: 저장 입력 검사와 작은 버그 2건

**Files:**
- Modify: `src/app/documents/[id]/review/actions.ts`(전체 교체), `src/app/study/actions.ts`(전체 교체), `src/app/study/study-session.tsx`(두 곳)

- [ ] **Step 1: 저장 입력 검사** — `src/app/documents/[id]/review/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isId, parseIdList } from "@/lib/validate";
import { getDb } from "@/server/db/client";
import { ReviewError, saveReviewSelection, type SavedCards } from "@/server/repo/cards";
import { defaultEnrichDeps, enrichDocument } from "@/server/services/enrich";

// 검토 결과를 저장하고, 뜻과 발음을 채운 뒤 문서 단어 목록으로 이동한다.
// 인자는 브라우저에서 오므로 형태부터 확인한다. 잘못된 목록이 "아무것도 선택 안 함"으로 읽혀
// 후보 전체가 아는 단어로 들어가는 일을 막는다.
export async function saveReview(
  documentId: unknown,
  selectedCandidateIds: unknown,
): Promise<{ error: string }> {
  const ids = parseIdList(selectedCandidateIds);
  if (!isId(documentId) || ids === null) return { error: "잘못된 요청입니다." };
  const db = getDb();
  let saved: SavedCards;
  try {
    saved = saveReviewSelection(db, documentId, ids);
  } catch (err) {
    if (err instanceof ReviewError) return { error: err.message };
    throw err;
  }

  await enrichDocument(db, documentId, saved, defaultEnrichDeps());
  revalidatePath("/documents");
  redirect(`/documents/${documentId}`);
}
```

- [ ] **Step 2: 응답 후 메뉴 배지 갱신** — `src/app/study/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { Intervals } from "@/lib/srs/interval";
import { ANSWERS, type Answer } from "@/lib/srs/scheduler";
import { getDb } from "@/server/db/client";
import { recordAnswer, StudyError } from "@/server/repo/study";

export type AnswerResult =
  | { error: string }
  | { error: null; due: number; intervals: Intervals }; // due는 ms(epoch)

// 복습 응답 하나를 저장한다. 성공하면 다음 복습 시각과 응답 뒤 상태의 간격 미리보기를 돌려준다.
export async function answerCard(wordId: number, answer: Answer): Promise<AnswerResult> {
  if (!Number.isInteger(wordId) || !ANSWERS.includes(answer)) {
    return { error: "잘못된 요청입니다." };
  }
  try {
    const { due, intervals } = recordAnswer(getDb(), wordId, answer, new Date());
    // 상단 메뉴의 "오늘 남은 수" 배지(레이아웃)가 바로 줄도록 다시 그린다.
    // 복습 화면의 큐 상태는 클라이언트 state라 그대로 유지된다.
    revalidatePath("/", "layout");
    return { error: null, due: due.getTime(), intervals };
  } catch (err) {
    if (err instanceof StudyError) return { error: err.message };
    throw err;
  }
}
```

`revalidatePath("/", "layout")`은 레이아웃의 배지를 다시 그린다. 복습 큐는 `StudySession`의 `useState` 초깃값이라 바뀌지 않는다(Task 6에서 확인).

- [ ] **Step 3: 완료 화면에서 링크 위 Enter** — `src/app/study/study-session.tsx`

import를 `import { isNativeEnterTarget, isNativeSpaceTarget, isTypingTarget } from "@/lib/ui/keys";`로 바꾸고, 키 처리기 안의 다음 두 줄을

```tsx
      // 포커스된 버튼 위의 Space·Enter는 브라우저가 그 버튼을 누르므로 여기서 또 처리하지 않는다.
      if ((e.key === " " || e.key === "Enter") && isNativeSpaceTarget(target)) return;
```

아래로 바꾼다.

```tsx
      // 포커스된 버튼·링크 위의 Space·Enter는 브라우저가 그것을 누르므로 여기서 또 처리하지 않는다.
      // (완료 화면의 "다시 확인" 링크에서 Enter가 링크 이동과 홈 이동을 함께 실행하던 문제)
      if (e.key === " " && isNativeSpaceTarget(target)) return;
      if (e.key === "Enter" && isNativeEnterTarget(target)) return;
```

- [ ] **Step 4: 전체 확인과 커밋**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 158 tests PASS, 오류 0, 빌드 성공

```bash
git add -A
git commit -m "fix: validate review save input, refresh the study badge, respect Enter on links"
```

---

### Task 6: 브라우저 확인, 리뷰, 병합

- [ ] **Step 1: 브라우저 흐름** (데모 DB 사본, `next start -p 3300`, 헤드리스 Edge)

PM이 계획을 쓰며 같은 방식으로 확인한 결과다. 같은 동작이 나와야 한다.
- ResNet 단어 목록에서 `accurate` → 뜻 고치기 → "정확한" `Enter`: 저장되고 상태가 완료가 된다. `Esc`는 원래 값을 유지한다. 공백만 넣고 `Enter`를 누르면 "뜻은 1~40자 한 줄로 적어 주세요."가 뜬다.
- 실패한 단어 하나 "다시 시도": 몇 초 뒤 뜻이 채워진다(실제 API 1회. 예: activation "활성화 함수 적용").
- "카드 삭제" → 확인창 "aggressively 카드와 용례 1개, 복습 기록이 모두 지워집니다. 되돌릴 수 없습니다." → 삭제: 행이 사라진다.
- 안내 줄 "모두 다시 시도": 실패 203개가 약 12초 만에 채워지고 안내 줄이 사라진다(실제 API, 약 $0.02).
- 복습에서 한 장 답하면 상단 배지가 20 → 19가 되고, 진행 표시는 "1 / 20"으로 이어진다(세션 상태 유지). 완료 화면에서 "다시 확인" 링크에 포커스를 두고 `Enter`를 누르면 `/study`로만 간다.
- 새 PDF를 하나 저장해 발음기호가 채워지는지 본다(CMUdict 우선이라 사전 API가 죽어 있어도 같다).

- [ ] **Step 2: Codex 리뷰와 병합**

`/codex:adversarial-review`로 브랜치 전체 리뷰를 받는다(범위 `--base main`). Important 이상은 테스트를 먼저 써서 고친다. main에 로컬 병합(`--no-ff`)한 뒤, main에서 test·typecheck·lint·build 결과와 병합 커밋 해시, 리뷰 요약을 PM에게 보낸다. 키 값은 출력하지 않는다.
