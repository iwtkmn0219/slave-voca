# 마일스톤 4-1: 뜻 다시 만들기·카드 삭제 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 저장한 뜻을 믿고 매일 복습할 수 있게 한다. 뜻이 이상하면 "뜻 다시 만들기"로 새로 받는다(문서 단어 목록의 모든 행, 복습 카드 뒷면의 용례마다, 실패한 뜻 전체). 카드 삭제를 붙이고, 발음기호는 CMUdict를 먼저 쓴다. 작은 버그 2건과 저장 입력 검사도 고친다.

**뜻을 직접 고치는 기능은 두지 않는다(2026-10-16 사용자 결정).** 모르는 단어를 공부하는 사람은 맞는 뜻을 알지 못하므로, 고치기 대신 다시 만들기를 모든 단어에 둔다. 이 계획은 fca3553의 이전 판(뜻 고치기 포함)을 대체한다.

**Architecture:** 기존 구조 그대로다. 입력 검사(`lib/validate.ts`)와 키 판단(`lib/ui/keys.ts`)은 순수 함수, DB 변경은 `server/repo/cards.ts`, 뜻 생성 재사용은 `server/services/enrich.ts`에 둔다. 화면은 `documents/[id]`의 Server Action 2개(`regenerateDocumentMeanings`, `removeCard`)와 클라이언트 표(`WordTable`), 복습 화면의 Server Action `regenerateUsageMeaning`으로 만든다. 모든 Server Action은 인자를 `unknown`으로 받아 형태부터 확인한다.

**Tech Stack:** 기존 스택 그대로(새 의존성 없음)

**Spec:** `docs/superpowers/specs/2026-10-13-slave-voca-design.md` 11장 M4(1순위 항목), UI 개편안 `docs/superpowers/specs/2026-10-15-ui-redesign.md` 5.4·5.6, 목업 `docs/superpowers/mockups/a-paper.html` 4·6번

## Global Constraints

- 작업 브랜치: `feat/m4-1-regenerate-delete` (main에서 분기). 태스크마다 커밋한다.
- 리뷰는 Orca에 떠 있는 Codex 터미널에 맡긴다(`orca terminal send`로 요청, `orca terminal read`로 결과 받기). codex 플러그인 명령(`/codex:review` 등)은 쓰지 않는다. 심각도 분류는 그대로이고, Important 이상은 테스트를 먼저 써서 고친다.
- 다시 만들기: 지금 뜻 생성 경로(묶음 200, 재시도, 깨진 글자 검사, B1 지시)를 그대로 쓴다. 이미 뜻이 있는 용례도 새로 받는다. **새로 받지 못하면 원래 뜻을 그대로 둔다**(done → failed로 바꾸지 않는다). 키가 없으면 아무것도 바꾸지 않고 안내한다.
- 카드 삭제: `words` 행을 지우면 외래 키 `ON DELETE CASCADE`로 모든 문서의 용례와 복습 기록이 함께 지워진다. 삭제한 단어는 아는 단어(`known_words`)에 넣지 않는다(설계서 7장).
- 발음기호: CMUdict를 먼저 찾고, 없는 단어만 사전 API(차단기 포함)로 찾는다.
- 용례 id는 반드시 그 문서 것인지 확인한다(다른 문서의 id로 다시 만들기 금지).
- 복습 카드의 다시 만들기는 응답(1·2·3)을 막지 않는다. 새 단축키는 두지 않는다.
- 다시 만드는 동안 원래 뜻은 제자리에 흐리게(`opacity-50`) 두고, 진행·결과는 버튼 자리에 보인다. 카드 높이와 답 버튼 위치, 표의 행 높이가 변하지 않아야 한다(Designer 결정, 2026-10-16).
- 색은 토큰만, 단축키는 입력칸에서 끈다(UI 개편 규칙 그대로).
- 실제 API 호출은 Task 6에서만 한다. 키 값은 출력하지 않는다.

## Review Focus

1. 다른 문서의 용례 id로 다시 만들기: 막혀야 한다(Task 2 `occurrencesBelongTo`, Task 4 action에서 사용).
2. 이미 있는 뜻을 다시 만들다 실패하면 원래 뜻이 남아야 한다(Task 3 테스트 "keeps an existing meaning when regenerating it fails").
3. 카드 삭제가 다른 문서의 용례와 복습 기록까지 지우는지, 그리고 아는 단어로는 넣지 않는지(Task 2 `deleteCard` 테스트). 대화상자에 "다른 문서의 용례도 함께 지워집니다"를 보여 준다(Task 4).
4. 저장 Action에 배열이 아닌 값이 오면 "아무것도 선택 안 함"으로 읽혀 후보 전체가 아는 단어가 될 수 있었다. 이제 거부해야 한다(Task 1 `parseIdList`, Task 5).
5. 응답할 때마다 레이아웃을 다시 그리면 복습 세션 상태가 초기화될 수 있다. 진행 표시가 "1 / 20"처럼 이어져야 한다(Task 6 확인. PM이 작성 중 확인함).
6. 다시 만드는 동안과 결과가 나온 뒤에도 답 버튼이 움직이지 않는지(마우스로 답하는 중 잘못 누르기 방지). Task 6에서 위치를 잰다.
7. CMUdict 파일을 읽지 못해도 저장 전체가 오류가 되면 안 되고, API로 넘어가야 한다(Task 1 `withCmudictFirst` 테스트).

---

## 파일 구조

| 파일 | 책임 | 태스크 |
|---|---|---|
| `src/lib/validate.ts` | id·id 목록 검사 | 1 |
| `src/lib/ui/keys.ts` | `isNativeEnterTarget`(링크 포함) 추가 | 1 |
| `src/lib/phonetic/cmudict.ts` | `withCmudictFallback` → `withCmudictFirst` | 1 |
| `src/server/repo/cards.ts` | `wordId`·`meaningStatus` 노출, 용례 뜻 조회, 실패 목록, 소속 확인, 카드별 용례 수, 카드 삭제 | 2 |
| `src/server/services/enrich.ts` | CMUdict 우선, `defaultMeaningModel`, `regenerateMeanings` | 1, 3 |
| `src/lib/regen-messages.ts`, `src/components/ui/regen-slot.tsx` | 다시 만들기 결과 문구, 버튼 자리의 진행·결과 표시(단어 목록과 복습 카드가 같이 씀) | 4 |
| `src/app/documents/[id]/{actions.ts, word-table.tsx, retry-all-button.tsx, page.tsx}` | 단어 목록 화면 | 4 |
| `src/app/documents/[id]/review/actions.ts` | 저장 입력 검사 | 5 |
| `src/server/repo/study.ts`, `src/app/study/{actions.ts, study-session.tsx}` | 용례 id 노출, 카드 뒷면 다시 만들기, 메뉴 배지 갱신, 완료 화면 Enter | 5 |

테스트 수: 시작 144 → Task 1 후 147 → Task 2 후 152 → Task 3 후 157.

---

### Task 1: 입력 검사, Enter 대상 판단, CMUdict 우선

**Files:**
- Create: `src/lib/validate.ts`, `tests/lib/validate.test.ts`
- Modify: `src/lib/ui/keys.ts`(함수 추가), `tests/lib/ui/keys.test.ts`(테스트 추가), `src/lib/phonetic/cmudict.ts`(전체 교체), `tests/lib/phonetic/cmudict.test.ts`(마지막 describe 교체), `src/server/services/enrich.ts`(Task 3에서 전체 교체. 여기서는 import 한 줄과 한 곳)

**Interfaces:**
- Produces: `isId(v): v is number`, `parseIdList(v): number[] | null`, `isNativeEnterTarget(target): boolean`, `withCmudictFirst(apiLookup, primary?)`

- [ ] **Step 1: 브랜치**

```bash
git checkout main
git checkout -b feat/m4-1-regenerate-delete
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/lib/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isId, parseIdList } from '@/lib/validate';

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
Expected: PASS (147 tests)

```bash
git add -A
git commit -m "feat: validate action input, treat links as Enter targets, look up CMUdict first"
```

---

### Task 2: 카드 저장소: 용례 뜻 조회, 실패 목록, 카드 삭제

**Files:**
- Modify: `src/server/repo/cards.ts` (전체 교체)
- Create: `tests/server/card-edits.test.ts`

**Interfaces:**
- Produces: `OccurrenceView.wordId: number`, `MeaningRequestRow.meaningStatus`, `getOccurrenceMeaning(db, occurrenceId): { meaningKo, meaningStatus } | undefined`, `listFailedMeaningIds(db, documentId): number[]`, `occurrencesBelongTo(db, documentId, ids): boolean`, `countOccurrencesByWord(db, wordIds): Map<number, number>`, `deleteCard(db, wordId): boolean`

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/server/card-edits.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { knownWords, occurrences, reviewLogs, words } from '@/server/db/schema';
import {
  countOccurrencesByWord,
  deleteCard,
  getOccurrenceMeaning,
  listFailedMeaningIds,
  listOccurrencesByDocument,
  markMeaningsFailed,
  occurrencesBelongTo,
  saveReviewSelection,
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

describe('getOccurrenceMeaning', () => {
  it('returns the current meaning and status, or undefined', () => {
    const { saved } = savedDocument('A', ['progression']);
    markMeaningsFailed(db, saved.occurrenceIds);
    expect(getOccurrenceMeaning(db, saved.occurrenceIds[0])).toEqual({ meaningKo: null, meaningStatus: 'failed' });
    expect(getOccurrenceMeaning(db, 999)).toBeUndefined();
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

- [ ] **Step 2: 구현** — `src/server/repo/cards.ts` 전체

```ts
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  candidates,
  documents,
  knownWords,
  occurrences,
  words,
  type MeaningStatus,
} from '../db/schema';

export class ReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewError';
  }
}

export interface SavedCards {
  occurrenceIds: number[];
  wordIds: number[];
}

// 검토 결과 저장: 선택 → 카드(words)+용례(occurrences), 선택 해제 → 아는 단어.
// 이미 카드인 단어를 해제하면 이번 용례만 건너뛰고 아는 단어로 넣지 않는다.
export function saveReviewSelection(
  db: Db,
  documentId: number,
  selectedCandidateIds: readonly number[],
): SavedCards {
  return db.transaction((tx) => {
    const doc = tx.select().from(documents).where(eq(documents.id, documentId)).get();
    if (!doc) throw new ReviewError('문서를 찾을 수 없습니다.');
    if (doc.status !== 'reviewing') throw new ReviewError('이미 저장한 문서입니다.');

    const selected = new Set(selectedCandidateIds);
    const list = tx.select().from(candidates).where(eq(candidates.documentId, documentId)).all();
    const saved: SavedCards = { occurrenceIds: [], wordIds: [] };

    for (const c of list) {
      // candidates.isExisting은 추출 시점 값이라, 그 뒤 다른 문서에서 카드가 됐을 수 있다. 지금의 words를 본다.
      const existing = tx.select().from(words).where(eq(words.lemma, c.lemma)).get();
      if (!selected.has(c.id)) {
        if (!existing) {
          tx.insert(knownWords).values({ lemma: c.lemma }).onConflictDoNothing().run();
        }
        continue;
      }
      // 선택이 이긴다: 다른 문서에서 아는 단어로 등록했더라도 이번에 고르면 카드로 만든다.
      tx.delete(knownWords).where(eq(knownWords.lemma, c.lemma)).run();
      const word = existing ?? tx.insert(words).values({ lemma: c.lemma }).returning().get();
      const occurrence = tx
        .insert(occurrences)
        .values({ wordId: word.id, documentId, surface: c.surface, sentence: c.sentence })
        .returning({ id: occurrences.id })
        .get();
      saved.occurrenceIds.push(occurrence.id);
      saved.wordIds.push(word.id);
    }

    tx.delete(candidates).where(eq(candidates.documentId, documentId)).run();
    tx.update(documents)
      .set({ status: 'processing', errorMessage: null })
      .where(eq(documents.id, documentId))
      .run();
    return saved;
  });
}

export interface MeaningRequestRow {
  id: number;
  lemma: string;
  sentence: string;
  meaningStatus: MeaningStatus;
}

export function listMeaningRequests(db: Db, occurrenceIds: readonly number[]): MeaningRequestRow[] {
  if (occurrenceIds.length === 0) return [];
  return db
    .select({
      id: occurrences.id,
      lemma: words.lemma,
      sentence: occurrences.sentence,
      meaningStatus: occurrences.meaningStatus,
    })
    .from(occurrences)
    .innerJoin(words, eq(words.id, occurrences.wordId))
    .where(inArray(occurrences.id, [...occurrenceIds]))
    .orderBy(asc(occurrences.id))
    .all();
}

export function setMeanings(db: Db, results: { id: number; meaningKo: string }[]): void {
  db.transaction((tx) => {
    for (const r of results) {
      tx.update(occurrences)
        .set({ meaningKo: r.meaningKo, meaningStatus: 'done' })
        .where(eq(occurrences.id, r.id))
        .run();
    }
  });
}

export function markMeaningsFailed(db: Db, occurrenceIds: readonly number[]): void {
  if (occurrenceIds.length === 0) return;
  db.update(occurrences)
    .set({ meaningStatus: 'failed' })
    .where(inArray(occurrences.id, [...occurrenceIds]))
    .run();
}

// 채우기가 중간에 실패했을 때: 아직 pending인 용례만 failed로 바꾼다(이미 done인 뜻은 둔다).
export function markPendingMeaningsFailed(db: Db, occurrenceIds: readonly number[]): void {
  if (occurrenceIds.length === 0) return;
  db.update(occurrences)
    .set({ meaningStatus: 'failed' })
    .where(
      and(inArray(occurrences.id, [...occurrenceIds]), eq(occurrences.meaningStatus, 'pending')),
    )
    .run();
}

export function listWordsMissingPhonetic(
  db: Db,
  wordIds: readonly number[],
): { id: number; lemma: string }[] {
  if (wordIds.length === 0) return [];
  return db
    .select({ id: words.id, lemma: words.lemma })
    .from(words)
    .where(and(inArray(words.id, [...new Set(wordIds)]), isNull(words.phonetic)))
    .all();
}

export function setPhonetic(db: Db, wordId: number, phonetic: string): void {
  db.update(words).set({ phonetic }).where(eq(words.id, wordId)).run();
}

export interface OccurrenceView {
  id: number;
  wordId: number;
  lemma: string;
  phonetic: string | null;
  surface: string;
  sentence: string;
  meaningKo: string | null;
  meaningStatus: MeaningStatus;
}

export function listOccurrencesByDocument(db: Db, documentId: number): OccurrenceView[] {
  return db
    .select({
      id: occurrences.id,
      wordId: words.id,
      lemma: words.lemma,
      phonetic: words.phonetic,
      surface: occurrences.surface,
      sentence: occurrences.sentence,
      meaningKo: occurrences.meaningKo,
      meaningStatus: occurrences.meaningStatus,
    })
    .from(occurrences)
    .innerJoin(words, eq(words.id, occurrences.wordId))
    .where(eq(occurrences.documentId, documentId))
    .orderBy(asc(words.lemma))
    .all();
}

export function countOccurrencesByDocument(db: Db): Map<number, number> {
  const rows = db
    .select({ documentId: occurrences.documentId, total: count() })
    .from(occurrences)
    .groupBy(occurrences.documentId)
    .all();
  return new Map(rows.map((r) => [r.documentId, r.total]));
}

// 문서별 뜻 생성 실패 수. 홈·문서 목록에서 안내할 때 쓴다.
export function countFailedMeaningsByDocument(db: Db): Map<number, number> {
  const rows = db
    .select({ documentId: occurrences.documentId, total: count() })
    .from(occurrences)
    .where(eq(occurrences.meaningStatus, 'failed'))
    .groupBy(occurrences.documentId)
    .all();
  return new Map(rows.map((r) => [r.documentId, r.total]));
}

// 용례 하나의 지금 뜻과 상태. 복습 카드에서 다시 만든 뒤 새 뜻을 돌려줄 때 쓴다.
export function getOccurrenceMeaning(
  db: Db,
  occurrenceId: number,
): { meaningKo: string | null; meaningStatus: MeaningStatus } | undefined {
  return db
    .select({ meaningKo: occurrences.meaningKo, meaningStatus: occurrences.meaningStatus })
    .from(occurrences)
    .where(eq(occurrences.id, occurrenceId))
    .get();
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
Expected: PASS (152 tests). 삭제 테스트는 `review_logs`와 다른 문서 용례가 함께 지워지는 것으로 CASCADE(`createDb`의 `foreign_keys = ON`)를 확인한다.

```bash
git add -A
git commit -m "feat: add meaning lookup, failed meaning list and card deletion to the card repository"
```

---

### Task 3: 뜻 다시 만들기 서비스

**Files:**
- Modify: `src/server/services/enrich.ts` (전체 교체)
- Create: `tests/server/regenerate-meanings.test.ts`

**Interfaces:**
- Produces: `defaultMeaningModel(): MeaningModel | null`, `type RegenerateResult = { error: 'missing-key' } | { error: null; done: number; failed: number }`, `regenerateMeanings(db, occurrenceIds, model): Promise<RegenerateResult>`
- 저장 직후 채우기(`fillMeanings`)와 다시 만들기가 같은 `generateAndStore`를 쓴다. `generateAndStore`는 원래 `done`이던 용례가 새 뜻을 못 받으면 failed로 바꾸지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/server/regenerate-meanings.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  listOccurrencesByDocument,
  markMeaningsFailed,
  saveReviewSelection,
  setMeanings,
} from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, updateDocumentStatus } from '@/server/repo/documents';
import { regenerateMeanings } from '@/server/services/enrich';
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

describe('regenerateMeanings', () => {
  it('replaces an existing meaning with the new one', async () => {
    const { doc, saved } = failedDocument(['progression']);
    setMeanings(db, [{ id: saved.occurrenceIds[0], meaningKo: '진행' }]);
    const model: MeaningModel = async (batch) => batch.map((r) => ({ id: r.id, meaningKo: '수열' }));
    expect(await regenerateMeanings(db, saved.occurrenceIds, model)).toEqual({ error: null, done: 1, failed: 0 });
    expect(listOccurrencesByDocument(db, doc.id)[0]).toMatchObject({ meaningKo: '수열', meaningStatus: 'done' });
  });

  it('keeps an existing meaning when regenerating it fails', async () => {
    const { doc, saved } = failedDocument(['progression']);
    setMeanings(db, [{ id: saved.occurrenceIds[0], meaningKo: '진행' }]);
    const model: MeaningModel = async () => [];
    expect(await regenerateMeanings(db, saved.occurrenceIds, model)).toEqual({ error: null, done: 0, failed: 1 });
    expect(listOccurrencesByDocument(db, doc.id)[0]).toMatchObject({ meaningKo: '진행', meaningStatus: 'done' });
  });

  it('fills the meanings it can and leaves the rest failed', async () => {
    const { doc, saved } = failedDocument(['robust', 'paradigm']);
    const model: MeaningModel = async (batch) =>
      batch.filter((r) => r.word === 'robust').map((r) => ({ id: r.id, meaningKo: '강건한' }));

    expect(await regenerateMeanings(db, saved.occurrenceIds, model)).toEqual({ error: null, done: 1, failed: 1 });
    expect(listOccurrencesByDocument(db, doc.id)).toMatchObject([
      { lemma: 'paradigm', meaningStatus: 'failed' },
      { lemma: 'robust', meaningStatus: 'done', meaningKo: '강건한' },
    ]);
  });

  it('changes nothing without an API key', async () => {
    const { doc, saved } = failedDocument(['robust']);
    expect(await regenerateMeanings(db, saved.occurrenceIds, null)).toEqual({ error: 'missing-key' });
    expect(listOccurrencesByDocument(db, doc.id)[0].meaningStatus).toBe('failed');
  });

  it('does nothing for an empty list', async () => {
    const model: MeaningModel = async () => {
      throw new Error('should not be called');
    };
    expect(await regenerateMeanings(db, [], model)).toEqual({ error: null, done: 0, failed: 0 });
  });
});
```

Run: `npx vitest run tests/server/regenerate-meanings.test.ts`
Expected: FAIL — `regenerateMeanings` 없음

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

// 용례들의 뜻을 만들어 저장한다. 성공은 done, 실패는 failed. 저장 직후 채우기와 다시 만들기가 함께 쓴다.
// 이미 뜻이 있던 용례(done)는 새로 만들다 실패해도 원래 뜻을 그대로 둔다.
async function generateAndStore(db: Db, occurrenceIds: readonly number[], model: MeaningModel) {
  const rows = listMeaningRequests(db, occurrenceIds);
  const hadMeaning = new Set(rows.filter((r) => r.meaningStatus === 'done').map((r) => r.id));
  const outcome = await generateMeanings(
    rows.map((r) => ({ id: r.id, word: r.lemma, sentence: r.sentence })),
    model,
  );
  setMeanings(db, outcome.done);
  markMeaningsFailed(db, outcome.failedIds.filter((id) => !hadMeaning.has(id)));
  return { done: outcome.done.length, failed: outcome.failedIds.length };
}

async function fillMeanings(db: Db, occurrenceIds: number[], model: MeaningModel | null) {
  if (!model) {
    markMeaningsFailed(db, listMeaningRequests(db, occurrenceIds).map((r) => r.id));
    return;
  }
  await generateAndStore(db, occurrenceIds, model);
}

export type RegenerateResult = { error: 'missing-key' } | { error: null; done: number; failed: number };

// 뜻 다시 만들기: 실패한 뜻을 채우거나, 이상한 뜻을 새로 받는다(단어 하나 또는 여러 개).
// 키가 없으면 아무것도 바꾸지 않고 알린다.
export async function regenerateMeanings(
  db: Db,
  occurrenceIds: readonly number[],
  model: MeaningModel | null,
): Promise<RegenerateResult> {
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
Expected: PASS (157 tests)

```bash
git add -A
git commit -m "feat: add a meaning regeneration service that keeps the old meaning on failure"
```

---

### Task 4: 문서 단어 목록 화면

**Files:**
- Create: `src/lib/regen-messages.ts`, `src/components/ui/regen-slot.tsx`, `src/app/documents/[id]/actions.ts`, `src/app/documents/[id]/word-table.tsx`, `src/app/documents/[id]/retry-all-button.tsx`
- Modify: `src/app/documents/[id]/page.tsx` (전체 교체)

화면 규칙(개편안 5.4·5.6, 목업 4·6, Designer 2026-10-16):
- 행에 마우스를 올리거나 포커스가 들어오면 "뜻 다시 만들기"(강조색 굵게)와 "카드 삭제"(회색)가 **바로** 나온다(페이드 없음). 다시 만들기는 **모든 행**에 있다(뜻이 있어도). 생성 실패 행도 평소에는 숨긴다. 일괄 처리는 안내 줄의 "모두 다시 시도"가 맡는다.
- 동작 줄은 `invisible`로 자리를 늘 차지하고 높이를 고정해(`h-5`) 행 높이가 변하지 않는다. 진행·결과가 있거나 그 행의 삭제 확인창이 열려 있으면 늘 보인다.
- 다시 만드는 동안: 원래 뜻(또는 "생성 실패")은 제자리에 흐리게, 동작 줄 자리에 스피너 "다시 만드는 중"(`aria-live="polite"`).
- 결과: 성공 "새 뜻으로 바꿨습니다 · 다시 만들기", 실패 "— 다시 만들지 못했습니다 · 다시 시도"(again 색 점선, 경고 상자 없음, 원래 뜻 그대로). 키가 없으면 "— API 키가 없어 만들 수 없습니다"만 두고 다시 시도는 없다(홈 화면이 키 안내를 한다). 결과 문구는 다른 행에 마우스를 올리거나 페이지를 옮길 때까지 남는다.
- 버튼은 `onMouseDown={keepFocus}`: 클릭한 뒤 Space가 그 버튼을 다시 누르지 않는다.
- 카드 삭제는 브라우저 `<dialog>` 확인창이고, 용례 수와 "다른 문서의 용례도 함께 지워집니다"(2개 이상일 때)를 보여 준다. 실패 안내 줄에는 키가 있으면 "모두 다시 시도"(이 문서의 실패한 뜻 전체)를, 없으면 키 안내를 둔다. Action은 성공하면 `revalidatePath`로 단어 목록·문서 목록·홈을 다시 그린다.

- [ ] **Step 1: 결과 문구** — `src/lib/regen-messages.ts`

```ts
// 뜻 다시 만들기 결과 문구. 서버 Action과 화면이 같이 쓴다.
// 버튼 자리(단어 목록 260px 열, 카드 출처 줄 오른쪽)에 한 줄로 들어가게 짧게 둔다.
// 키를 넣는 방법은 홈 화면 안내가 자세히 알려 준다.
export const REGEN_FAILED = '다시 만들지 못했습니다';
export const MISSING_KEY_MESSAGE = 'API 키가 없어 만들 수 없습니다';
```

- [ ] **Step 2: 버튼 자리 표시** — `src/components/ui/regen-slot.tsx`

```tsx
import { MISSING_KEY_MESSAGE } from "@/lib/regen-messages";
import { keepFocus } from "@/lib/ui/keys";
import { Spinner } from "./status";

// 뜻 다시 만들기의 진행·결과. 뜻은 제자리에 흐리게 두고(높이가 변하지 않게) 상태는 버튼 자리에 보인다.
export type RegenState = { phase: "busy" } | { phase: "done" } | { phase: "failed"; text: string };

// 평소에는 점선 밑줄, 마우스·키보드 포커스에서 강조색 실선 밑줄.
export const regenButtonClass =
  "text-muted underline decoration-dotted underline-offset-[3px] hover:text-accent hover:decoration-solid focus-visible:text-accent focus-visible:decoration-solid";

function RegenButton({ label, onClick, className }: { label: string; onClick: () => void; className: string }) {
  return (
    <button type="button" onMouseDown={keepFocus} onClick={onClick} className={className}>
      {label}
    </button>
  );
}

// state가 없으면 idle(평소 버튼들)을 그린다. 결과 문구는 호출한 쪽이 state를 지울 때까지 남는다.
export function RegenSlot({
  state,
  onRegenerate,
  idle,
  buttonClassName = regenButtonClass,
}: {
  state: RegenState | undefined;
  onRegenerate: () => void;
  idle: React.ReactNode;
  buttonClassName?: string;
}) {
  return (
    <span aria-live="polite" className="inline-flex flex-wrap items-center gap-x-1.5">
      {state === undefined ? (
        idle
      ) : state.phase === "busy" ? (
        <span className="inline-flex items-center gap-1.5 text-muted">
          <Spinner /> 다시 만드는 중
        </span>
      ) : state.phase === "done" ? (
        <>
          <span className="text-muted">새 뜻으로 바꿨습니다 ·</span>
          <RegenButton label="다시 만들기" onClick={onRegenerate} className={buttonClassName} />
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span aria-hidden className="w-2.5 border-t-2 border-dashed border-again" />
            <span>
              {state.text}
              {state.text !== MISSING_KEY_MESSAGE && " ·"}
            </span>
          </span>
          {/* 키가 없으면 다시 시도해도 같다 */}
          {state.text !== MISSING_KEY_MESSAGE && (
            <RegenButton label="다시 시도" onClick={onRegenerate} className={buttonClassName} />
          )}
        </>
      )}
    </span>
  );
}

export function RegenIdleButton({ onRegenerate, className = regenButtonClass }: { onRegenerate: () => void; className?: string }) {
  return <RegenButton label="뜻 다시 만들기" onClick={onRegenerate} className={className} />;
}
```

- [ ] **Step 3: Server Action** — `src/app/documents/[id]/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { isId, parseIdList } from "@/lib/validate";
import { getDb } from "@/server/db/client";
import { deleteCard, listFailedMeaningIds, occurrencesBelongTo } from "@/server/repo/cards";
import { MISSING_KEY_MESSAGE } from "@/lib/regen-messages";
import { defaultMeaningModel, regenerateMeanings } from "@/server/services/enrich";

const BAD_REQUEST = "잘못된 요청입니다.";

// 단어 목록과, 수가 바뀌는 홈·문서 목록을 다시 그린다.
function refresh(documentId: number) {
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/documents");
  revalidatePath("/");
}

export type RegenerateActionResult = { error: string } | { error: null; done: number; failed: number };

// 뜻 다시 만들기. occurrenceIds가 비어 있으면 이 문서의 실패한 뜻 전체("모두 다시 시도"),
// 있으면 그 용례들(이미 뜻이 있어도 새로 받는다. 실패하면 원래 뜻을 둔다).
export async function regenerateDocumentMeanings(
  documentId: unknown,
  occurrenceIds: unknown,
): Promise<RegenerateActionResult> {
  const ids = parseIdList(occurrenceIds);
  if (!isId(documentId) || ids === null) return { error: BAD_REQUEST };
  const db = getDb();
  if (!occurrencesBelongTo(db, documentId, ids)) return { error: BAD_REQUEST };
  const targets = ids.length > 0 ? ids : listFailedMeaningIds(db, documentId);
  const result = await regenerateMeanings(db, targets, defaultMeaningModel());
  if (result.error === "missing-key") return { error: MISSING_KEY_MESSAGE };
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

- [ ] **Step 4: 단어 표** — `src/app/documents/[id]/word-table.tsx`

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { Highlighted } from "@/components/ui/highlighted";
import { Kbd } from "@/components/ui/kbd";
import { RegenIdleButton, RegenSlot, type RegenState } from "@/components/ui/regen-slot";
import { REGEN_FAILED } from "@/lib/regen-messages";
import { Failed, Spinner } from "@/components/ui/status";
import { keepFocus } from "@/lib/ui/keys";
import type { OccurrenceView } from "@/server/repo/cards";
import { regenerateDocumentMeanings, removeCard } from "./actions";

export interface WordRow extends OccurrenceView {
  usageCount: number; // 이 카드의 용례 수(모든 문서)
}

const linkClass = "font-semibold text-accent hover:underline focus-visible:underline";

function MeaningText({ row, busy }: { row: WordRow; busy: boolean }) {
  if (row.meaningStatus === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
        <Spinner /> 뜻 만드는 중
      </span>
    );
  }
  // 다시 만드는 동안 원래 뜻(또는 실패 표시)을 제자리에 흐리게 둔다: 행 높이가 변하지 않는다.
  return (
    <span className={busy ? "opacity-50" : undefined}>
      {row.meaningStatus === "done" ? (
        <span className="text-[15px] font-semibold text-ink">{row.meaningKo}</span>
      ) : (
        <Failed>생성 실패</Failed>
      )}
    </span>
  );
}

// 문서 단어 목록 표. 행에 마우스를 올리거나 포커스가 들어오면 "뜻 다시 만들기 · 카드 삭제"가 바로 나온다
// (192행에 늘 떠 있으면 시끄럽다. 실패한 뜻 일괄 처리는 안내 줄의 "모두 다시 시도"가 맡는다).
// 다시 만들기의 진행·결과는 그 자리에 보이고, 다른 행에 마우스를 올리거나 페이지를 옮길 때까지 남는다.
// 뜻을 직접 고치는 기능은 두지 않는다: 모르는 단어를 공부하는 사람은 맞는 뜻을 알지 못하므로,
// 이상한 뜻은 다시 만들게 한다(2026-10-16 사용자 결정).
export function WordTable({ documentId, rows }: { documentId: number; rows: WordRow[] }) {
  const [regen, setRegen] = useState<Map<number, RegenState>>(new Map());
  const [rowMessage, setRowMessage] = useState<{ id: number; text: string } | null>(null);
  const [deleting, setDeleting] = useState<WordRow | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);

  const setRowRegen = (id: number, state: RegenState | undefined) =>
    setRegen((m) => {
      const next = new Map(m);
      if (state) next.set(id, state);
      else next.delete(id);
      return next;
    });

  // 다른 행에 마우스를 올리면 끝난 결과 문구를 지운다(진행 중인 것은 둔다).
  const clearOutcomes = (exceptId: number) =>
    setRegen((m) => {
      const stale = [...m].filter(([id, s]) => id !== exceptId && s.phase !== "busy");
      if (stale.length === 0) return m;
      const next = new Map(m);
      for (const [id] of stale) next.delete(id);
      return next;
    });

  const regenerate = (row: WordRow) => {
    if (regen.get(row.id)?.phase === "busy") return;
    setRowRegen(row.id, { phase: "busy" });
    regenerateDocumentMeanings(documentId, [row.id])
      .then((result) => {
        if (result.error !== null) setRowRegen(row.id, { phase: "failed", text: result.error });
        else if (result.failed > 0) setRowRegen(row.id, { phase: "failed", text: REGEN_FAILED });
        else setRowRegen(row.id, { phase: "done" });
      })
      .catch(() => setRowRegen(row.id, { phase: "failed", text: REGEN_FAILED }));
  };

  const openDelete = (row: WordRow) => {
    setDeleting(row);
    setRowMessage(null);
    dialog.current?.showModal();
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const row = deleting;
    startTransition(async () => {
      const result = await removeCard(documentId, row.wordId);
      if (result.error) setRowMessage({ id: row.id, text: result.error });
      else dialog.current?.close();
    });
  };

  return (
    <>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line-strong text-left text-xs font-semibold whitespace-nowrap text-muted">
              <th className="w-[200px] px-3 py-2">단어</th>
              <th className="w-[260px] px-3 py-2">문맥 뜻</th>
              <th className="px-3 py-2">원문 문장</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onMouseEnter={() => clearOutcomes(r.id)}
                className="group border-b border-line align-top hover:bg-sunken/60 focus-within:bg-sunken/60"
              >
                <td className="px-3 py-2.5">
                  <div className="font-en text-[17px] font-bold">{r.lemma}</div>
                  <div className="font-en text-sm text-muted">{r.phonetic ?? "발음기호 없음"}</div>
                </td>
                <td className="px-3 py-2.5">
                  <MeaningText row={r} busy={regen.get(r.id)?.phase === "busy"} />
                  {rowMessage?.id === r.id && !deleting && (
                    <p role="alert" className="mt-1 text-[13px] text-again">
                      {rowMessage.text}
                    </p>
                  )}
                  {/* invisible: 자리는 늘 차지해 행 높이가 변하지 않는다. 상태가 있거나 삭제 확인 중이면 늘 보인다 */}
                  <div
                    className={`mt-1.5 flex h-5 items-center text-[13px] ${
                      regen.has(r.id) || deleting?.id === r.id
                        ? ""
                        : "invisible group-hover:visible group-focus-within:visible"
                    }`}
                  >
                    <RegenSlot
                      state={regen.get(r.id)}
                      onRegenerate={() => regenerate(r)}
                      buttonClassName={linkClass}
                      idle={
                        <span className="inline-flex gap-3">
                          <RegenIdleButton onRegenerate={() => regenerate(r)} className={linkClass} />
                          <button
                            type="button"
                            className="font-semibold text-muted hover:underline focus-visible:underline"
                            onMouseDown={keepFocus}
                            onClick={() => openDelete(r)}
                          >
                            카드 삭제
                          </button>
                        </span>
                      }
                    />
                  </div>
                </td>
                <td className="px-3 py-2.5 font-en text-[15.5px] leading-[1.55] text-ink-2">
                  <Highlighted sentence={r.sentence} word={r.surface} />
                </td>
              </tr>
            ))}
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
            {rowMessage?.id === deleting.id && (
              <p role="alert" className="mb-3 text-[13px] text-again">
                {rowMessage.text}
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

- [ ] **Step 5: 모두 다시 시도 버튼** — `src/app/documents/[id]/retry-all-button.tsx`

```tsx
"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/status";
import { regenerateDocumentMeanings } from "./actions";

// 안내 줄의 "모두 다시 시도": 이 문서의 실패한 뜻을 한 번에 다시 만든다.
export function RetryAllButton({ documentId }: { documentId: number }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const retry = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await regenerateDocumentMeanings(documentId, []);
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

- [ ] **Step 6: 페이지** — `src/app/documents/[id]/page.tsx`

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

- [ ] **Step 7: 확인과 커밋**

Run: `npm run typecheck`, `npm run lint`
Expected: 오류 0

```bash
git add -A
git commit -m "feat: regenerate meanings and delete cards from the word list"
```

---

### Task 5: 복습 화면과 저장 입력 검사

**Files:**
- Modify: `src/app/documents/[id]/review/actions.ts`(전체 교체), `src/server/repo/study.ts`(두 줄), `src/app/study/actions.ts`(전체 교체), `src/app/study/study-session.tsx`(전체 교체)

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

- [ ] **Step 2: 용례 id 노출** — `src/server/repo/study.ts`

`Usage`에 `occurrenceId: number;`를 맨 앞 필드로 넣고, `usagesByWord`의 select에 `occurrenceId: occurrences.id,`를 `wordId` 다음에 넣는다.

- [ ] **Step 3: 복습 Action** — `src/app/study/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { Intervals } from "@/lib/srs/interval";
import { ANSWERS, type Answer } from "@/lib/srs/scheduler";
import { isId } from "@/lib/validate";
import { getDb } from "@/server/db/client";
import { getOccurrenceMeaning } from "@/server/repo/cards";
import { recordAnswer, StudyError } from "@/server/repo/study";
import { MISSING_KEY_MESSAGE } from "@/lib/regen-messages";
import { defaultMeaningModel, regenerateMeanings } from "@/server/services/enrich";

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

export type RegenerateUsageResult =
  | { error: string }
  | { error: null; meaningKo: string | null; meaningStatus: "pending" | "done" | "failed"; failed: boolean };

// 카드 뒷면의 "다시 만들기": 용례 하나의 뜻을 새로 받는다. 실패하면 원래 뜻이 그대로 남고 failed가 true다.
export async function regenerateUsageMeaning(occurrenceId: unknown): Promise<RegenerateUsageResult> {
  if (!isId(occurrenceId)) return { error: "잘못된 요청입니다." };
  const db = getDb();
  if (!getOccurrenceMeaning(db, occurrenceId)) return { error: "용례를 찾을 수 없습니다." };
  const result = await regenerateMeanings(db, [occurrenceId], defaultMeaningModel());
  if (result.error === "missing-key") return { error: MISSING_KEY_MESSAGE };
  const meaning = getOccurrenceMeaning(db, occurrenceId);
  if (!meaning) return { error: "용례를 찾을 수 없습니다." }; // 그 사이 카드가 지워졌다
  revalidatePath("/documents", "layout"); // 문서 단어 목록에도 새 뜻이 보이게 한다
  return { error: null, ...meaning, failed: result.failed > 0 };
}
```

- `answerCard`의 `revalidatePath("/", "layout")`은 레이아웃의 "오늘 남은 수" 배지를 다시 그린다. 복습 큐는 `StudySession`의 `useState` 초깃값이라 바뀌지 않는다(Task 6에서 확인).
- `regenerateUsageMeaning`은 용례 하나를 다시 만들고 지금 뜻을 돌려준다. 실패하면 원래 뜻과 함께 `failed: true`다.

- [ ] **Step 4: 복습 세션** — `src/app/study/study-session.tsx` 전체

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { Highlighted } from "@/components/ui/highlighted";
import { Kbd } from "@/components/ui/kbd";
import { RegenIdleButton, RegenSlot, type RegenState } from "@/components/ui/regen-slot";
import { REGEN_FAILED } from "@/lib/regen-messages";
import { Failed, Spinner } from "@/components/ui/status";
import { Tag } from "@/components/ui/tag";
import { formatInterval } from "@/lib/srs/interval";
import type { Answer } from "@/lib/srs/scheduler";
import { advanceQueue } from "@/lib/srs/session";
import { isNativeEnterTarget, isNativeSpaceTarget, isTypingTarget } from "@/lib/ui/keys";
import type { StudyCard, Usage } from "@/server/repo/study";
import { answerCard, regenerateUsageMeaning } from "./actions";
import { SpeakButton, speak } from "./speak-button";

const ANSWER_BUTTONS: { answer: Answer; label: string; key: string; tone: string }[] = [
  { answer: "again", label: "모름", key: "1", tone: "bg-again-soft text-again" },
  { answer: "hard", label: "애매", key: "2", tone: "bg-hard-soft text-hard" },
  { answer: "good", label: "앎", key: "3", tone: "bg-good-soft text-good" },
];

// 세션을 마친 뒤 이 시간 안에 다시 나오는 카드(학습 단계)를 따로 알려 준다.
const SOON_WINDOW_MS = 60 * 60_000;

interface Soon {
  count: number;
  minutes: number;
}

function UsageBlock({
  usage,
  primary,
  regen,
  onRegenerate,
}: {
  usage: Usage;
  primary: boolean;
  regen: RegenState | undefined;
  onRegenerate: () => void;
}) {
  return (
    <div className={primary ? "mt-6 border-t border-line pt-5" : "mt-4 border-t border-dashed border-line pt-4"}>
      {/* 다시 만드는 동안 원래 뜻을 제자리에 흐리게 둔다: 카드 높이와 아래 답 버튼 위치가 변하지 않는다 */}
      <div
        className={`${primary ? "text-[22px] leading-[1.45] font-bold" : "text-[17px] font-bold"} ${
          regen?.phase === "busy" ? "opacity-50" : ""
        }`}
      >
        {usage.meaningStatus === "done" ? (
          usage.meaningKo
        ) : usage.meaningStatus === "failed" ? (
          <Failed>문맥 뜻을 만들지 못했습니다</Failed>
        ) : (
          <span className="inline-flex items-center gap-2 text-[15px] font-normal text-muted">
            <Spinner /> 뜻 만드는 중
          </span>
        )}
      </div>
      <p className={`mt-2.5 font-en text-ink-2 ${primary ? "text-lg leading-[1.6]" : "text-base leading-[1.6]"}`}>
        <Highlighted sentence={usage.sentence} word={usage.surface} />
      </p>
      {/* 출처는 왼쪽, 다시 만들기는 오른쪽 끝: 제목 길이와 상관없이 용례마다 같은 자리다 */}
      <div className="mt-2 flex items-start justify-between gap-4 text-[12.5px] leading-5 text-muted">
        <p>
          — <span className="font-en text-[13.5px] italic">{usage.documentTitle}</span>
        </p>
        <div className="flex h-5 shrink-0 items-center whitespace-nowrap">
          <RegenSlot
            state={regen}
            onRegenerate={onRegenerate}
            idle={<RegenIdleButton onRegenerate={onRegenerate} />}
          />
        </div>
      </div>
    </div>
  );
}

export function StudySession({ cards }: { cards: StudyCard[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [lastDue, setLastDue] = useState<Map<number, number>>(new Map());
  const [soon, setSoon] = useState<Soon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  // 용례별 다시 만들기 상태. 결과 문구는 그 카드를 보는 동안만 남는다.
  const [regen, setRegen] = useState<Map<number, RegenState>>(new Map());
  const currentWordId = useRef<number | null>(null);
  const locked = useRef(false);

  const card = queue[0];

  const answer = (choice: Answer) => {
    // saving(isPending)은 다음 렌더에야 버튼을 막으므로, 같은 순간의 두 번째 입력은 ref로 즉시 막는다.
    if (!card || locked.current) return;
    locked.current = true;
    startSaving(async () => {
      try {
        const result = await answerCard(card.wordId, choice);
        if (result.error !== null) {
          setError(result.error);
          return;
        }
        setError(null);
        setAnswered((n) => n + 1);
        if (choice === "again") setAgainCount((n) => n + 1);
        const dues = new Map(lastDue).set(card.wordId, result.due);
        setLastDue(dues);
        const next = advanceQueue(queue, choice).map((c) =>
          c.wordId === card.wordId ? { ...c, isNew: false, intervals: result.intervals } : c,
        );
        if (next.length === 0) {
          const now = Date.now();
          const pending = [...dues.values()].filter((due) => due > now && due - now <= SOON_WINDOW_MS);
          setSoon(
            pending.length > 0
              ? { count: pending.length, minutes: Math.max(1, Math.ceil((Math.min(...pending) - now) / 60_000)) }
              : null,
          );
        }
        setQueue(next);
        setRevealed(false);
        // 다음 카드로 넘어가면 결과 문구를 지운다. 진행 중인 요청의 스피너는 그 카드가 다시 나올 때를 위해 둔다.
        setRegen((m) => new Map([...m].filter(([, s]) => s.phase === "busy")));
      } finally {
        locked.current = false; // 실패해도 다시 누를 수 있게 푼다
      }
    });
  };

  useEffect(() => {
    currentWordId.current = card?.wordId ?? null;
  });

  const setUsageRegen = (occurrenceId: number, state: RegenState | undefined) =>
    setRegen((m) => {
      const next = new Map(m);
      if (state) next.set(occurrenceId, state);
      else next.delete(occurrenceId);
      return next;
    });

  // 용례 하나의 뜻을 다시 받아 큐 안의 같은 용례를 모두 바꾼다. 기다리는 동안에도 1·2·3 응답은 된다.
  // 끝났을 때 이미 다음 카드로 넘어갔으면 결과 문구는 남기지 않는다(그 카드가 다시 나오면 새 뜻만 보인다).
  const regenerate = (wordId: number, occurrenceId: number) => {
    if (regen.get(occurrenceId)?.phase === "busy") return;
    setUsageRegen(occurrenceId, { phase: "busy" });
    const finish = (state: RegenState) =>
      setUsageRegen(occurrenceId, currentWordId.current === wordId ? state : undefined);
    regenerateUsageMeaning(occurrenceId)
      .then((result) => {
        if (result.error !== null) {
          finish({ phase: "failed", text: result.error });
          return;
        }
        setQueue((q) =>
          q.map((c) => ({
            ...c,
            usages: c.usages.map((u) =>
              u.occurrenceId === occurrenceId
                ? { ...u, meaningKo: result.meaningKo, meaningStatus: result.meaningStatus }
                : u,
            ),
          })),
        );
        finish(result.failed ? { phase: "failed", text: REGEN_FAILED } : { phase: "done" });
      })
      .catch(() => finish({ phase: "failed", text: REGEN_FAILED }));
  };

  // 키보드: Space/Enter 뒷면, 1·2·3 응답, P 발음, 완료 화면에서 Enter 홈. 입력칸에서는 끈다.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKey.current = (e) => {
      const target = e.target as HTMLInputElement | null;
      if (isTypingTarget(target) || e.ctrlKey || e.metaKey || e.altKey) return;
      // 포커스된 버튼·링크 위의 Space·Enter는 브라우저가 그것을 누르므로 여기서 또 처리하지 않는다.
      // (완료 화면의 "다시 확인" 링크에서 Enter가 링크 이동과 홈 이동을 함께 실행하던 문제)
      if (e.key === " " && isNativeSpaceTarget(target)) return;
      if (e.key === "Enter" && isNativeEnterTarget(target)) return;
      if (!card) {
        if (e.key === "Enter") router.push("/");
        return;
      }
      if (e.key === "p" || e.key === "P") {
        speak(card.lemma);
      } else if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed) {
        const hit = ANSWER_BUTTONS.find((b) => b.key === e.key);
        if (hit) {
          e.preventDefault();
          answer(hit.answer);
        }
      }
    };
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  if (!card) {
    return (
      <div className="py-16 text-center">
        <p className="text-[22px] font-bold">오늘 복습을 마쳤습니다</p>
        {answered > 0 && (
          <p className="mt-4 inline-flex gap-5 text-sm text-ink-2">
            <span>
              카드 <b className="tabular-nums">{lastDue.size}</b>장
            </span>
            <span>
              응답 <b className="tabular-nums">{answered}</b>번
            </span>
            <span>
              모름 <b className="text-again tabular-nums">{againCount}</b>
            </span>
          </p>
        )}
        {soon && (
          <p className="mt-3 text-sm text-muted">
            {soon.count}장은 약 {soon.minutes}분 뒤 다시 나옵니다 ·{" "}
            <a href="/study" className="font-semibold text-accent">
              다시 확인
            </a>
          </p>
        )}
        <div className="mt-6">
          <button type="button" onClick={() => router.push("/")} className={buttonClass({ variant: "primary" })}>
            홈으로 <Kbd onAccent>Enter</Kbd>
          </button>
        </div>
      </div>
    );
  }

  const total = answered + queue.length;
  const [first, second] = card.usages;

  return (
    <div>
      <div className="flex items-center gap-3.5 text-[13px] text-muted">
        <span className="tabular-nums">
          {answered} / {total}
        </span>
        <span className="h-1 flex-1 overflow-hidden rounded-sm bg-sunken">
          <span className="block h-full bg-accent" style={{ width: `${(answered / total) * 100}%` }} />
        </span>
        <span>
          남은 <b className="text-ink tabular-nums">{queue.length}</b>
        </span>
      </div>

      <section className="mt-5 flex min-h-[380px] flex-col rounded-lg border border-line bg-surface px-12 pt-10 pb-8 shadow-1 max-[900px]:px-5 max-[900px]:pt-7">
        {card.isNew && (
          <div>
            <Tag kind="new" />
          </div>
        )}
        <div className={`flex items-center gap-3 ${card.isNew ? "mt-4" : ""}`}>
          <h2
            className={`font-en leading-[1.1] font-bold tracking-[-0.01em] ${
              revealed ? "text-[40px]" : "text-[52px] max-[900px]:text-[38px]"
            }`}
          >
            {card.lemma}
          </h2>
          <SpeakButton text={card.lemma} />
        </div>

        {revealed ? (
          <>
            <p className={`mt-1 font-en text-[19px] ${card.phonetic ? "text-muted" : "text-[15px] text-muted"}`}>
              {card.phonetic ?? "발음기호 없음"}
            </p>
            {[first, second].map(
              (u, i) =>
                u && (
                  <UsageBlock
                    key={u.occurrenceId}
                    usage={u}
                    primary={i === 0}
                    regen={regen.get(u.occurrenceId)}
                    onRegenerate={() => regenerate(card.wordId, u.occurrenceId)}
                  />
                ),
            )}
          </>
        ) : (
          <p className="mt-auto pt-12 text-center text-sm text-muted">이 문서에서 어떤 뜻이었는지 떠올려 보세요</p>
        )}
      </section>

      {revealed ? (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {ANSWER_BUTTONS.map((b) => (
            <button
              key={b.answer}
              type="button"
              disabled={saving}
              onClick={() => answer(b.answer)}
              className={`grid justify-items-center gap-0.5 rounded-lg px-3.5 py-3.5 disabled:opacity-55 ${b.tone}`}
            >
              <b className="text-base">{b.label}</b>
              <span className="text-xs opacity-80">{formatInterval(card.intervals[b.answer])} 뒤</span>
              <span className="mt-1">
                <Kbd>{b.key}</Kbd>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface p-3.5 text-[15px] font-semibold text-ink hover:bg-sunken"
        >
          뒷면 보기 <Kbd>Space</Kbd>
        </button>
      )}
      <p className="mt-2.5 text-center text-[13px] text-muted">
        <Kbd>P</Kbd> 발음 듣기
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-again">
          {error}
        </p>
      )}
    </div>
  );
}
```

바뀐 곳(Designer 2026-10-16):
- 카드 뒷면 용례마다 "뜻 다시 만들기". 출처 줄을 양쪽 정렬로 바꿔 출처는 왼쪽, 버튼은 오른쪽 끝(제목이 길어도 용례마다 같은 자리, 줄바꿈 없음). 평소에는 회색 점선 밑줄, 마우스·키보드 포커스에서 강조색 실선 밑줄. 아이콘 없음. 처음부터 뜻이 없던 용례도 같은 문구다.
- 누르면 원래 뜻은 제자리에 흐리게, 버튼 자리에 스피너 "다시 만드는 중". 결과 표시는 단어 목록과 같다(`RegenSlot`). 끝나면 큐 안의 같은 용례를 모두 새 뜻으로 바꾼다.
- 결과 문구는 그 카드를 보는 동안만 남는다. 응답해서 다음 카드로 넘어가면 지운다. 요청은 계속 진행되고, 끝났을 때 이미 다른 카드면 문구 없이 새 뜻만 큐에 넣는다.
- 기다리는 동안 1·2·3 응답은 막지 않는다(`useTransition`이 아닌 별도 상태).
- 키 처리기: 포커스된 링크 위 `Enter`는 링크만 누른다(완료 화면의 "다시 확인" 링크에서 Enter가 링크 이동과 홈 이동을 함께 실행하던 문제). 버튼 위 `Space`·`Enter`도 그대로 버튼만 누른다.

- [ ] **Step 5: 전체 확인과 커밋**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 157 tests PASS, 오류 0, 빌드 성공

```bash
git add -A
git commit -m "feat: regenerate a meaning from the study card; validate save input, refresh the badge, respect Enter on links"
```

---

### Task 6: 브라우저 확인, 리뷰, 병합

- [ ] **Step 1: 브라우저 흐름** (데모 DB 사본, `next start -p 3300`, 헤드리스 Edge)

PM이 계획을 쓰며 같은 방식으로 확인한 결과다. 같은 동작이 나와야 한다.
- 단어 목록 첫 행(실패한 뜻) 위에 마우스: "뜻 다시 만들기 · 카드 삭제"가 바로 나온다. "뜻 다시 만들기": "생성 실패"가 흐려지고 동작 줄 자리에 "다시 만드는 중", 몇 초 뒤 뜻이 채워지고 "새 뜻으로 바꿨습니다 · 다시 만들기"(실제 API 1회. 예: ablate "제거하다"). 행 높이가 그대로다(PM 측정 73.4px → 73.4px). 다른 행에 마우스를 올리면 결과 문구가 사라진다.
- 뜻이 있는 행에서도 "뜻 다시 만들기"가 동작한다(실제 API 1회).
- "카드 삭제" → 확인창 "ablation 카드와 용례 1개, 복습 기록이 모두 지워집니다. 되돌릴 수 없습니다." → 삭제: 행이 사라진다.
- 안내 줄 "모두 다시 시도": 실패한 뜻이 약 12초 만에 채워지고 안내 줄이 사라진다(실제 API, 약 $0.02).
- 복습 카드 뒷면에서 용례의 "뜻 다시 만들기"(출처 줄 오른쪽 끝): 뜻이 흐려지고 버튼 자리에 "다시 만드는 중", 끝나면 새 뜻(예: layer "층")과 "새 뜻으로 바꿨습니다 · 다시 만들기". 다른 용례는 그대로다. "모름" 버튼의 y 위치가 누르기 전·진행 중·끝난 뒤 모두 같다(PM 측정 713.8px 세 번). 응답해서 다음 카드로 가면 결과 문구가 없다.
- 키 없이 띄운 서버(`.env.local` 없음)에서 같은 버튼: "— API 키가 없어 만들 수 없습니다"만 나오고 다시 시도 버튼은 없다. 답 버튼 위치는 그대로다.
- 복습에서 한 장 답하면 상단 배지가 20 → 19가 되고, 진행 표시는 "1 / 20"으로 이어진다(세션 상태 유지). 완료 화면에서 "다시 확인" 링크에 포커스를 두고 `Enter`를 누르면 `/study`로만 간다.
- 새 PDF를 하나 저장해 발음기호가 채워지는지 본다(CMUdict 우선이라 사전 API가 죽어 있어도 같다).
- 실패 시 원래 뜻 유지는 Task 3 단위 테스트로 확인한다(실제 API로 실패를 일부러 만들지 않는다).

- [ ] **Step 2: Codex 리뷰와 병합**

Orca의 Codex 터미널에 브랜치 전체 리뷰를 맡긴다(범위 `main..feat/m4-1-regenerate-delete`, `orca terminal send`/`read`). Important 이상은 테스트를 먼저 써서 고친다. main에 로컬 병합(`--no-ff`)한 뒤, main에서 test·typecheck·lint·build 결과와 병합 커밋 해시, 리뷰 요약을 PM에게 보낸다. 키 값은 출력하지 않는다.
