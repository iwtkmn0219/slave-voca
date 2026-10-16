# M6-2: 사용자별 데이터 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 사용자마다 문서·카드·아는 단어·설정을 따로 갖게 한다.
- 다른 사람의 데이터는 어떤 화면·Action·API로도 읽거나 바꿀 수 없다.
- 기존 데이터는 마이그레이션이 임시 소유자에게 묶어 두고, `npm run db:claim -- <이메일>`로 계정 주인에게 옮긴다.
- M6-1 Designer 검수에서 나온 수정 3건도 함께 반영한다.

**Architecture:**
- **표:** `documents`·`words`·`known_words`·`settings`에 `user_id`(users 외래 키)를 붙인다. 후보·용례·복습 기록은 문서·단어를 따라 나뉜다.
- **저장소 함수:** 모두 `(db, userId, …)`로 받는다.
  - 브라우저에서 온 id는 그 사용자의 문서·단어에 이어진 것만 통과한다.
  - 화면·Action은 `requireUser()`의 `user.id`를 넘긴다.
- **마이그레이션 `0006_per_user`:** 손으로 쓴다. 외래 키를 끈 채 돌린다(`client.ts`).

**Tech Stack:** 기존 스택 그대로(새 의존성 없음)

**Spec:**
- `docs/superpowers/specs/2026-10-16-m6-login-per-user-design.md` 5장(M6-2 결정, 마이그레이션 방식과 근거)
- M6-1 화면 규칙과 Designer 검수(아래 Task 2)

## Global Constraints

- 브랜치: 최신 `origin/development`(M6-1 병합 7cb9236 이후)에서 `feat/m6-2-per-user`. PR은 `--base development`이고 태스크마다 커밋한다.
- 리뷰는 Orca의 Codex 터미널에 맡긴다. Important 이상은 테스트를 먼저 써서 고친다. 요약은 PR 댓글로 남긴다. development 병합은 묻지 않는다.
- **릴리스(v0.6.0, main 병합)는 이 계획에 없다.** 병합 뒤 PM이 알리고, main 병합 전에 사용자 검수를 받는다.
- 비밀값, `.env.local`, 확인용 DB, 로그, `*.tmp.*`는 커밋하지 않는다. 데모 DB(`data/demo.db`)는 사본으로만 확인한다. 원본은 바꾸지 않는다.
- 실제 Gemini 호출과 실제 Google 로그인은 하지 않는다. 포트는 3300.
- **PM 프로토타입에서 확인한 것**(이 계획의 패치 세 개를 새 복제본에 순서대로 적용하면 프로토타입과 바이트까지 같다)
  - 테스트 패치만: 11 files·62 tests 실패, 156 통과
  - 데이터 패치까지: 35 files / 222 통과
  - 디자인 패치까지: 222 통과
  - typecheck·lint 오류 없음, 빌드 표는 M6-1과 같다.
- 패치 파일은 이 계획서 옆에 있다. 작업 폴더가 CRLF면 `git apply --index --ignore-whitespace`로 적용한다(M6-1과 같음).

## Review Focus

1. **남의 id:** 문서·후보·카드·용례·복습 기록 id를 받는 모든 입구(검토 저장, 카드 삭제, 응답, 되돌리기, 뜻 다시 만들기 두 곳, 문서·검토 화면)가 다른 사용자의 id를 "없음"으로 다루는지. `tests/server/isolation.test.ts`가 빠뜨린 입구가 없는지 `grep -rn "getDb()" src/app`과 대조한다.
2. **마이그레이션 데이터 보존:**
   - 기존 DB(0005까지)의 문서·카드·용례·복습 기록·아는 단어·설정이 0006 뒤에 하나도 줄지 않는지(`per-user-migration.test.ts`)
   - 외래 키를 켠 채 돌리면 용례가 지워진다는 점: PM이 확인했다. `client.ts`의 끄기를 되돌리면 이 테스트가 실패해야 한다.
3. **`db:claim`:** 계정이 없거나 이미 데이터가 있으면 아무것도 바꾸지 않고 거절하는지. 한 번 옮기면 임시 소유자가 사라지는지.
4. **같은 단어, 두 사람:** A의 카드·아는 단어가 B의 추출(이미 있음 표시, 아는 단어 제외)에 영향을 주지 않는지.
5. **내부용 함수**(`setMeanings`, `mark*`, `setPhonetic`, `listWordsMissingPhonetic`, `replaceCandidates`, `updateDocumentStatus`)가 브라우저에서 온 id를 주인 확인 없이 받는 경로가 없는지.

---

## 파일 구조

| 파일 | 책임 | 태스크 |
|---|---|---|
| `src/server/db/schema.ts`, `drizzle/0006_per_user.sql`, `drizzle/meta/*` | `user_id`, 고유 키 바꿈, 손으로 쓴 마이그레이션 | 1 |
| `src/server/db/client.ts` | 마이그레이션을 외래 키를 끈 채 실행하고 확인 | 1 |
| `src/server/repo/{documents,candidates,cards,study,vocabulary,settings}.ts` | 모든 함수가 `userId`를 받음 | 1 |
| `src/server/services/{ingest,enrich,usage-meaning}.ts` | `userId` 전달 | 1 |
| `src/app/(app)/**`, `src/app/api/usage-meaning/route.ts` | `const user = await requireUser()` → `user.id` | 1 |
| `src/server/repo/claim.ts`, `scripts/claim-data.ts`, `package.json`(`db:claim`) | 이전 데이터 옮기기 | 1 |
| `tests/helpers/users.ts`, `tests/server/isolation.test.ts`, `tests/server/per-user-migration.test.ts`, 기존 테스트 9개 | 테스트 | 1 |
| `src/app/(auth)/login/{page,login-buttons}.tsx`, `src/components/nav/sign-out-button.tsx` | Designer 검수 수정 3건 | 2 |
| `README.md`, `CHANGELOG.md` | 이전 데이터 옮기기 안내, 변경 기록 | 3 |

---

### Task 1: 사용자별 데이터(표, 마이그레이션, 저장소·서비스·화면, 이전 데이터 옮기기)

**Files:** 위 표의 Task 1 전부. 테스트는 `docs/superpowers/plans/2026-10-16-m6-2-tests.patch`, 나머지는 `docs/superpowers/plans/2026-10-16-m6-2-data.patch`에 있다.

- [ ] **Step 1: 브랜치**

```bash
git fetch origin
git checkout -b feat/m6-2-per-user origin/development
```

- [ ] **Step 2: 실패하는 테스트**

```bash
git apply --index docs/superpowers/plans/2026-10-16-m6-2-tests.patch
```

이 패치가 하는 일:
- 새 도우미 `tests/helpers/users.ts`(`USER`, `OTHER`, `addUser`)
- 새 테스트 두 파일(전문은 아래)
- 기존 테스트 9개를 고친다: `card-edits`, `cards`, `enrich`, `ingest`, `regenerate-meanings`, `repo`, `study`, `undo-answer`, `usage-meaning`
  - 메모리 DB를 만든 뒤 `addUser(db)`를 부른다.
  - 사용자를 받게 된 함수를 `(db, USER, …)`로 부른다.
  - 표에 직접 넣는 행에 `userId: USER`를 붙인다.

`tests/helpers/users.ts`:

```ts
import type { Db } from '@/server/db/client';
import { users } from '@/server/db/schema';

// 테스트용 사용자. 데이터는 모두 주인이 있어야 하므로(M6-2) 메모리 DB를 만든 뒤 넣는다.
export const USER = 'user-a';
export const OTHER = 'user-b';

export function addUser(db: Db, id: string = USER): string {
  db.insert(users)
    .values({ id, name: id, email: `${id}@example.com`, status: 'approved' })
    .run();
  return id;
}
```

`tests/server/isolation.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, OTHER, USER } from '../helpers/users';
import { makePdf } from '../helpers/make-pdf';
import type { MeaningModel } from '@/lib/meaning/generate';
import { createDb, type Db } from '@/server/db/client';
import { reviewLogs, words } from '@/server/db/schema';
import {
  countFailedMeaningsByDocument,
  countOccurrencesByDocument,
  countOccurrencesByWord,
  deleteCard,
  getOccurrenceMeaning,
  listFailedMeaningIds,
  listMeaningRequests,
  listOccurrencesByDocument,
  markMeaningsFailed,
  occurrencesBelongTo,
  ReviewError,
  saveReviewSelection,
} from '@/server/repo/cards';
import { countCandidatesByDocument, listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, getDocument, listDocuments, updateDocumentStatus } from '@/server/repo/documents';
import { getSettings, saveSettings } from '@/server/repo/settings';
import { countStudyToday, getStudyQueue, recordAnswer, StudyError, undoAnswer } from '@/server/repo/study';
import { listKnownLemmas, listWordLemmas } from '@/server/repo/vocabulary';
import { regenerateMeanings } from '@/server/services/enrich';
import { ingestPdf } from '@/server/services/ingest';
import { regenerateUsageMeaning } from '@/server/services/usage-meaning';

// M6-2 격리: 사용자 B는 A의 문서·후보·카드·용례·복습 기록을 어떤 입구로도 읽거나 바꾸지 못한다.
// 남의 id는 "없음"과 같게 다룬다.

const now = new Date(2026, 9, 16, 10, 0, 0);
const candidate = (lemma: string) => ({
  lemma,
  surface: lemma,
  sentence: `The ${lemma} matters.`,
  count: 1,
  isExisting: false,
  inDictionary: true,
});

let db: Db;
let a: { docId: number; reviewingDocId: number; wordId: number; occurrenceId: number; logId: number };

beforeEach(() => {
  db = createDb(':memory:');
  addUser(db, USER);
  addUser(db, OTHER);
  // A: 카드 하나(robust, 뜻 실패), 복습 기록 하나, 아는 단어 하나(paper), 검토 중인 문서 하나
  const doc = createDocument(db, USER, { title: 'A paper', kind: 'paper' });
  replaceCandidates(db, doc.id, [candidate('robust'), candidate('paper')]);
  updateDocumentStatus(db, doc.id, 'reviewing');
  const robust = listCandidates(db, USER, doc.id).find((c) => c.lemma === 'robust')!;
  const saved = saveReviewSelection(db, USER, doc.id, [robust.id]);
  markMeaningsFailed(db, saved.occurrenceIds);
  const { logId } = recordAnswer(db, USER, saved.wordIds[0], 'again', now);
  const reviewing = createDocument(db, USER, { title: 'A draft', kind: 'paper' });
  replaceCandidates(db, reviewing.id, [candidate('heterogeneous')]);
  updateDocumentStatus(db, reviewing.id, 'reviewing');
  a = { docId: doc.id, reviewingDocId: reviewing.id, wordId: saved.wordIds[0], occurrenceId: saved.occurrenceIds[0], logId };
});

describe('another user cannot see A', () => {
  it('documents, candidates and counts are empty for B', () => {
    expect(listDocuments(db, OTHER)).toEqual([]);
    expect(getDocument(db, OTHER, a.docId)).toBeUndefined();
    expect(listCandidates(db, OTHER, a.reviewingDocId)).toEqual([]);
    expect(countCandidatesByDocument(db, OTHER).size).toBe(0);
    expect(countOccurrencesByDocument(db, OTHER).size).toBe(0);
    expect(countFailedMeaningsByDocument(db, OTHER).size).toBe(0);
    expect(listOccurrencesByDocument(db, OTHER, a.docId)).toEqual([]);
    expect(countOccurrencesByWord(db, OTHER, [a.wordId]).size).toBe(0);
    expect(getOccurrenceMeaning(db, OTHER, a.occurrenceId)).toBeUndefined();
    expect(listFailedMeaningIds(db, OTHER, a.docId)).toEqual([]);
    expect(listMeaningRequests(db, OTHER, [a.occurrenceId])).toEqual([]);
    expect(listKnownLemmas(db, OTHER)).toEqual(new Set());
    expect(listWordLemmas(db, OTHER)).toEqual(new Set());
  });

  it('study queue and counts are B’s own', () => {
    expect(getStudyQueue(db, OTHER, now, 20)).toEqual([]);
    expect(countStudyToday(db, OTHER, now, 20)).toEqual({ review: 0, fresh: 0 });
    expect(getStudyQueue(db, USER, new Date(now.getTime() + 86_400_000), 20).map((c) => c.lemma)).toEqual(['robust']);
  });
});

describe('another user cannot change A', () => {
  it('cannot save A’s review, delete A’s card, or answer and undo on A’s card', () => {
    const ids = listCandidates(db, USER, a.reviewingDocId).map((c) => c.id);
    expect(() => saveReviewSelection(db, OTHER, a.reviewingDocId, ids)).toThrow(ReviewError);
    expect(getDocument(db, USER, a.reviewingDocId)?.status).toBe('reviewing');

    expect(deleteCard(db, OTHER, a.wordId)).toBe(false);
    expect(() => recordAnswer(db, OTHER, a.wordId, 'good', now)).toThrow(StudyError);
    expect(() => undoAnswer(db, OTHER, a.logId)).toThrow(StudyError);
    expect(db.select().from(words).all()).toHaveLength(1);
    expect(db.select().from(reviewLogs).all()).toHaveLength(1);
  });

  it('cannot regenerate A’s meanings through either entry point', async () => {
    let called = 0;
    const model: MeaningModel = async (batch) => {
      called += batch.length;
      return batch.map((r) => ({ id: r.id, meaningKo: '뜻' }));
    };
    expect(occurrencesBelongTo(db, OTHER, a.docId, [])).toBe(false);
    expect(occurrencesBelongTo(db, OTHER, a.docId, [a.occurrenceId])).toBe(false);
    expect(await regenerateMeanings(db, OTHER, [a.occurrenceId], model)).toEqual({ error: null, done: 0, failed: 0 });
    expect(await regenerateUsageMeaning(db, OTHER, a.occurrenceId, model)).toEqual({ error: '용례를 찾을 수 없습니다.' });
    expect(called).toBe(0);
    expect(getOccurrenceMeaning(db, USER, a.occurrenceId)?.meaningStatus).toBe('failed');
  });

  it('keeps settings apart', () => {
    saveSettings(db, OTHER, { excludeTopN: 5000, dailyNewLimit: 5, autoSpeak: true });
    expect(getSettings(db, USER).dailyNewLimit).toBe(20);
    expect(getSettings(db, OTHER)).toEqual({ excludeTopN: 5000, dailyNewLimit: 5, autoSpeak: true });
  });
});

describe('the same word for two users', () => {
  it('gives each user their own card and their own known words', async () => {
    const doc = createDocument(db, OTHER, { title: 'B paper', kind: 'paper' });
    replaceCandidates(db, doc.id, [candidate('robust'), candidate('paper')]);
    updateDocumentStatus(db, doc.id, 'reviewing');
    const ids = listCandidates(db, OTHER, doc.id).map((c) => c.id);
    saveReviewSelection(db, OTHER, doc.id, ids); // B는 둘 다 카드로(A는 paper를 아는 단어로 했다)

    const cards = db.select({ userId: words.userId, lemma: words.lemma }).from(words).all();
    expect(cards).toEqual(
      expect.arrayContaining([
        { userId: USER, lemma: 'robust' },
        { userId: OTHER, lemma: 'robust' },
        { userId: OTHER, lemma: 'paper' },
      ]),
    );
    expect(listKnownLemmas(db, USER)).toEqual(new Set(['paper']));
    expect(listKnownLemmas(db, OTHER)).toEqual(new Set());
  });

  it('extracts candidates for B without A’s known words or cards', async () => {
    const pdf = makePdf([
      [
        'This paper examines heterogeneous datasets with rigor.',
        'The proposed estimator remains robust under perturbations.',
        'We evaluate heterogeneous perturbations on several benchmarks.',
        'Results confirm that the estimator generalizes across domains.',
      ],
    ]);
    const result = await ingestPdf(db, OTHER, { fileName: 'b.pdf', title: '', kind: 'paper', bytes: pdf });
    const lemmas = listCandidates(db, OTHER, result.documentId);
    expect(lemmas.find((c) => c.lemma === 'robust')?.isExisting).toBe(false); // A의 카드는 B에게 "이미 있음"이 아니다
    expect(getDocument(db, USER, result.documentId)).toBeUndefined();
  });
});
```

`tests/server/per-user-migration.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addUser } from '../helpers/users';
import { createDb, type Db } from '@/server/db/client';
import { documents, knownWords, occurrences, reviewLogs, settings, users, words } from '@/server/db/schema';
import { ClaimError, claimLegacyData, LEGACY_OWNER } from '@/server/repo/claim';

// 0006_per_user가 기존 데이터를 하나도 잃지 않고 임시 소유자에게 묶는지, db:claim이 내 계정으로 옮기는지 본다.
// 0005까지만 적용한 DB에 옛 모양의 행을 넣고, createDb로 나머지 마이그레이션을 돌린다.

let dir: string;
let file: string;
const opened: Db[] = [];
// 열어 둔 DB는 닫아야 Windows에서 임시 폴더를 지울 수 있다.
const open = (f: string) => {
  const db = createDb(f);
  opened.push(db);
  return db;
};

function migrateUpTo0005(target: string) {
  const folder = path.join(dir, 'drizzle');
  fs.cpSync(path.join(process.cwd(), 'drizzle'), folder, { recursive: true });
  const journalPath = path.join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] };
  journal.entries = journal.entries.filter((e) => e.tag !== '0006_per_user');
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  const sqlite = new Database(target);
  migrate(drizzle({ client: sqlite }), { migrationsFolder: folder });
  return sqlite;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slave-voca-mig-'));
  file = path.join(dir, 'app.db');
});

afterEach(() => {
  for (const db of opened.splice(0)) (db as unknown as { $client: Database.Database }).$client.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function seedOldData() {
  const sqlite = migrateUpTo0005(file);
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    INSERT INTO documents (id, title, kind, status, created_at) VALUES (1, 'Paper', 'paper', 'done', 1);
    INSERT INTO words (id, lemma, created_at, state, reps) VALUES (1, 'robust', 1, 2, 3), (2, 'paradigm', 1, 0, 0);
    INSERT INTO occurrences (id, word_id, document_id, surface, sentence, meaning_ko, meaning_status, created_at)
      VALUES (1, 1, 1, 'robust', 'A robust model.', '강건한', 'done', 1), (2, 2, 1, 'paradigm', 'A paradigm.', NULL, 'failed', 1);
    INSERT INTO review_logs (word_id, rating, reviewed_at) VALUES (1, 3, 1);
    INSERT INTO known_words (lemma, created_at) VALUES ('paper', 1);
    INSERT INTO settings (key, value) VALUES ('daily_new_limit', '7');
  `);
  sqlite.close();
}

describe('0006_per_user migration', () => {
  it('keeps every row and gives them to the legacy owner', () => {
    seedOldData();
    const db = open(file);
    expect(db.select().from(occurrences).all()).toHaveLength(2);
    expect(db.select().from(reviewLogs).all()).toHaveLength(1);
    expect(db.select({ u: words.userId, l: words.lemma, reps: words.reps }).from(words).all()).toEqual([
      { u: LEGACY_OWNER, l: 'robust', reps: 3 },
      { u: LEGACY_OWNER, l: 'paradigm', reps: 0 },
    ]);
    expect(db.select({ u: documents.userId }).from(documents).all()).toEqual([{ u: LEGACY_OWNER }]);
    expect(db.select({ u: knownWords.userId }).from(knownWords).all()).toEqual([{ u: LEGACY_OWNER }]);
    expect(db.select({ u: settings.userId, v: settings.value }).from(settings).all()).toEqual([{ u: LEGACY_OWNER, v: '7' }]);
    expect(db.select({ id: users.id, status: users.status }).from(users).all()).toEqual([
      { id: LEGACY_OWNER, status: 'blocked' },
    ]);
  });

  it('does not create the legacy owner for an empty database', () => {
    const db = open(file);
    expect(db.select().from(users).all()).toEqual([]);
  });
});

describe('claimLegacyData', () => {
  let db: Db;
  beforeEach(() => {
    seedOldData();
    db = open(file);
    db.insert(users).values({ id: 'me', name: 'Me', email: 'me@example.com', status: 'approved', role: 'admin' }).run();
  });

  it('moves everything to the account and removes the legacy owner', () => {
    expect(claimLegacyData(db, ' Me@Example.com ')).toEqual({ documents: 1, words: 2, knownWords: 1, settings: 1 });
    expect(new Set(db.select({ u: words.userId }).from(words).all().map((r) => r.u))).toEqual(new Set(['me']));
    expect(db.select({ id: users.id }).from(users).all()).toEqual([{ id: 'me' }]);
    expect(db.select().from(occurrences).all()).toHaveLength(2);
    expect(() => claimLegacyData(db, 'me@example.com')).toThrow('넘길 이전 데이터가 없습니다.');
  });

  it('refuses an unknown email or an account that already has data, changing nothing', () => {
    expect(() => claimLegacyData(db, 'nobody@example.com')).toThrow(ClaimError);
    addUser(db, 'busy');
    db.insert(knownWords).values({ userId: 'busy', lemma: 'x' }).run();
    expect(() => claimLegacyData(db, 'busy@example.com')).toThrow('이미 데이터가 있어');
    expect(db.select({ u: words.userId }).from(words).all().every((r) => r.u === LEGACY_OWNER)).toBe(true);
  });
});
```

Run: `npx vitest run`
Expected(PM이 확인함): 11 files·62 tests 실패, 156 통과. 원인은 함수에 사용자 인자가 없거나, `@/server/repo/claim`이 없거나, `user_id` 열이 없어서다.

- [ ] **Step 3: 구현**

```bash
git apply --index docs/superpowers/plans/2026-10-16-m6-2-data.patch
```

이 패치의 요점을 아래에 적는다. 나머지 저장소 함수는 모두 같은 방식이다. id를 받는 조회에는 `documents.userId` 또는 `words.userId` 조건을 붙인다.

`drizzle/0006_per_user.sql`(손으로 씀. drizzle-kit이 만든 SQL은 기존 행에 넣을 `user_id`가 없어 실패한다):

```sql
-- M6-2: 문서·단어·아는 단어·설정에 주인(user_id)을 붙인다. 손으로 쓴 마이그레이션이다(drizzle-kit이 만든 SQL은
-- 기존 행에 넣을 user_id가 없어 실패한다). 기존 데이터는 임시 소유자 legacy-owner에게 묶고, 계정 주인이
-- npm run db:claim -- <이메일>로 가져간다. 데이터가 하나도 없으면 legacy-owner를 만들지 않는다.
-- 표를 새로 만들 때 연결된 행(후보·용례·복습 기록)이 지워지지 않도록 client.ts가 외래 키를 끈 채 이 파일을 실행하고,
-- 끝난 뒤 foreign_key_check로 확인한다.
INSERT INTO `users` (`id`, `name`, `email`, `status`, `role`)
SELECT 'legacy-owner', '이전 데이터', 'legacy-owner@localhost', 'blocked', 'user'
WHERE EXISTS (SELECT 1 FROM `documents`) OR EXISTS (SELECT 1 FROM `words`)
   OR EXISTS (SELECT 1 FROM `known_words`) OR EXISTS (SELECT 1 FROM `settings`);
--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'extracting' NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_documents` (`id`, `user_id`, `title`, `kind`, `status`, `error_message`, `created_at`)
SELECT `id`, 'legacy-owner', `title`, `kind`, `status`, `error_message`, `created_at` FROM `documents`;
--> statement-breakpoint
DROP TABLE `documents`;
--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;
--> statement-breakpoint
CREATE INDEX `documents_user_id_idx` ON `documents` (`user_id`);
--> statement-breakpoint
CREATE TABLE `__new_words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`lemma` text NOT NULL,
	`phonetic` text,
	`created_at` integer NOT NULL,
	`due` integer DEFAULT 0 NOT NULL,
	`stability` real DEFAULT 0 NOT NULL,
	`difficulty` real DEFAULT 0 NOT NULL,
	`elapsed_days` integer DEFAULT 0 NOT NULL,
	`scheduled_days` integer DEFAULT 0 NOT NULL,
	`learning_steps` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`state` integer DEFAULT 0 NOT NULL,
	`last_review` integer,
	`introduced_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_words` (`id`, `user_id`, `lemma`, `phonetic`, `created_at`, `due`, `stability`, `difficulty`,
  `elapsed_days`, `scheduled_days`, `learning_steps`, `reps`, `lapses`, `state`, `last_review`, `introduced_at`)
SELECT `id`, 'legacy-owner', `lemma`, `phonetic`, `created_at`, `due`, `stability`, `difficulty`,
  `elapsed_days`, `scheduled_days`, `learning_steps`, `reps`, `lapses`, `state`, `last_review`, `introduced_at` FROM `words`;
--> statement-breakpoint
DROP TABLE `words`;
--> statement-breakpoint
ALTER TABLE `__new_words` RENAME TO `words`;
--> statement-breakpoint
CREATE UNIQUE INDEX `words_user_id_lemma_unique` ON `words` (`user_id`,`lemma`);
--> statement-breakpoint
CREATE TABLE `__new_known_words` (
	`user_id` text NOT NULL,
	`lemma` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `lemma`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_known_words` (`user_id`, `lemma`, `created_at`) SELECT 'legacy-owner', `lemma`, `created_at` FROM `known_words`;
--> statement-breakpoint
DROP TABLE `known_words`;
--> statement-breakpoint
ALTER TABLE `__new_known_words` RENAME TO `known_words`;
--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`user_id`, `key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_settings` (`user_id`, `key`, `value`) SELECT 'legacy-owner', `key`, `value` FROM `settings`;
--> statement-breakpoint
DROP TABLE `settings`;
--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;
```

`src/server/db/client.ts`:

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
  const db = drizzle({ client: sqlite, schema });
  // 마이그레이션은 외래 키를 끈 채 돌린다. 마이그레이션은 한 트랜잭션이라 그 안의 PRAGMA foreign_keys=OFF는
  // 효과가 없고, 켜진 채 표를 새로 만들면(0006) DROP TABLE이 연결된 행까지 지운다. 끝난 뒤 깨진 연결이 없는지 본다.
  sqlite.pragma('foreign_keys = OFF');
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  const broken = sqlite.pragma('foreign_key_check') as unknown[];
  if (broken.length > 0) throw new Error(`마이그레이션 뒤 외래 키가 깨졌습니다: ${JSON.stringify(broken.slice(0, 5))}`);
  sqlite.pragma('foreign_keys = ON');
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

`src/server/repo/claim.ts`:

```ts
import { and, count, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { documents, knownWords, settings, users, words } from '../db/schema';

// M6-2 마이그레이션이 기존 데이터를 묶어 둔 임시 소유자(0006_per_user.sql).
export const LEGACY_OWNER = 'legacy-owner';

export class ClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaimError';
  }
}

export interface ClaimResult {
  documents: number;
  words: number;
  knownWords: number;
  settings: number;
}

// 임시 소유자의 데이터를 그 이메일의 계정으로 옮기고 임시 소유자를 지운다. 계정은 먼저 로그인해서 만들어 둬야 하고,
// 같은 단어 카드가 겹치지 않도록 아직 데이터가 없어야 한다. 한 트랜잭션이라 실패하면 아무것도 바뀌지 않는다.
export function claimLegacyData(db: Db, email: string): ClaimResult {
  return db.transaction((tx) => {
    const legacy = tx.select({ id: users.id }).from(users).where(eq(users.id, LEGACY_OWNER)).get();
    if (!legacy) throw new ClaimError('넘길 이전 데이터가 없습니다.');
    const target = tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .get();
    if (!target) throw new ClaimError(`${email} 계정이 없습니다. 먼저 그 계정으로 로그인하세요.`);
    const owned = (table: typeof documents | typeof words | typeof knownWords | typeof settings) =>
      tx.select({ n: count() }).from(table).where(eq(table.userId, target.id)).get()?.n ?? 0;
    if (owned(documents) + owned(words) + owned(knownWords) + owned(settings) > 0) {
      throw new ClaimError(`${email} 계정에 이미 데이터가 있어 합칠 수 없습니다.`);
    }
    const move = (table: typeof documents | typeof words | typeof knownWords | typeof settings) =>
      tx.update(table).set({ userId: target.id }).where(eq(table.userId, LEGACY_OWNER)).run().changes;
    const result = {
      documents: move(documents),
      words: move(words),
      knownWords: move(knownWords),
      settings: move(settings),
    };
    tx.delete(users).where(and(eq(users.id, LEGACY_OWNER))).run();
    return result;
  });
}
```

`scripts/claim-data.ts`:

```ts
import path from 'node:path';
import { createDb } from '../src/server/db/client';
import { ClaimError, claimLegacyData } from '../src/server/repo/claim';

// M6-2 이전 데이터를 내 계정으로 옮긴다. 사용법: npm run db:claim -- you@gmail.com
// 먼저 그 계정으로 로그인해 계정을 만들어 둔다. DB 경로는 앱과 같다(SLAVE_VOCA_DB, 없으면 data/app.db).
const email = process.argv[2];
if (!email) {
  console.error('사용법: npm run db:claim -- <이메일>');
  process.exit(1);
}
const db = createDb(process.env.SLAVE_VOCA_DB ?? path.join(process.cwd(), 'data', 'app.db'));
try {
  const r = claimLegacyData(db, email);
  console.log(`옮겼습니다: 문서 ${r.documents}, 카드 ${r.words}, 아는 단어 ${r.knownWords}, 설정 ${r.settings}`);
} catch (err) {
  if (err instanceof ClaimError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
```

`package.json` scripts에 `"db:claim": "tsx scripts/claim-data.ts"`가 더해진다.

화면·Action은 `await requireUser();`를 `const user = await requireUser();`로 바꾸고 `user.id`를 넘긴다. 상단 바 배지(`(app)/layout.tsx`)와 `/api/usage-meaning`은 `getSessionUser()`의 `user.id`를 쓴다.

**`drizzle/meta/0006_snapshot.json`과 `_journal.json`도 패치에 들어 있다.** 스키마를 고친 뒤 `npx drizzle-kit generate --name per_user`로 스냅샷을 만들고, 생성된 SQL만 위 손으로 쓴 파일로 바꾼 것이다. 다시 만들지 않는다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run`, `npm run typecheck`, `npm run lint`
Expected: 35 files / 222 통과, 오류 없음

데이터 보존 확인(Review Focus 2): `src/server/db/client.ts`의 `sqlite.pragma('foreign_keys = OFF');`를 잠시 `ON`으로 바꾸고 `npx vitest run tests/server/per-user-migration.test.ts`를 돌린다.
- Expected: 2개가 실패한다. 용례가 2개에서 0개가 된다(PM이 확인함).
- 확인한 뒤 되돌린다. 이 변경은 커밋하지 않는다.

- [ ] **Step 5: 커밋**

```bash
git commit -m "feat: give documents, cards, known words and settings an owner and scope every query by user"
```

---

### Task 2: M6-1 Designer 검수 수정 3건

Designer 검수(2026-10-16) 결과다. "다크에서 버튼이 라이트 색" 확인 건은 PM이 실제 `theme=dark` 쿠키로 열고 1초 뒤에 쟀다. 로그아웃 글자가 `rgb(207,201,189)`(#cfc9bd)였으므로 캡처가 색 전환 도중에 찍힌 것이고 버그가 아니다. 수정은 다음 세 건이다.
1. 로그인 제목의 `<br>`을 모든 폭에서 둔다(375px에서 "논문에서 만난 단어를 / 그 문장의 뜻으로 외웁니다").
2. 로그아웃 실패, 개발용 로그인 오류 문구는 `Failed` 부품으로 쓴다(빨강은 점과 선에만). 로그아웃 문구는 "로그아웃하지 못했습니다"다.
3. 개발용 로그인 폼을 보조 문구("초대받은 분만…") 아래로 옮긴다. 별도 Suspense 구성 요소가 요청 때 환경변수를 읽는다.

- [ ] **Step 1: 적용**

```bash
git apply --index docs/superpowers/plans/2026-10-16-m6-2-design-fixes.patch
```

```diff
diff --git a/src/app/(auth)/login/login-buttons.tsx b/src/app/(auth)/login/login-buttons.tsx
index 65bc3fb..8218fe7 100644
--- a/src/app/(auth)/login/login-buttons.tsx
+++ b/src/app/(auth)/login/login-buttons.tsx
@@ -1,5 +1,6 @@
 "use client";
 
+import { Failed } from "@/components/ui/status";
 import { useState } from "react";
 import { GoogleButton } from "@/components/auth/google-button";
 import { buttonClass } from "@/components/ui/button";
@@ -73,7 +74,11 @@ export function DevLoginForm({ next }: { next: string }) {
       <button type="submit" className={buttonClass({ variant: "secondary" })}>
         들어가기
       </button>
-      {message && <p className="text-sm text-again">{message}</p>}
+      {message && (
+        <p role="alert">
+          <Failed>{message}</Failed>
+        </p>
+      )}
     </form>
   );
 }
diff --git a/src/app/(auth)/login/page.tsx b/src/app/(auth)/login/page.tsx
index 66a4419..04c4057 100644
--- a/src/app/(auth)/login/page.tsx
+++ b/src/app/(auth)/login/page.tsx
@@ -14,7 +14,7 @@ export default function LoginPage(props: PageProps<"/login">) {
   return (
     <>
       <h1 className="text-2xl leading-[1.35] font-bold tracking-[-0.01em]">
-        논문에서 만난 단어를<br className="max-sm:hidden" /> 그 문장의 뜻으로 외웁니다
+        논문에서 만난 단어를<br /> 그 문장의 뜻으로 외웁니다
       </h1>
       <p className="mt-2.5 mb-6 text-[15px] leading-[1.6] text-ink-2">
         PDF를 올리면 어려운 영어 단어를 골라 문장 속 뜻과 발음기호를 붙이고, 간격 반복으로 복습하게 합니다.
@@ -35,10 +35,21 @@ export default function LoginPage(props: PageProps<"/login">) {
       <p className="mt-3.5 text-[13px] text-muted">
         초대받은 분만 쓸 수 있습니다. 처음 로그인하면 관리자가 승인한 뒤부터 쓸 수 있습니다.
       </p>
+      <Suspense fallback={null}>
+        <DevLogin searchParams={props.searchParams} />
+      </Suspense>
     </>
   );
 }
 
+// 개발 전용 로그인(이 컴퓨터 주소에서 AUTH_DEV_LOGIN=1일 때만). 환경변수는 요청 때 읽는다.
+async function DevLogin({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
+  await connection();
+  if (!devLoginEnabled(process.env)) return null;
+  const { next } = await searchParams;
+  return <DevLoginForm next={safeNextPath(next)} />;
+}
+
 async function LoginActions({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
   await connection();
   // 이미 로그인했으면 상태에 맞는 화면으로 보낸다.
@@ -60,7 +71,6 @@ async function LoginActions({ searchParams }: { searchParams: PageProps<"/login"
         </Notice>
       )}
       <GoogleSignInButton next={next} />
-      {devLoginEnabled(process.env) && <DevLoginForm next={next} />}
     </>
   );
 }
diff --git a/src/components/nav/sign-out-button.tsx b/src/components/nav/sign-out-button.tsx
index cbb83cc..873bfd4 100644
--- a/src/components/nav/sign-out-button.tsx
+++ b/src/components/nav/sign-out-button.tsx
@@ -2,6 +2,7 @@
 
 import { useState } from "react";
 import { buttonClass } from "@/components/ui/button";
+import { Failed } from "@/components/ui/status";
 import { succeeded } from "@/lib/auth/attempt";
 import { authClient } from "@/lib/auth/client";
 
@@ -40,8 +41,8 @@ export function SignOutButton({ variant = "button" }: { variant?: "button" | "me
   return (
     <span className="inline-flex flex-col items-end gap-1">
       {button}
-      <span role="alert" className="text-xs text-again">
-        로그아웃하지 못했습니다. 다시 시도해 주세요.
+      <span role="alert">
+        <Failed>로그아웃하지 못했습니다</Failed>
       </span>
     </span>
   );
```

- [ ] **Step 2: 확인과 커밋**

Run: `npx vitest run`, `npm run typecheck`, `npm run lint`
Expected: 222 통과, 오류 없음

```bash
git commit -m "fix: apply the M6-1 design review (heading break, failure messages, dev login position)"
```

---

### Task 3: 안내·변경 기록, 브라우저 확인, PR

- [ ] **Step 1: README**

"Google 로그인 설정" 절 다음에 절을 하나 더한다.

```markdown
### 이전 데이터 옮기기(M6 이전에 쓰던 DB)

로그인이 생기기 전의 문서·카드·아는 단어·설정은 업그레이드할 때 임시 소유자에게 묶입니다. 내 계정으로 옮기려면 다음 순서를 따릅니다.

1. 앱을 실행하고 내 Google 계정(또는 개발용 로그인)으로 한 번 로그인합니다.
2. 앱을 끄지 않아도 됩니다. 다른 터미널에서 `npm run db:claim -- 내이메일@gmail.com`을 실행합니다. 다른 DB를 쓰면 `SLAVE_VOCA_DB`도 지정합니다.
3. "옮겼습니다: 문서 n, 카드 n, …"이 나오면 끝입니다. 화면을 새로 고치면 보입니다.

그 계정에 이미 데이터가 있으면 합치지 않고 멈춥니다(같은 단어 카드가 겹치지 않게).
```

- [ ] **Step 2: 변경 기록**

`CHANGELOG.md`의 `## [Unreleased]`에 더한다. M6-1 항목이 이미 있으면 같은 구역 안에 넣는다.

```markdown
### 추가
- 데이터를 사용자별로 나눴다. 문서·카드·아는 단어·설정은 각자의 것이고, 다른 사람의 데이터는 보거나 바꿀 수 없다.
- `npm run db:claim -- <이메일>`: 로그인 전에 쓰던 데이터를 내 계정으로 옮긴다(README).

### 업그레이드 시 주의
- DB 마이그레이션 `0006_per_user`가 기존 데이터를 임시 소유자에게 묶는다. 업그레이드한 뒤 한 번 로그인하고 `npm run db:claim -- <이메일>`을 실행해야 이전 데이터가 보인다.
```

```bash
git add README.md CHANGELOG.md
git commit -m "docs: explain moving pre-login data to an account and record M6-2"
```

- [ ] **Step 3: 브라우저 확인** (데모 DB **사본**, `next start -p 3300`, 헤드리스 Edge)

환경변수:
- `BETTER_AUTH_URL=http://localhost:3300`
- `BETTER_AUTH_SECRET=<32자 이상>`
- `ADMIN_EMAILS=owner@example.com`
- `AUTH_DEV_LOGIN=1`
- `SLAVE_VOCA_DB=<사본>`

Better Auth는 로그인 요청을 10초에 3번까지만 받으므로, 로그인 사이에 1.5초 이상 간격을 둔다. PM 프로토타입의 결과는 아래와 같다.
1. owner 개발 로그인 → `/documents`에 문서 0개(이전 데이터는 아직 임시 소유자의 것)
2. `npm run db:claim -- owner@example.com` → "옮겼습니다: 문서 3, 카드 467, 아는 단어 69, 설정 0". 새로 고치면 문서 3개, 상단 바 "복습 20"
3. friend 가입 → owner가 `/admin`에서 승인한다. 그 뒤 friend 화면은 다음과 같다.
   - `/documents` 0개
   - 홈 "아직 올린 문서가 없습니다"
   - `/study` "오늘 복습을 마쳤습니다"
4. friend가 owner의 `/documents/1`을 열면 404 화면이다.
5. friend의 `POST /api/usage-meaning {occurrenceId: 1}` → `{"error":"용례를 찾을 수 없습니다."}`
6. owner의 `/study`는 그대로다(첫 카드 "layer").
7. friend가 PDF를 올리면 owner의 아는 단어·카드와 상관없이 후보가 나온다. owner의 문서 목록에는 그 문서가 없다.
8. Designer 확인용 스크린샷 두 장을 PM에게 보낸다.
   - 375px 로그인(제목 두 줄, 개발용 폼이 보조 문구 아래)
   - `theme=dark` 승인 대기(1280·375)

- [ ] **Step 4: PR, CI, 리뷰, 병합**

```bash
git push -u origin feat/m6-2-per-user
gh pr create --base development --title "feat: M6-2 per-user data" --body-file <본문>
gh pr checks --watch
```

Codex 리뷰에 Review Focus 1~5를 보낸다. 요약을 PR 댓글로 남긴 뒤 `gh pr merge --merge --delete-branch`로 병합한다.

PM에게 보낼 것:
- PR·CI 링크, 병합 해시
- 테스트 수, 빌드 표
- Step 3의 1~8 결과
- Step 4 데이터 보존 확인 결과
- 리뷰 요약
