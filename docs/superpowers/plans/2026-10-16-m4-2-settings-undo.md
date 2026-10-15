# 마일스톤 4-2: 설정 화면·직전 응답 되돌리기·발음 자동 재생·검토 문장 줄이기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매일 쓰기 편하게 만든다. 잘못 누른 응답을 `Z`로 되돌리고, 설정 화면에서 흔한 단어 제외 기준·하루 새 카드 수·화면 테마·발음 자동 재생을 바꾸고, 검토 표의 긴 문장을 2줄 안으로 줄인다.

**Architecture:** 기존 구조 그대로다. 되돌리기는 `review_logs.prev_card`(응답 전 카드 상태 JSON, 마이그레이션 0004)와 `repo/study.ts`의 `undoAnswer`가 맡는다. 설정 입력 검사는 순수 함수(`lib/settings.ts`), 저장은 `repo/settings.ts`, 화면은 `app/settings`의 Server Action과 클라이언트 폼이다. 테마는 쿠키에 두고 레이아웃 `<head>`의 인라인 스크립트가 첫 화면 전에 적용한다(정적 셸 유지). 문장 줄이기는 화면용 순수 함수(`lib/text/truncate.ts`)다.

**Tech Stack:** 기존 스택 그대로(새 의존성 없음)

**Spec:** `docs/superpowers/specs/2026-10-16-m4-2-settings-undo-design.md`(사용자 승인, Designer 화면 규칙 6장 포함), 상위 설계서 11장 M4

## Global Constraints

- 작업 브랜치: `feat/m4-2-settings-undo` (main에서 분기). 태스크마다 커밋한다.
- 리뷰는 Orca에 떠 있는 Codex 터미널에 맡긴다(`orca terminal send`/`read`). 심각도 분류는 그대로이고, Important 이상은 테스트를 먼저 써서 고친다.
- 되돌리기는 **이번 세션의 마지막 응답 한 번**만(사용자 결정 A). 서버는 그 카드의 가장 최근 기록일 때만 되돌린다.
- 테마는 **쿠키**(사용자 결정 A). 레이아웃에서 `cookies()`나 DB를 읽지 않는다. 읽으면 앱 전체가 정적 셸을 잃는다(빌드 표에서 모든 페이지가 `◐`여야 한다).
- 하루 새 카드 수 0은 올바른 값이다(새 카드 없이 복습만).
- 저장용 300자 자르기(`extract.ts`의 `truncateAround`)는 바꾸지 않는다. 검토 표의 140자 줄이기는 화면에서만 한다.
- 색은 토큰만, 단축키는 입력칸에서 끈다(UI 개편 규칙 그대로).
- 실제 Gemini 호출은 없다. 키는 필요 없다.

## Review Focus

1. 되돌리기가 카드 상태를 정확히 되돌리는지: 새 카드의 `introducedAt`(하루 새 카드 수), 학습 중 카드의 일정, 기록 수(Task 1 테스트).
2. 다른 탭에서 같은 카드에 또 답했을 때 되돌리기가 거부되는지, 같은 기록을 두 번 되돌릴 수 없는지(Task 1).
3. 설정 저장이 하나라도 틀리면 아무것도 저장하지 않는지, 화면이 보낼 수 없는 값(테마 "blue", 문자열 autoSpeak)을 거부하는지(Task 2, Task 4 Action).
4. 레이아웃이 요청 시점 데이터를 읽지 않는지(테마 인라인 스크립트, Task 4). 쿠키 값은 정규식으로 `light|dark`만 받는다.
5. 되돌리기와 응답이 겹칠 때: 처리 중 키 입력 무시(`locked`), "모름"으로 큐 뒤에 다시 들어간 같은 카드를 빼고 앞면으로 맨 앞에 둠, 그 사이 바뀐 뜻(다시 만들기) 유지(Task 5).

---

## 파일 구조

| 파일 | 책임 | 태스크 |
|---|---|---|
| `src/server/db/schema.ts`, `drizzle/0004_review_prev_card.sql` | `review_logs.prev_card` | 1 |
| `src/server/repo/study.ts` | `recordAnswer`가 `logId`를 돌려줌, 응답 전 상태 저장, `undoAnswer` | 1 |
| `src/lib/settings.ts` | 설정 범위, 테마 값, 입력 검사 | 2 |
| `src/server/repo/settings.ts` | `autoSpeak`, 0 허용, `saveSettings` | 2 |
| `src/lib/text/highlight.ts`, `src/lib/text/truncate.ts` | 첫 일치 위치, 화면용 문장 줄이기 | 3 |
| `src/app/documents/[id]/review/candidate-table.tsx` | 줄인 문장과 `title` | 3 |
| `src/components/ui/segmented.tsx`, `src/app/documents/upload-form.tsx` | 공용 Segmented | 4 |
| `src/lib/ui/theme.ts`, `src/components/theme-sync.tsx`, `src/app/layout.tsx` | 테마 적용(인라인 스크립트, 개발 모드 재적용) | 4 |
| `src/components/nav/nav-links.tsx` | 상단 바 오른쪽 끝 "설정" | 4 |
| `src/app/settings/{actions.ts, page.tsx, settings-form.tsx}` | 설정 화면 | 4 |
| `src/app/study/{actions.ts, page.tsx, study-session.tsx}` | 되돌리기 Action·화면, 자동 재생 | 5 |

테스트 수: 시작 164 → Task 1 후 168 → Task 2 후 173 → Task 3 후 177.

---

### Task 1: 되돌리기 저장소

**Files:**
- Modify: `src/server/db/schema.ts`(열 하나), `src/server/repo/study.ts`(전체 교체)
- Create: `drizzle/0004_review_prev_card.sql`(생성), `tests/server/undo-answer.test.ts`

**Interfaces:**
- Produces: `recordAnswer(...) → { due, intervals, logId }`, `undoAnswer(db, logId): { wordId }`(거부는 `StudyError`)

- [ ] **Step 1: 브랜치**

```bash
git checkout main
git checkout -b feat/m4-2-settings-undo
```

- [ ] **Step 2: 열과 마이그레이션**

`src/server/db/schema.ts`의 `reviewLogs`에서 `reviewedAt` 다음에 넣는다.

```ts
  // 응답 전 카드의 일정 상태(JSON). 직전 응답 되돌리기에 쓴다. 이 열이 생기기 전 기록은 null.
  prevCard: text('prev_card'),
```

```bash
npm run db:generate -- --name review_prev_card
```

Expected: `drizzle/0004_review_prev_card.sql`이 `ALTER TABLE \`review_logs\` ADD \`prev_card\` text;` 한 줄이고, `drizzle/meta/_journal.json`과 `0004_snapshot.json`이 생긴다. 셋 다 커밋한다.

- [ ] **Step 3: 실패하는 테스트 작성** — `tests/server/undo-answer.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { reviewLogs, words } from '@/server/db/schema';
import { saveReviewSelection } from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, updateDocumentStatus } from '@/server/repo/documents';
import { countStudyToday, recordAnswer, StudyError, undoAnswer } from '@/server/repo/study';

const now = new Date(2026, 9, 16, 10, 0, 0);
const MIN = 60_000;

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

function saveCards(lemmas: string[]) {
  const doc = createDocument(db, { title: 'A', kind: 'paper' });
  replaceCandidates(
    db,
    doc.id,
    lemmas.map((lemma) => ({
      lemma,
      surface: lemma,
      sentence: `In A, ${lemma} matters.`,
      count: 1,
      isExisting: false,
      inDictionary: true,
    })),
  );
  updateDocumentStatus(db, doc.id, 'reviewing');
  saveReviewSelection(db, doc.id, listCandidates(db, doc.id).map((c) => c.id));
}

const card = (lemma: string) => db.select().from(words).all().find((w) => w.lemma === lemma)!;

describe('undoAnswer', () => {
  it('restores a new card and gives the daily new slot back', () => {
    saveCards(['alpha', 'beta']);
    const before = card('alpha');
    const { logId } = recordAnswer(db, before.id, 'good', now);
    expect(countStudyToday(db, now, 1).fresh).toBe(0);

    expect(undoAnswer(db, logId)).toEqual({ wordId: before.id });
    expect(card('alpha')).toEqual(before);
    expect(db.select().from(reviewLogs).all()).toEqual([]);
    expect(countStudyToday(db, now, 1).fresh).toBe(1);
  });

  it('restores a reviewed card to its state before the last answer only', () => {
    saveCards(['alpha']);
    const id = card('alpha').id;
    recordAnswer(db, id, 'good', now);
    const afterFirst = card('alpha');
    const { logId } = recordAnswer(db, id, 'again', new Date(now.getTime() + 10 * MIN));

    undoAnswer(db, logId);
    expect(card('alpha')).toEqual(afterFirst);
    expect(db.select().from(reviewLogs).all()).toHaveLength(1);
  });

  it('refuses when the card was answered again afterwards', () => {
    saveCards(['alpha']);
    const id = card('alpha').id;
    const first = recordAnswer(db, id, 'again', now);
    recordAnswer(db, id, 'good', new Date(now.getTime() + MIN));
    expect(() => undoAnswer(db, first.logId)).toThrow(StudyError);
    expect(db.select().from(reviewLogs).all()).toHaveLength(2);
  });

  it('refuses a missing log, a second undo, and a log without a snapshot', () => {
    saveCards(['alpha']);
    const { logId } = recordAnswer(db, card('alpha').id, 'good', now);
    undoAnswer(db, logId);
    expect(() => undoAnswer(db, logId)).toThrow(StudyError);

    const old = db
      .insert(reviewLogs)
      .values({ wordId: card('alpha').id, rating: 3, reviewedAt: now })
      .returning({ id: reviewLogs.id })
      .get();
    expect(() => undoAnswer(db, old.id)).toThrow('되돌릴 수 없습니다');
  });
});
```

Run: `npx vitest run tests/server/undo-answer.test.ts`
Expected: FAIL — `undoAnswer` 없음

- [ ] **Step 4: 구현** — `src/server/repo/study.ts` 전체

```ts
import { and, asc, count, desc, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { previewIntervals, type Intervals } from '@/lib/srs/interval';
import {
  ANSWER_GRADE,
  applyAnswer,
  newCardSlots,
  startOfLocalDay,
  type Answer,
} from '@/lib/srs/scheduler';
import type { Db } from '../db/client';
import { documents, occurrences, reviewLogs, words, type MeaningStatus, type WordRow } from '../db/schema';

const NEW_STATE = 0;
const USAGES_PER_CARD = 2;

export class StudyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudyError';
  }
}

export interface Usage {
  occurrenceId: number;
  surface: string;
  sentence: string;
  meaningKo: string | null;
  meaningStatus: MeaningStatus;
  documentTitle: string;
}

export interface StudyCard {
  wordId: number;
  lemma: string;
  phonetic: string | null;
  isNew: boolean;
  usages: Usage[]; // 최신 용례부터 최대 2개
  intervals: Intervals; // 응답별 다음 복습까지(ms). 답 버튼에 보여 준다
}

function countIntroducedToday(db: Db, now: Date): number {
  const row = db
    .select({ total: count() })
    .from(words)
    .where(gte(words.introducedAt, startOfLocalDay(now)))
    .get();
  return row?.total ?? 0;
}

function dueReviews(db: Db, now: Date): WordRow[] {
  return db
    .select()
    .from(words)
    .where(and(ne(words.state, NEW_STATE), lte(words.due, now)))
    .orderBy(asc(words.due), asc(words.id))
    .all();
}

function newCards(db: Db, limit: number): WordRow[] {
  if (limit <= 0) return [];
  return db
    .select()
    .from(words)
    .where(eq(words.state, NEW_STATE))
    .orderBy(asc(words.createdAt), asc(words.id))
    .limit(limit)
    .all();
}

function usagesByWord(db: Db, wordIds: number[]): Map<number, Usage[]> {
  const byWord = new Map<number, Usage[]>();
  if (wordIds.length === 0) return byWord;
  const rows = db
    .select({
      wordId: occurrences.wordId,
      occurrenceId: occurrences.id,
      surface: occurrences.surface,
      sentence: occurrences.sentence,
      meaningKo: occurrences.meaningKo,
      meaningStatus: occurrences.meaningStatus,
      documentTitle: documents.title,
    })
    .from(occurrences)
    .innerJoin(documents, eq(documents.id, occurrences.documentId))
    .where(inArray(occurrences.wordId, wordIds))
    .orderBy(desc(occurrences.createdAt), desc(occurrences.id))
    .all();
  for (const { wordId, ...usage } of rows) {
    const list = byWord.get(wordId) ?? [];
    if (list.length < USAGES_PER_CARD) list.push(usage);
    byWord.set(wordId, list);
  }
  return byWord;
}

// 오늘의 큐: 복습할 때가 된 카드(due 순) + 새 카드(만든 순, 하루 상한까지). 스펙 8.6.
export function getStudyQueue(db: Db, now: Date, dailyNewLimit: number): StudyCard[] {
  const slots = newCardSlots(dailyNewLimit, countIntroducedToday(db, now));
  const picked = [...dueReviews(db, now), ...newCards(db, slots)];
  const usages = usagesByWord(db, picked.map((w) => w.id));
  return picked.map((w) => ({
    wordId: w.id,
    lemma: w.lemma,
    phonetic: w.phonetic,
    isNew: w.state === NEW_STATE,
    usages: usages.get(w.id) ?? [],
    intervals: previewIntervals(w, now),
  }));
}

export function countStudyToday(
  db: Db,
  now: Date,
  dailyNewLimit: number,
): { review: number; fresh: number } {
  const review =
    db
      .select({ total: count() })
      .from(words)
      .where(and(ne(words.state, NEW_STATE), lte(words.due, now)))
      .get()?.total ?? 0;
  const waiting =
    db.select({ total: count() }).from(words).where(eq(words.state, NEW_STATE)).get()?.total ?? 0;
  const slots = newCardSlots(dailyNewLimit, countIntroducedToday(db, now));
  return { review, fresh: Math.min(waiting, slots) };
}

// 응답 전 카드의 일정 상태. review_logs.prev_card에 JSON으로 둔다(시각은 ms).
interface CardSnapshot {
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: number | null;
  introducedAt: number | null;
}

function snapshot(w: WordRow): CardSnapshot {
  return {
    due: w.due.getTime(),
    stability: w.stability,
    difficulty: w.difficulty,
    elapsedDays: w.elapsedDays,
    scheduledDays: w.scheduledDays,
    learningSteps: w.learningSteps,
    reps: w.reps,
    lapses: w.lapses,
    state: w.state,
    lastReview: w.lastReview?.getTime() ?? null,
    introducedAt: w.introducedAt?.getTime() ?? null,
  };
}

function restore(s: CardSnapshot) {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsedDays: s.elapsedDays,
    scheduledDays: s.scheduledDays,
    learningSteps: s.learningSteps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    lastReview: s.lastReview === null ? null : new Date(s.lastReview),
    introducedAt: s.introducedAt === null ? null : new Date(s.introducedAt),
  };
}

// 응답을 기록하고 다음 복습 일정을 저장한다. 새 카드는 처음 응답한 시각을 introducedAt으로 남긴다.
// 돌려주는 intervals는 응답 뒤 상태 기준 미리보기다. "모름"으로 세션 뒤에 다시 넣는 카드의 답 버튼을 갱신할 때 쓴다.
// logId는 이 응답의 기록 id다. 직전 응답 되돌리기(undoAnswer)에 쓴다.
export function recordAnswer(
  db: Db,
  wordId: number,
  answer: Answer,
  now: Date,
): { due: Date; intervals: Intervals; logId: number } {
  return db.transaction((tx) => {
    const word = tx.select().from(words).where(eq(words.id, wordId)).get();
    if (!word) throw new StudyError('카드를 찾을 수 없습니다.');
    const next = applyAnswer(word, answer, now);
    tx.update(words)
      .set({ ...next, introducedAt: word.introducedAt ?? now })
      .where(eq(words.id, wordId))
      .run();
    const log = tx
      .insert(reviewLogs)
      .values({ wordId, rating: ANSWER_GRADE[answer], reviewedAt: now, prevCard: JSON.stringify(snapshot(word)) })
      .returning({ id: reviewLogs.id })
      .get();
    return { due: next.due, intervals: previewIntervals(next, now), logId: log.id };
  });
}

// 직전 응답 되돌리기: 카드를 응답 전 상태로 되돌리고 그 기록을 지운다.
// 그 카드의 가장 최근 기록만 되돌린다(다른 탭에서 또 답했으면 거부). 되돌린 카드의 wordId를 돌려준다.
export function undoAnswer(db: Db, logId: number): { wordId: number } {
  return db.transaction((tx) => {
    const log = tx.select().from(reviewLogs).where(eq(reviewLogs.id, logId)).get();
    if (!log) throw new StudyError('되돌릴 응답이 없습니다.');
    if (log.prevCard === null) throw new StudyError('이 응답은 되돌릴 수 없습니다.');
    const latest = tx
      .select({ id: reviewLogs.id })
      .from(reviewLogs)
      .where(eq(reviewLogs.wordId, log.wordId))
      .orderBy(desc(reviewLogs.id))
      .limit(1)
      .get();
    if (latest?.id !== log.id) throw new StudyError('그 뒤에 이 카드에 다시 답해서 되돌릴 수 없습니다.');
    tx.update(words)
      .set(restore(JSON.parse(log.prevCard) as CardSnapshot))
      .where(eq(words.id, log.wordId))
      .run();
    tx.delete(reviewLogs).where(eq(reviewLogs.id, log.id)).run();
    return { wordId: log.wordId };
  });
}
```

- [ ] **Step 5: 통과 확인과 커밋**

Run: `npm test`, `npm run typecheck`
Expected: PASS (168 tests), 오류 0. 기존 `answerCard`는 `logId`를 아직 쓰지 않을 뿐 그대로 컴파일된다.

```bash
git add -A
git commit -m "feat: keep the card state before each answer and undo the last answer"
```

---

### Task 2: 설정 검사와 저장소

**Files:**
- Create: `src/lib/settings.ts`, `tests/lib/settings.test.ts`
- Modify: `src/server/repo/settings.ts`(전체 교체), `tests/server/repo.test.ts`(settings describe)

**Interfaces:**
- Produces: `EXCLUDE_TOP_N_RANGE`, `DAILY_NEW_LIMIT_RANGE`, `THEMES`, `Theme`, `THEME_COOKIE`, `isTheme`, `parseSettingsInput(v)`, `Settings.autoSpeak`, `saveSettings(db, value)`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/lib/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseSettingsInput } from '@/lib/settings';

const valid = { excludeTopN: '5000', dailyNewLimit: '20', autoSpeak: false, theme: 'system' };

describe('parseSettingsInput', () => {
  it('accepts values in range, including the edges and 0 new cards', () => {
    expect(parseSettingsInput(valid)).toEqual({
      ok: true,
      value: { excludeTopN: 5000, dailyNewLimit: 20, autoSpeak: false, theme: 'system' },
    });
    expect(parseSettingsInput({ ...valid, excludeTopN: '1000', dailyNewLimit: '0', theme: 'dark' })).toMatchObject({
      ok: true,
      value: { excludeTopN: 1000, dailyNewLimit: 0, theme: 'dark' },
    });
    expect(parseSettingsInput({ ...valid, excludeTopN: ' 20000 ', dailyNewLimit: '200' })).toMatchObject({ ok: true });
  });

  it('reports every field that is out of range or not an integer', () => {
    expect(parseSettingsInput({ ...valid, excludeTopN: '999', dailyNewLimit: '1.5' })).toEqual({
      ok: false,
      errors: {
        excludeTopN: '1,000에서 20,000 사이의 정수를 넣어 주세요.',
        dailyNewLimit: '0에서 200 사이의 정수를 넣어 주세요.',
      },
    });
    expect(parseSettingsInput({ ...valid, dailyNewLimit: '201' })).toEqual({
      ok: false,
      errors: { dailyNewLimit: '0에서 200 사이의 정수를 넣어 주세요.' },
    });
    expect(parseSettingsInput({ ...valid, excludeTopN: '' })).toMatchObject({ ok: false });
    expect(parseSettingsInput({ ...valid, excludeTopN: '-5' })).toMatchObject({ ok: false });
  });

  it('rejects requests the form cannot send', () => {
    expect(parseSettingsInput(null)).toBeNull();
    expect(parseSettingsInput({ ...valid, theme: 'blue' })).toBeNull();
    expect(parseSettingsInput({ ...valid, autoSpeak: 'true' })).toBeNull();
  });
});
```

`tests/server/repo.test.ts`: import를 `import { DEFAULT_SETTINGS, getSettings, saveSettings } from '@/server/repo/settings';`로 바꾸고, `settings repo` describe의 두 번째 테스트 기대값을 `{ excludeTopN: 3000, dailyNewLimit: 20, autoSpeak: false }`로 바꾼 뒤 그 아래에 추가:

```ts
  it('accepts a daily new limit of 0 and falls back for values out of range', () => {
    db.insert(settings)
      .values([
        { key: 'exclude_top_n', value: '999' },
        { key: 'daily_new_limit', value: '0' },
        { key: 'auto_speak', value: 'yes' },
      ])
      .run();
    expect(getSettings(db)).toEqual({ excludeTopN: 5000, dailyNewLimit: 0, autoSpeak: false });
  });

  it('saves all settings and overwrites earlier values', () => {
    saveSettings(db, { excludeTopN: 8000, dailyNewLimit: 0, autoSpeak: true });
    saveSettings(db, { excludeTopN: 9000, dailyNewLimit: 5, autoSpeak: true });
    expect(getSettings(db)).toEqual({ excludeTopN: 9000, dailyNewLimit: 5, autoSpeak: true });
    expect(db.select().from(settings).all()).toHaveLength(3);
  });
```

Run: `npm test`
Expected: FAIL — `@/lib/settings`, `saveSettings` 없음

- [ ] **Step 2: 구현**

`src/lib/settings.ts`:

```ts
// 설정 화면 입력 검사. 서버 Action과 테스트가 쓴다(설계서 M4-2 3장).
export const EXCLUDE_TOP_N_RANGE = { min: 1000, max: 20000 } as const; // 위 한계는 빈도 목록 길이(20,349단어)에 맞춘다
export const DAILY_NEW_LIMIT_RANGE = { min: 0, max: 200 } as const; // 0이면 새 카드 없이 복습만

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = 'theme';

export interface SettingsInput {
  excludeTopN: number;
  dailyNewLimit: number;
  autoSpeak: boolean;
  theme: Theme;
}

export type SettingsField = 'excludeTopN' | 'dailyNewLimit';
export type SettingsErrors = Partial<Record<SettingsField, string>>;

const rangeMessage = (r: { min: number; max: number }) =>
  `${r.min.toLocaleString('en-US')}에서 ${r.max.toLocaleString('en-US')} 사이의 정수를 넣어 주세요.`;

function parseInteger(value: unknown, range: { min: number; max: number }): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return Number.isSafeInteger(n) && n >= range.min && n <= range.max ? n : null;
}

export const isTheme = (v: unknown): v is Theme =>
  typeof v === 'string' && (THEMES as readonly string[]).includes(v);

// 숫자 칸은 입력 문자열 그대로 받는다. 하나라도 틀리면 값 없이 항목별 오류를 돌려준다.
// autoSpeak·theme가 형태부터 틀리면(화면이 보낼 수 없는 값) null: 잘못된 요청이다.
export function parseSettingsInput(
  v: unknown,
): { ok: true; value: SettingsInput } | { ok: false; errors: SettingsErrors } | null {
  if (typeof v !== 'object' || v === null) return null;
  const input = v as Record<string, unknown>;
  if (typeof input.autoSpeak !== 'boolean' || !isTheme(input.theme)) return null;
  const excludeTopN = parseInteger(input.excludeTopN, EXCLUDE_TOP_N_RANGE);
  const dailyNewLimit = parseInteger(input.dailyNewLimit, DAILY_NEW_LIMIT_RANGE);
  const errors: SettingsErrors = {};
  if (excludeTopN === null) errors.excludeTopN = rangeMessage(EXCLUDE_TOP_N_RANGE);
  if (dailyNewLimit === null) errors.dailyNewLimit = rangeMessage(DAILY_NEW_LIMIT_RANGE);
  if (excludeTopN === null || dailyNewLimit === null) return { ok: false, errors };
  return { ok: true, value: { excludeTopN, dailyNewLimit, autoSpeak: input.autoSpeak, theme: input.theme } };
}
```

`src/server/repo/settings.ts` 전체:

```ts
import { DAILY_NEW_LIMIT_RANGE, EXCLUDE_TOP_N_RANGE } from '@/lib/settings';
import type { Db } from '../db/client';
import { settings } from '../db/schema';

// DB에 두는 설정. 화면 테마는 첫 화면이 번쩍이지 않도록 쿠키에 둔다(설정 화면 Action이 함께 저장).
export interface Settings {
  excludeTopN: number;
  dailyNewLimit: number;
  autoSpeak: boolean;
}

export const DEFAULT_SETTINGS: Settings = { excludeTopN: 5000, dailyNewLimit: 20, autoSpeak: false };

const KEYS: Record<keyof Settings, string> = {
  excludeTopN: 'exclude_top_n',
  dailyNewLimit: 'daily_new_limit',
  autoSpeak: 'auto_speak',
};

// 없거나 범위 밖인 값은 처음 값으로 읽는다.
export function getSettings(db: Db): Settings {
  const stored = new Map(db.select().from(settings).all().map((r) => [r.key, r.value]));
  const readInt = (key: 'excludeTopN' | 'dailyNewLimit', range: { min: number; max: number }) => {
    const raw = stored.get(KEYS[key]);
    const value = raw === undefined ? NaN : Number(raw);
    return Number.isInteger(value) && value >= range.min && value <= range.max ? value : DEFAULT_SETTINGS[key];
  };
  const speak = stored.get(KEYS.autoSpeak);
  return {
    excludeTopN: readInt('excludeTopN', EXCLUDE_TOP_N_RANGE),
    dailyNewLimit: readInt('dailyNewLimit', DAILY_NEW_LIMIT_RANGE),
    autoSpeak: speak === 'true' ? true : speak === 'false' ? false : DEFAULT_SETTINGS.autoSpeak,
  };
}

// 검사를 마친 값만 받는다(lib/settings의 parseSettingsInput). 한 트랜잭션에서 모두 쓴다.
export function saveSettings(db: Db, value: Settings): void {
  db.transaction((tx) => {
    for (const key of Object.keys(KEYS) as (keyof Settings)[]) {
      const row = { key: KEYS[key], value: String(value[key]) };
      tx.insert(settings).values(row).onConflictDoUpdate({ target: settings.key, set: { value: row.value } }).run();
    }
  });
}
```

- [ ] **Step 3: 통과 확인과 커밋**

Run: `npm test`, `npm run typecheck`
Expected: PASS (173 tests), 오류 0

```bash
git add -A
git commit -m "feat: validate and save settings, allow zero new cards, add auto speak"
```

---

### Task 3: 검토 표 문장 줄이기

**Files:**
- Modify: `src/lib/text/highlight.ts`(전체 교체), `src/app/documents/[id]/review/candidate-table.tsx`(세 곳)
- Create: `src/lib/text/truncate.ts`, `tests/lib/text/truncate.test.ts`

Designer 조건 4개: 140자 안팎·1280px에서 최대 2줄, 가장 가까운 공백에서 자름, 전체 문장은 문장 칸 `title`, 기준은 형광펜과 같은 첫 일치. 저장용 `truncateAround`(`extract.ts`)는 건드리지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/lib/text/truncate.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { cutAround, shortSentence } from '@/lib/text/truncate';

const words = (n: number, w: string) => Array.from({ length: n }, () => w).join(' ');

describe("cutAround", () => {
  it('cuts at the nearest spaces around the word and stays within max', () => {
    const sentence = `${words(40, 'alpha')} TARGET ${words(40, 'omega')}`;
    const index = sentence.indexOf('TARGET');
    const cut = cutAround(sentence, index, 6, 60);
    expect(cut.length).toBeLessThanOrEqual(60);
    expect(cut).toMatch(/^…alpha /);
    expect(cut).toMatch(/ omega…$/);
    expect(cut).toContain('TARGET');
  });

  it('keeps the start when the word is near the beginning', () => {
    const sentence = `We TARGET ${words(40, 'omega')}`;
    const cut = cutAround(sentence, 3, 6, 50);
    expect(cut.startsWith('We TARGET')).toBe(true);
    expect(cut.endsWith('omega…')).toBe(true);
  });
});

describe('shortSentence', () => {
  it('leaves sentences within 140 characters as they are', () => {
    expect(shortSentence('A short sentence with a word.', 'word')).toBe('A short sentence with a word.');
  });

  it('keeps the first match that the highlight marks', () => {
    const sentence = `${words(30, 'lead')} Ablation here. ${words(30, 'tail')} ablation again.`;
    const cut = shortSentence(sentence, 'ablation');
    expect(cut.length).toBeLessThanOrEqual(140);
    expect(cut).toContain('Ablation here.');
    expect(cut).not.toContain('ablation again');
  });
});
```

Run: `npx vitest run tests/lib/text/truncate.test.ts`
Expected: FAIL — `@/lib/text/truncate` 없음

- [ ] **Step 2: 구현**

`src/lib/text/highlight.ts` 전체(정규식을 함수로 빼고 `firstMatch` 추가):

```ts
export interface Segment {
  text: string;
  match: boolean;
}

const wordPattern = (word: string, flags: string) =>
  new RegExp(`\\b(${word.replace(/[^A-Za-z-]/g, '')})\\b`, flags);

// 문장에서 word와 같은 단어(대소문자 무시)를 표시용 조각으로 나눈다.
export function highlight(sentence: string, word: string): Segment[] {
  return sentence
    .split(wordPattern(word, 'gi'))
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, match: part.toLowerCase() === word.toLowerCase() }));
}

// highlight와 같은 기준의 첫 일치 위치. 문장 줄이기가 이 단어를 남기는 데 쓴다.
export function firstMatch(sentence: string, word: string): { index: number; length: number } | null {
  const m = wordPattern(word, 'i').exec(sentence);
  return m ? { index: m.index, length: m[0].length } : null;
}
```

`src/lib/text/truncate.ts`:

```ts
import { firstMatch } from './highlight';

// 화면 표시용. 긴 문장을 단어가 보이도록 단어 주변만 남겨 max자 안으로 줄인다. 잘린 쪽에는 "…"를 붙이고,
// 잘리는 곳은 가장 가까운 공백으로 옮긴다(단어 중간에서 자르지 않는다). 단어 자체는 자르지 않는다.
export function cutAround(sentence: string, index: number, length: number, max: number): string {
  if (sentence.length <= max) return sentence;
  const centered = index - Math.floor((max - length) / 2);
  let start = Math.min(Math.max(0, centered), sentence.length - max);
  let end = start + max;
  if (start > 0) start += 1; // "…" 자리
  if (end < sentence.length) end -= 1;
  if (start > 0) {
    const space = sentence.indexOf(' ', start - 1);
    if (space !== -1 && space + 1 <= index) start = space + 1;
  }
  if (end < sentence.length) {
    const space = sentence.lastIndexOf(' ', end);
    if (space >= index + length) end = space;
  }
  return (start > 0 ? '…' : '') + sentence.slice(start, end) + (end < sentence.length ? '…' : '');
}

// 검토 표에 보여 줄 짧은 문장(Designer 조건: 140자 안팎, 1280px에서 최대 2줄).
// 기준은 형광펜과 같은 첫 일치다. 저장된 원문은 그대로 두고 화면에서만 줄인다.
export const REVIEW_SENTENCE_LENGTH = 140;

export function shortSentence(sentence: string, word: string, max = REVIEW_SENTENCE_LENGTH): string {
  const match = firstMatch(sentence, word);
  return cutAround(sentence, match?.index ?? 0, match?.length ?? 0, max);
}
```

`src/app/documents/[id]/review/candidate-table.tsx`:
- import에 `import { shortSentence } from "@/lib/text/truncate";` 추가
- 원문 문장 `<td>`에 `title={c.sentence}` 추가
- `<Highlighted sentence={c.sentence} word={c.surface} />`를 `<Highlighted sentence={shortSentence(c.sentence, c.surface)} word={c.surface} />`로

- [ ] **Step 3: 통과 확인과 커밋**

Run: `npm test`, `npm run typecheck`, `npm run lint`
Expected: PASS (177 tests), 오류 0

```bash
git add -A
git commit -m "feat: shorten review table sentences to two lines around the word"
```

---

### Task 4: 설정 화면과 테마

**Files:**
- Create: `src/components/ui/segmented.tsx`, `src/lib/ui/theme.ts`, `src/components/theme-sync.tsx`, `src/app/settings/actions.ts`, `src/app/settings/page.tsx`, `src/app/settings/settings-form.tsx`
- Modify: `src/app/documents/upload-form.tsx`(Segmented로 교체), `src/app/layout.tsx`(전체 교체), `src/components/nav/nav-links.tsx`(전체 교체)

화면 규칙(설계서 6장, Designer): 760px 폭, 묶음 제목 "단어 추출 / 복습 / 화면", 라벨 200px + 입력 2열(900px 이하 1열), 숫자 칸 120px(`type=number`, 증감 화살표 숨김, `noValidate`), 자동 재생 "끄기 | 켜기"·테마 "시스템 | 라이트 | 다크"는 Segmented. 오류 칸은 포커스 중에도 again 테두리, 칸 아래 오류 문구, 버튼 옆 "저장하지 않았습니다 · 표시한 항목을 고쳐 주세요", 첫 오류 칸으로 포커스. 성공 "저장했습니다"(입력을 바꾸면 사라짐). 상단 바 오른쪽 끝 "설정"(현재 위치 표시와 `aria-current`).

- [ ] **Step 1: Segmented** — `src/components/ui/segmented.tsx`

```tsx
// 몇 개 중 하나를 고르는 칸(업로드 종류, 설정의 테마·자동 재생). 의미상 라디오 그룹이라
// 보이지 않는 radio에 label을 씌운다. 화살표 키 이동은 브라우저 기본 동작이다.
export function Segmented<T extends string>({
  name,
  legend,
  options,
  value,
  defaultValue,
  onChange,
}: {
  name: string;
  legend: string;
  options: readonly { value: T; label: string }[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
}) {
  return (
    <fieldset className="inline-flex overflow-hidden rounded-md border border-line-strong">
      <legend className="sr-only">{legend}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className="cursor-pointer px-3 py-1.5 text-[13px] text-ink-2 has-checked:bg-ink has-checked:font-semibold has-checked:text-surface has-focus-visible:outline-2 has-focus-visible:outline-accent"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            {...(value === undefined ? { defaultChecked: o.value === defaultValue } : { checked: o.value === value })}
            onChange={() => onChange?.(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
```

`src/app/documents/upload-form.tsx`: `import { Segmented } from "@/components/ui/segmented";`를 넣고, 종류 `<fieldset>…</fieldset>` 전체를 `<Segmented name="kind" legend="종류" options={KINDS} defaultValue="paper" />`로 바꾼다(모양은 그대로).

- [ ] **Step 2: 테마 적용** — `src/lib/ui/theme.ts`, `src/components/theme-sync.tsx`

```ts
import { THEME_COOKIE, type Theme } from "@/lib/settings";

// 화면 테마를 <html data-theme>로 적용한다. system이면 속성을 지워 OS 설정(prefers-color-scheme)을 따른다.
export function applyTheme(theme: Theme): void {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

// 레이아웃 <head>의 인라인 스크립트. HTML을 읽는 중에 실행돼 첫 화면을 그리기 전에 쿠키의 테마를 적용한다.
// 레이아웃이 쿠키를 서버에서 읽으면 앱 전체가 정적 셸을 잃는다(Next 문서 "Preventing flash before hydration").
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)/);if(m)document.documentElement.setAttribute("data-theme",m[1])}catch(e){}})()`;
```

```tsx
"use client";

import { useLayoutEffect } from "react";
import { isTheme, THEME_COOKIE } from "@/lib/settings";
import { applyTheme } from "@/lib/ui/theme";

// 개발 모드의 Strict Mode 재마운트가 <html>의 data-theme를 지우므로 쿠키에서 다시 적용한다.
// 배포 빌드에서는 인라인 스크립트가 이미 적용한 값을 한 번 더 쓸 뿐이다.
export function ThemeSync() {
  useLayoutEffect(() => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
    const theme = m?.[1];
    applyTheme(isTheme(theme) ? theme : "system");
  }, []);
  return null;
}
```

- [ ] **Step 3: 레이아웃과 상단 바**

`src/app/layout.tsx` 전체:

```tsx
import type { Metadata } from "next";
import { Gentium_Book_Plus } from "next/font/google";
import localFont from "next/font/local";
import { connection } from "next/server";
import { Suspense } from "react";
import { NavLinks, NavLinksFallback } from "@/components/nav/nav-links";
import { ThemeSync } from "@/components/theme-sync";
import { THEME_SCRIPT } from "@/lib/ui/theme";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/repo/settings";
import { countStudyToday } from "@/server/repo/study";
import "./globals.css";

// 한글·UI. Google Fonts에 없어 npm 패키지의 가변 글꼴을 직접 올린다(약 2MB, 배포 시 subset 검토).
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

// 영어 단어·원문·IPA. θ(그리스 문자) 때문에 greek 하위 집합이 꼭 필요하다(제안서 1장).
const gentium = Gentium_Book_Plus({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin", "latin-ext", "greek"],
  variable: "--font-gentium",
  display: "swap",
});

export const metadata: Metadata = {
  title: "slave-voca",
  description: "논문·발표 자료 단어장",
};

async function TodayBadge() {
  await connection();
  const db = getDb();
  const { review, fresh } = countStudyToday(db, new Date(), getSettings(db).dailyNewLimit);
  const total = review + fresh;
  if (total === 0) return null;
  return <span className="text-xs font-semibold text-accent tabular-nums">{total}</span>;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme는 <head>의 인라인 스크립트가 붙인다(쿠키). React가 모르는 속성이라 경고를 끈다.
    <html lang="ko" className={`${pretendard.variable} ${gentium.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeSync />
        <nav className="flex h-[52px] items-center gap-1 border-b border-line bg-surface px-6">
          <span className="mr-5 text-[13px] font-semibold tracking-[0.02em] text-muted">slave-voca</span>
          <Suspense fallback={<NavLinksFallback />}>
            <NavLinks
              studyBadge={
                <Suspense fallback={null}>
                  <TodayBadge />
                </Suspense>
              }
            />
          </Suspense>
        </nav>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
```

`src/components/nav/nav-links.tsx` 전체:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "홈", match: (p: string) => p === "/" },
  { href: "/study", label: "복습", match: (p: string) => p.startsWith("/study") },
  { href: "/documents", label: "문서", match: (p: string) => p.startsWith("/documents") },
  // 설정은 상단 바 오른쪽 끝(개편안 5장)
  { href: "/settings", label: "설정", match: (p: string) => p.startsWith("/settings") },
];

function Links({ pathname, studyBadge }: { pathname: string | null; studyBadge: React.ReactNode }) {
  return (
    <>
      {LINKS.map((link) => {
        const active = pathname !== null && link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
              link.href === "/settings" ? "ml-auto" : ""
            } ${
              active ? "bg-sunken font-semibold text-ink" : "text-ink-2 hover:bg-sunken"
            }`}
          >
            {link.label}
            {link.href === "/study" && studyBadge}
          </Link>
        );
      })}
    </>
  );
}

// 현재 위치는 sunken 바탕 + 굵은 글씨. 복습 옆에는 오늘 남은 카드 수(서버에서 받은 배지)를 둔다.
export function NavLinks({ studyBadge }: { studyBadge: React.ReactNode }) {
  return <Links pathname={usePathname()} studyBadge={studyBadge} />;
}

// usePathname은 요청 시점 값이라 <Suspense> 안에서만 쓸 수 있다(cacheComponents). 그 전까지 보여 줄 같은 모양.
export function NavLinksFallback() {
  return <Links pathname={null} studyBadge={null} />;
}
```

- [ ] **Step 4: 설정 Action·페이지·폼**

`src/app/settings/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { parseSettingsInput, THEME_COOKIE, type SettingsErrors } from "@/lib/settings";
import { getDb } from "@/server/db/client";
import { saveSettings } from "@/server/repo/settings";

export type SaveSettingsResult =
  | { status: "saved" }
  | { status: "invalid"; errors: SettingsErrors }
  | { status: "error"; message: string };

const ONE_YEAR = 60 * 60 * 24 * 365;

// 네 항목을 함께 저장한다. 하나라도 범위 밖이면 아무것도 저장하지 않는다.
// 테마는 쿠키에 둔다: 레이아웃의 인라인 스크립트가 첫 화면을 그리기 전에 읽는다(정적 셸을 유지).
export async function saveSettingsAction(input: unknown): Promise<SaveSettingsResult> {
  const parsed = parseSettingsInput(input);
  if (parsed === null) return { status: "error", message: "잘못된 요청입니다." };
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };
  const { theme, ...rest } = parsed.value;
  saveSettings(getDb(), rest);
  const jar = await cookies();
  if (theme === "system") jar.delete(THEME_COOKIE);
  else jar.set(THEME_COOKIE, theme, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  // 하루 새 카드 수가 바뀌면 메뉴 배지·홈·복습 큐가 달라진다.
  revalidatePath("/", "layout");
  return { status: "saved" };
}
```

`src/app/settings/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { isTheme, THEME_COOKIE } from "@/lib/settings";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/repo/settings";
import { SettingsForm } from "./settings-form";

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-8 pb-12">
      <h1 className="text-[26px] font-bold">설정</h1>
      <Suspense fallback={<p className="mt-6 text-muted">불러오는 중…</p>}>
        <CurrentSettings />
      </Suspense>
    </main>
  );
}

async function CurrentSettings() {
  await connection();
  const settings = getSettings(getDb());
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  return <SettingsForm initial={{ ...settings, theme: isTheme(stored) ? stored : "system" }} />;
}
```

`src/app/settings/settings-form.tsx`:

```tsx
"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Failed, Status } from "@/components/ui/status";
import {
  DAILY_NEW_LIMIT_RANGE,
  EXCLUDE_TOP_N_RANGE,
  type SettingsErrors,
  type SettingsField,
  type Theme,
} from "@/lib/settings";
import { applyTheme } from "@/lib/ui/theme";
import { saveSettingsAction } from "./actions";

interface Values {
  excludeTopN: number;
  dailyNewLimit: number;
  autoSpeak: boolean;
  theme: Theme;
}

const THEME_OPTIONS = [
  { value: "system", label: "시스템" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
] as const;

const SPEAK_OPTIONS = [
  { value: "off", label: "끄기" },
  { value: "on", label: "켜기" },
] as const;

type Outcome = { kind: "saved" } | { kind: "invalid" } | { kind: "error"; message: string } | null;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold text-muted">{title}</h2>
      <div className="mt-2 border-t border-line">{children}</div>
    </section>
  );
}

// 개편안 5.6의 2열 행: 라벨 200px(이름 + 설명) + 입력. 900px 이하에서는 1열.
function Row({ id, name, help, children }: { id?: string; name: string; help: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-x-6 gap-y-2 border-b border-line py-4 max-[900px]:grid-cols-1">
      <div>
        {id ? (
          <label htmlFor={id} className="text-sm font-semibold">
            {name}
          </label>
        ) : (
          <p className="text-sm font-semibold">{name}</p>
        )}
        <p className="mt-0.5 text-[13px] text-muted">{help}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function NumberField({
  id,
  value,
  onChange,
  range,
  unit,
  error,
}: {
  id: SettingsField;
  value: string;
  onChange: (v: string) => void;
  range: { min: number; max: number };
  unit: string;
  error: string | undefined;
}) {
  return (
    <>
      <span className="inline-flex items-center gap-2">
        <input
          id={id}
          name={id}
          type="number"
          inputMode="numeric"
          min={range.min}
          max={range.max}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          // 오류 칸은 포커스 중에도 again 테두리를 유지하고, 포커스 링은 바깥에 둔다(Designer).
          // 증감 화살표는 숨긴다(범위가 넓어 쓸 일이 없다). 키보드 ↑↓는 그대로다.
          className={`w-[120px] [appearance:textfield] rounded-md border border-line-strong bg-surface px-2.5 py-[7px] text-sm text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-invalid:border-again [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        />
        <span className="text-sm text-ink-2">{unit}</span>
      </span>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-again">
          {error}
        </p>
      )}
    </>
  );
}

export function SettingsForm({ initial }: { initial: Values }) {
  const [excludeTopN, setExcludeTopN] = useState(String(initial.excludeTopN));
  const [dailyNewLimit, setDailyNewLimit] = useState(String(initial.dailyNewLimit));
  const [autoSpeak, setAutoSpeak] = useState(initial.autoSpeak);
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [saving, startSaving] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  // 입력을 바꾸면 "저장했습니다"는 사라지고, 고치기 시작한 칸의 오류 표시도 지운다.
  const edited = (field?: SettingsField) => {
    if (outcome?.kind === "saved") setOutcome(null);
    if (field && errors[field])
      setErrors((e) => {
        const next = { ...e };
        delete next[field];
        return next;
      });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      const result = await saveSettingsAction({ excludeTopN, dailyNewLimit, autoSpeak, theme });
      if (result.status === "saved") {
        setErrors({});
        setOutcome({ kind: "saved" });
        applyTheme(theme); // 쿠키는 서버가 저장했다. 지금 화면에도 바로 적용한다
      } else if (result.status === "invalid") {
        setErrors(result.errors);
        setOutcome({ kind: "invalid" });
        const first = (["excludeTopN", "dailyNewLimit"] as const).find((f) => result.errors[f]);
        if (first) form.current?.querySelector<HTMLInputElement>(`#${first}`)?.focus();
      } else {
        setOutcome({ kind: "error", message: result.message });
      }
    });
  };

  return (
    <form ref={form} noValidate onSubmit={submit}>
      <Group title="단어 추출">
        <Row id="excludeTopN" name="흔한 단어 제외 기준" help="빈도 상위 N위 안의 단어는 후보에서 뺍니다. 학술 핵심어는 남깁니다.">
          <NumberField
            id="excludeTopN"
            value={excludeTopN}
            onChange={(v) => {
              setExcludeTopN(v);
              edited("excludeTopN");
            }}
            range={EXCLUDE_TOP_N_RANGE}
            unit="위"
            error={errors.excludeTopN}
          />
          <p className="mt-1.5 text-[13px] text-muted">
            다음에 올리는 문서부터 적용됩니다. 이미 뽑은 후보와 카드는 그대로입니다.
          </p>
        </Row>
      </Group>

      <Group title="복습">
        <Row id="dailyNewLimit" name="하루 새 카드 수" help="남은 새 카드는 다음 날로 넘어갑니다. 0이면 새 카드 없이 복습만 합니다.">
          <NumberField
            id="dailyNewLimit"
            value={dailyNewLimit}
            onChange={(v) => {
              setDailyNewLimit(v);
              edited("dailyNewLimit");
            }}
            range={DAILY_NEW_LIMIT_RANGE}
            unit="장"
            error={errors.dailyNewLimit}
          />
        </Row>
        <Row name="발음 자동 재생" help="뒷면을 열 때 단어를 한 번 읽어 줍니다. P 키와 스피커 버튼은 그대로입니다.">
          <Segmented
            name="autoSpeak"
            legend="발음 자동 재생"
            options={SPEAK_OPTIONS}
            value={autoSpeak ? "on" : "off"}
            onChange={(v) => {
              setAutoSpeak(v === "on");
              edited();
            }}
          />
        </Row>
      </Group>

      <Group title="화면">
        <Row name="화면 테마" help="시스템은 운영체제 설정을 따릅니다.">
          <Segmented
            name="theme"
            legend="화면 테마"
            options={THEME_OPTIONS}
            value={theme}
            onChange={(v) => {
              setTheme(v);
              edited();
            }}
          />
        </Row>
      </Group>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className={buttonClass({ variant: "primary" })}>
          {saving ? "저장 중…" : "저장"}
        </button>
        <span aria-live="polite">
          {outcome?.kind === "saved" && <Status tone="ok">저장했습니다</Status>}
          {outcome?.kind === "invalid" && <Failed>저장하지 않았습니다 · 표시한 항목을 고쳐 주세요</Failed>}
          {outcome?.kind === "error" && <Failed>{outcome.message}</Failed>}
        </span>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: 확인과 커밋**

Run: `npm run typecheck`, `npm run lint`, `npm run build`
Expected: 오류 0. 빌드 표에서 `/settings`를 포함한 모든 페이지가 `◐`(Partial Prerender)다. 하나라도 `ƒ`로 바뀌면(`/api/usage-meaning` 제외) 레이아웃이 요청 시점 데이터를 읽고 있는 것이다.

```bash
git add -A
git commit -m "feat: add the settings screen with a cookie-based theme"
```

---

### Task 5: 복습 화면: 되돌리기와 자동 재생

**Files:**
- Modify: `src/app/study/actions.ts`(전체 교체), `src/app/study/page.tsx`(전체 교체), `src/app/study/study-session.tsx`(전체 교체)

화면 규칙(설계서 6장, Designer): 답 버튼 아래 단축키 안내 줄에 "· [Z] 되돌리기 단어 · 응답"(응답 이름은 응답 색, 버튼은 점선 밑줄). 처리 중에는 스피너 없이 disabled, 1·2·3·Space·Enter·Z 무시. 결과는 같은 자리에: "단어 응답을 되돌렸습니다" / 거부 "되돌리지 못했습니다 · 다른 곳에서 이미 답한 카드입니다"(대상 지움) / 그 밖의 실패 "되돌리지 못했습니다"(대상 남김, Z로 다시 시도). 다음 응답에 사라진다. 완료 화면은 "홈으로" 아래 "[Z] 마지막 응답 되돌리기". 되돌리면 그 카드가 앞면으로 큐 맨 앞(새 카드였으면 "새 카드" 표시도 다시), 답한 수·모름 수가 줄고 완료 화면의 "곧 다시 나옴"에서도 빠진다. 자동 재생은 뒷면을 열 때(Space·Enter·버튼) 한 번.

- [ ] **Step 1: 복습 Action** — `src/app/study/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { Intervals } from "@/lib/srs/interval";
import { ANSWERS, type Answer } from "@/lib/srs/scheduler";
import { isId } from "@/lib/validate";
import { getDb } from "@/server/db/client";
import { recordAnswer, StudyError, undoAnswer } from "@/server/repo/study";

export type AnswerResult =
  | { error: string }
  | { error: null; due: number; intervals: Intervals; logId: number }; // due는 ms(epoch)

// 복습 응답 하나를 저장한다. 성공하면 다음 복습 시각, 응답 뒤 상태의 간격 미리보기,
// 되돌리기에 쓸 기록 id를 돌려준다.
export async function answerCard(wordId: number, answer: Answer): Promise<AnswerResult> {
  if (!Number.isInteger(wordId) || !ANSWERS.includes(answer)) {
    return { error: "잘못된 요청입니다." };
  }
  try {
    const { due, intervals, logId } = recordAnswer(getDb(), wordId, answer, new Date());
    // 상단 메뉴의 "오늘 남은 수" 배지(레이아웃)가 바로 줄도록 다시 그린다.
    // 복습 화면의 큐 상태는 클라이언트 state라 그대로 유지된다.
    revalidatePath("/", "layout");
    return { error: null, due: due.getTime(), intervals, logId };
  } catch (err) {
    if (err instanceof StudyError) return { error: err.message };
    throw err;
  }
}

// 직전 응답 되돌리기. rejected는 다시 시도해도 결과가 같은 거부다(다른 곳에서 이미 답했거나 기록이 없음).
export type UndoResult = { error: null } | { error: string; rejected: boolean };

export async function undoLastAnswer(logId: unknown): Promise<UndoResult> {
  if (!isId(logId)) return { error: "잘못된 요청입니다.", rejected: true };
  try {
    undoAnswer(getDb(), logId);
    revalidatePath("/", "layout");
    return { error: null };
  } catch (err) {
    if (err instanceof StudyError) return { error: err.message, rejected: true };
    throw err;
  }
}
```

- [ ] **Step 2: 복습 페이지** — `src/app/study/page.tsx`

```tsx
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/repo/settings";
import { getStudyQueue } from "@/server/repo/study";
import { StudySession } from "./study-session";

export default function StudyPage() {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-7 pb-10">
      <h1 className="sr-only">오늘의 복습</h1>
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <TodayQueue />
      </Suspense>
    </main>
  );
}

async function TodayQueue() {
  await connection();
  const db = getDb();
  const settings = getSettings(db);
  const cards = getStudyQueue(db, new Date(), settings.dailyNewLimit);
  return <StudySession cards={cards} autoSpeak={settings.autoSpeak} />;
}
```

- [ ] **Step 3: 복습 세션** — `src/app/study/study-session.tsx` 전체

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
import { isNativeEnterTarget, isNativeSpaceTarget, isTypingTarget, keepFocus } from "@/lib/ui/keys";
import type { StudyCard, Usage } from "@/server/repo/study";
import type { RegenerateUsageResult } from "@/server/services/usage-meaning";
import { answerCard, undoLastAnswer } from "./actions";
import { SpeakButton, speak } from "./speak-button";

const ANSWER_BUTTONS: { answer: Answer; label: string; key: string; tone: string; text: string }[] = [
  { answer: "again", label: "모름", key: "1", tone: "bg-again-soft text-again", text: "text-again" },
  { answer: "hard", label: "애매", key: "2", tone: "bg-hard-soft text-hard", text: "text-hard" },
  { answer: "good", label: "앎", key: "3", tone: "bg-good-soft text-good", text: "text-good" },
];

// 되돌릴 수 있는 직전 응답. card는 응답 전 카드(앞면으로 다시 보여 줄 것), prevDue는 응답 전 lastDue 값.
interface LastAnswer {
  logId: number;
  card: StudyCard;
  choice: Answer;
  prevDue: number | undefined;
}

type UndoNote = { kind: "done"; lemma: string } | { kind: "failed"; text: string } | null;

const UNDO_REJECTED = "되돌리지 못했습니다 · 다른 곳에서 이미 답한 카드입니다";
const UNDO_FAILED = "되돌리지 못했습니다";

const undoButtonClass =
  "text-muted underline decoration-dotted underline-offset-[3px] hover:text-accent hover:decoration-solid focus-visible:text-accent focus-visible:decoration-solid disabled:opacity-55";

// 답 버튼 아래 단축키 안내 줄의 되돌리기 자리(Designer 2026-10-16). 무엇이 되돌려지는지 "단어 · 응답"으로 보인다.
function UndoControl({
  last,
  note,
  busy,
  onUndo,
  label = "되돌리기",
}: {
  last: LastAnswer | null;
  note: UndoNote;
  busy: boolean;
  onUndo: () => void;
  label?: string;
}) {
  const answer = last && ANSWER_BUTTONS.find((b) => b.answer === last.choice);
  return (
    <span aria-live="polite" className="inline-flex flex-wrap items-center gap-x-1.5">
      {note?.kind === "done" && (
        <span>
          <span className="font-en">{note.lemma}</span> 응답을 되돌렸습니다
        </span>
      )}
      {note?.kind === "failed" && <Failed>{note.text}</Failed>}
      {last && answer && !note && (
        <>
          <Kbd>Z</Kbd>
          <button type="button" onMouseDown={keepFocus} onClick={onUndo} disabled={busy} className={undoButtonClass}>
            {label}
          </button>
          <span className="ml-1">
            <span className="font-en">{last.card.lemma}</span> · <span className={answer.text}>{answer.label}</span>
          </span>
        </>
      )}
    </span>
  );
}

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

// Server Action이 아니라 fetch로 부른다: Server Action은 응답 저장(answerCard)과 한 줄로 실행되어 응답이 기다리게 된다.
async function requestRegeneration(occurrenceId: number): Promise<RegenerateUsageResult> {
  const res = await fetch("/api/usage-meaning", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ occurrenceId }),
  });
  return (await res.json()) as RegenerateUsageResult;
}

export function StudySession({ cards, autoSpeak }: { cards: StudyCard[]; autoSpeak: boolean }) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  // 큐를 바꾸는 곳은 모두 이 함수를 거친다: 응답이 끝나는 사이에 다시 만들기가 새 뜻을 넣었어도 최신 큐 위에서 갱신한다.
  // (클릭할 때 잡힌 queue로 갱신하면 새 뜻이 옛 뜻으로 되돌아간다)
  const queueRef = useRef(cards);
  const updateQueue = (change: (q: StudyCard[]) => StudyCard[]) => {
    queueRef.current = change(queueRef.current);
    setQueue(queueRef.current);
    return queueRef.current;
  };
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
  const [last, setLast] = useState<LastAnswer | null>(null);
  const [undoNote, setUndoNote] = useState<UndoNote>(null);

  const card = queue[0];

  // 뒷면 열기. 발음 자동 재생이 켜져 있으면 단어를 한 번 읽는다(설정 화면).
  const reveal = () => {
    if (!card || revealed) return;
    setRevealed(true);
    if (autoSpeak) speak(card.lemma);
  };

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
        setLast({ logId: result.logId, card, choice, prevDue: lastDue.get(card.wordId) });
        setUndoNote(null);
        const dues = new Map(lastDue).set(card.wordId, result.due);
        setLastDue(dues);
        const next = updateQueue((q) =>
          advanceQueue(q, choice).map((c) =>
            c.wordId === card.wordId ? { ...c, isNew: false, intervals: result.intervals } : c,
          ),
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
        setRevealed(false);
        // 다음 카드로 넘어가면 결과 문구를 지운다. 진행 중인 요청의 스피너는 그 카드가 다시 나올 때를 위해 둔다.
        setRegen((m) => new Map([...m].filter(([, s]) => s.phase === "busy")));
      } finally {
        locked.current = false; // 실패해도 다시 누를 수 있게 푼다
      }
    });
  };

  // 직전 응답 되돌리기: 서버에서 카드 상태를 되돌리고, 그 카드를 앞면으로 큐 맨 앞에 다시 둔다.
  // 거부(다시 해도 같음)면 대상을 지우고, 그 밖의 실패면 대상을 남겨 다시 시도할 수 있게 한다.
  const undo = () => {
    if (!last || locked.current) return;
    locked.current = true;
    const target = last;
    startSaving(async () => {
      try {
        const result = await undoLastAnswer(target.logId);
        if (result.error !== null) {
          if (result.rejected) setLast(null);
          setUndoNote({ kind: "failed", text: result.rejected ? UNDO_REJECTED : UNDO_FAILED });
          return;
        }
        setAnswered((n) => n - 1);
        if (target.choice === "again") setAgainCount((n) => n - 1);
        setLastDue((m) => {
          const next = new Map(m);
          if (target.prevDue === undefined) next.delete(target.card.wordId);
          else next.set(target.card.wordId, target.prevDue);
          return next;
        });
        updateQueue((q) => {
          // "모름"이면 같은 카드가 큐 뒤에 다시 들어가 있다. 빼고 응답 전 카드를 맨 앞에 둔다(그 사이 바뀐 뜻은 살린다).
          const later = q.find((c) => c.wordId === target.card.wordId);
          const restored = { ...target.card, usages: later?.usages ?? target.card.usages };
          return [restored, ...q.filter((c) => c.wordId !== target.card.wordId)];
        });
        setSoon(null);
        setRevealed(false);
        setRegen((m) => new Map([...m].filter(([, s]) => s.phase === "busy")));
        setLast(null);
        setUndoNote({ kind: "done", lemma: target.card.lemma });
      } catch {
        setUndoNote({ kind: "failed", text: UNDO_FAILED });
      } finally {
        locked.current = false;
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
    requestRegeneration(occurrenceId)
      .then((result) => {
        if (result.error !== null) {
          finish({ phase: "failed", text: result.error });
          return;
        }
        updateQueue((q) =>
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
      // 저장·되돌리기 처리 중에는 응답·뒷면·되돌리기 키를 무시한다.
      if (locked.current && ["1", "2", "3", " ", "Enter", "z", "Z"].includes(e.key)) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        undo();
        return;
      }
      if (!card) {
        if (e.key === "Enter") router.push("/");
        return;
      }
      if (e.key === "p" || e.key === "P") {
        speak(card.lemma);
      } else if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        reveal();
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
        {(last || undoNote) && (
          <p className="mt-4 text-[13px] text-muted">
            <UndoControl last={last} note={undoNote} busy={saving} onUndo={undo} label="마지막 응답 되돌리기" />
          </p>
        )}
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
          onClick={reveal}
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface p-3.5 text-[15px] font-semibold text-ink hover:bg-sunken"
        >
          뒷면 보기 <Kbd>Space</Kbd>
        </button>
      )}
      <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 text-[13px] text-muted">
        <span>
          <Kbd>P</Kbd> 발음 듣기
        </span>
        {(last || undoNote) && (
          <>
            <span aria-hidden className="mx-1">
              ·
            </span>
            <UndoControl last={last} note={undoNote} busy={saving} onUndo={undo} />
          </>
        )}
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

M4-1의 `queueRef`/`updateQueue`, 다시 만들기(`/api/usage-meaning`), 링크 위 Enter 처리는 그대로다. 교체 뒤 이것들이 남아 있는지 대조한다.

- [ ] **Step 4: 전체 확인과 커밋**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 177 tests PASS, 오류 0, 빌드 성공(Task 4의 `◐` 조건 그대로)

```bash
git add -A
git commit -m "feat: undo the last answer with Z and speak the word on reveal"
```

---

### Task 6: 브라우저 확인, 리뷰, 병합

- [ ] **Step 1: 브라우저 흐름** (데모 DB 사본, `next start -p 3300`, 헤드리스 Edge, 1280×900)

PM이 계획을 쓰며 같은 방식으로 확인한 결과다. 같은 동작이 나와야 한다. 데모 DB를 처음 열면 마이그레이션 0004가 적용된다.
- `/settings`: 상단 바 "설정"이 현재 위치(`aria-current="page"`). N에 999, 하루 새 카드에 1.5를 넣고 저장 → 두 칸에 오류 문구, 버튼 옆 "저장하지 않았습니다 · 표시한 항목을 고쳐 주세요", 포커스는 N 칸, 포커스 중에도 빨간 테두리. 새로 고치면 5000·20 그대로.
- 하루 새 카드 2, 자동 재생 켜기, 다크로 저장 → "저장했습니다", 화면이 바로 다크. 새 탭으로 `/study`를 열면 `DOMContentLoaded` 시점에 이미 `data-theme="dark"`이고 HTML의 `<body>` 앞에 테마 스크립트가 있다.
- `/study`: 큐 2장. 뒷면을 열면 단어를 한 번 읽는다(`speechSynthesis.speak`를 가로채 확인. 예: layer). `1`(모름) → 안내 줄 "P 발음 듣기 · Z 되돌리기 layer · 모름". `Z` → layer가 앞면으로 돌아오고 "새 카드" 표시, 진행 수가 돌아오고 "layer 응답을 되돌렸습니다". 안내 줄의 세로 위치가 그대로다(PM 측정 584.8px).
- 거부: 한 장에 답한 뒤 DB에 같은 카드의 더 새로운 `review_logs` 행을 넣고(다른 탭에서 답한 상황) `Z` → "되돌리지 못했습니다 · 다른 곳에서 이미 답한 카드입니다", 기록 수 그대로, 다시 `Z`를 눌러도 아무 일 없음.
- 완료 화면: "[Z] 마지막 응답 되돌리기 residual · 애매". `Z` → 그 카드의 앞면으로 돌아간다.
- 라이트로 바꾸고 자동 재생을 끄면: 라이트로 바뀌고, 뒷면을 열어도 읽지 않는다.
- 검토 표: ResNet PDF를 다시 올린 검토 화면에서 원문 문장 칸이 모두 2줄 이하(PM 측정 207행: 1줄 73, 2줄 134), 최대 140자, 잘린 칸은 `title`에 전체 문장.

- [ ] **Step 2: Codex 리뷰와 병합**

Orca의 Codex 터미널에 브랜치 전체 리뷰를 맡긴다(범위 `main..feat/m4-2-settings-undo`). Important 이상은 테스트를 먼저 써서 고친다. main에 로컬 병합(`--no-ff`)한 뒤, main에서 test·typecheck·lint·build 결과(빌드 표 포함), 병합 커밋 해시, 리뷰 요약을 PM에게 보낸다.
