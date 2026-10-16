# M5: 상업적으로 쓸 수 있는 데이터로 교체 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 베타 배포와 수익화의 첫 단계로, 상업적으로 쓸 수 없는 데이터를 앱에서 없앤다. 바뀌는 것은 다음과 같다.
- 빈도표: wordfreq(CC BY-SA 4.0)
- 흔한 단어 제외 기준 N: 기본값 3,000
- 학술 핵심어 예외(AWL): 없앰
- 사전 API(dictionaryapi.dev): 없앰. 발음기호는 CMUdict만 쓴다.

**Architecture:**
- **데이터 생성:** 빈도표는 지금처럼 `data/frequency.json` 하나다. 만드는 쪽만 바뀐다. Python 스크립트가 wordfreq 단어 목록을 쓰고, 기존 TS 스크립트가 JSON으로 바꾼다.
- **추출 규칙:** 순수 함수 `extractCandidates`에서 `isAcademic` 옵션과 예외 분기만 빠진다.
- **발음기호:** `enrich.ts`의 의존성 `lookupPhonetic` 시그니처는 그대로이고, 기본 구현이 CMUdict 전용으로 바뀐다.

**Tech Stack:**
- 앱: 기존 스택 그대로(새 npm 의존성 없음)
- 빈도표 생성 때만: Python과 `wordfreq==3.1.1`

**Spec:** `docs/superpowers/specs/2026-10-16-m5-data-license-design.md`(사용자 결정 A, 실측표와 확인 기준), 상위 설계서 8.2·8.3·8.5·8.7(이미 M5 기준으로 고쳐져 있다)

## Global Constraints

- 브랜치: 최신 `origin/development`에서 `feat/m5-data-license`. PR은 `--base development`이다. 태스크마다 커밋한다.
- 리뷰는 Orca의 Codex 터미널에 맡긴다. Important 이상은 테스트를 먼저 써서 고친다. 리뷰 요약은 PR 댓글로 남긴다.
- development 병합은 사용자에게 묻지 않는다. 릴리스(main 병합)는 이 계획에 없다. PM이 따로 알린다.
- **이미 저장된 후보·카드·뜻·발음기호와 DB 스키마는 바꾸지 않는다.** 마이그레이션은 없다.
- 실제 Gemini 호출은 없다. 3000번 포트는 쓰지 않는다(3300).
- 커밋에 넣지 않는 것: `data/awl.json`(로컬에 있을 수 있음), `data/wordfreq-en.txt`, DB, 로그, `*.tmp.*` 확인용 스크립트. 공개 저장소다.
- PM 프로토타입(스크래치 복제본)에서 아래 코드를 그대로 돌려 확인했다. 결과는 다음과 같다.
  - 테스트 28 files / 181 tests 통과, 건너뜀 0
  - typecheck·lint 오류 없음
  - 빌드 표는 지금과 같다(◐ 유지, `ƒ /api/usage-meaning`)

## Review Focus

1. 추출 결과가 PM 실측과 원형·표면형·횟수까지 같은지(Task 4 Step 1). 하이픈 복원도 빈도표를 쓰므로 함께 바뀐다.
2. 사용자가 저장한 N(예: 5000)은 그대로 쓰이고, 저장된 값이 없을 때만 3,000인지(`getSettings`).
3. CMUdict 조회가 실패해도(파일 없음) 저장이 오류로 끝나지 않고 발음기호만 비는지(`createCmudictPhonetic` 테스트).
4. 저장 직후 채우기에 네트워크 요청이 남아 있지 않은지(`dictionaryapi`, `fetch` 검색).
5. CC BY-SA 4.0 출처 표시가 빠지지 않았는지(`data/frequency-NOTICE.md`, README). 로컬 `data/awl.json`이나 그 내용이 커밋에 들어가지 않았는지.

---

## 파일 구조

| 파일 | 책임 | 태스크 |
|---|---|---|
| `scripts/export-wordfreq.py`(새 파일) | wordfreq 영어 단어 20,000개 → `data/wordfreq-en.txt` | 1 |
| `scripts/build-frequency.ts` | 단어 목록 파일 → `data/frequency.json` | 1 |
| `data/frequency.json`, `data/frequency-NOTICE.md`(새 파일) | 빈도표와 출처 표시 | 1 |
| `src/lib/extract/extract.ts`, `src/server/services/ingest.ts` | 학술어 예외 제거 | 2 |
| `src/lib/extract/academic.ts` | 지움 | 2 |
| `src/server/repo/settings.ts`, `src/lib/settings.ts`, `src/app/settings/settings-form.tsx` | N 기본값 3,000, 도움말 문구 | 2 |
| `src/lib/phonetic/cmudict.ts`, `src/server/services/enrich.ts` | CMUdict 전용 발음기호 | 3 |
| `src/lib/phonetic/lookup.ts` | 지움 | 3 |
| `README.md`, `CHANGELOG.md`, `.gitignore`, `package.json` | 출처 표, 변경 기록, 무시 목록, `freq:build` | 1·2·4 |

테스트 수: 시작 191(로컬 `data/awl.json` 있음) 또는 189 + 2 건너뜀 → Task 2 후 189 → Task 3 후 181.

---

### Task 1: 빈도표를 wordfreq로

**Files:**
- Create: `scripts/export-wordfreq.py`, `data/frequency-NOTICE.md`
- Modify: `scripts/build-frequency.ts`(전체 교체), `package.json`(`freq:build`), `data/frequency.json`(다시 생성), `.gitignore`, `README.md`

- [ ] **Step 1: 브랜치**

```bash
git fetch origin
git checkout -b feat/m5-data-license origin/development
pip install wordfreq==3.1.1
```

- [ ] **Step 2: 스크립트**

`scripts/export-wordfreq.py`:

```python
# wordfreq(데이터 CC BY-SA 4.0)의 영어 빈도순 단어 중 알파벳 소문자 단어 20,000개를 한 줄에 하나씩 쓴다.
# 출처 표시는 data/frequency-NOTICE.md. 사용법: pip install wordfreq==3.1.1 후 npm run freq:build
import re
import sys

import wordfreq

sys.stdout.reconfigure(encoding='utf-8')

LIMIT = 20000
words = [w for w in wordfreq.top_n_list('en', LIMIT * 2) if re.fullmatch('[a-z]+', w)][:LIMIT]
if len(words) < LIMIT:
    sys.exit(f'wordfreq 단어가 모자랍니다: {len(words)}개')
with open(sys.argv[1], 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(words) + '\n')
print(f'{sys.argv[1]}: {len(words)}개 (wordfreq en)')
```

`scripts/build-frequency.ts`(전체 교체):

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { buildFrequencyMap } from '../src/lib/extract/build-frequency-map';

// scripts/export-wordfreq.py가 쓴 빈도순 단어 목록(한 줄에 하나)을 data/frequency.json으로 바꾼다.
const SOURCE = process.argv[2] ?? 'data/wordfreq-en.txt';

const words = readFileSync(SOURCE, 'utf8').split(/\r?\n/);
const map = buildFrequencyMap(words);
writeFileSync('data/frequency.json', JSON.stringify(map));
console.log(`data/frequency.json: ${Object.keys(map).length}개 항목`);
```

`package.json`의 `freq:build`:

```json
    "freq:build": "python scripts/export-wordfreq.py data/wordfreq-en.txt && tsx scripts/build-frequency.ts data/wordfreq-en.txt",
```

`.gitignore`에서 아래 두 줄을 지운다.

```
# AWL headwords: no stated license, build your own (README)
/data/awl.json
```

그 자리에 아래 두 줄을 넣는다.

```
# wordfreq export (regenerate with npm run freq:build)
/data/wordfreq-en.txt
```

- [ ] **Step 3: 빈도표 다시 만들기**

Run: `npm run freq:build`
Expected:
- `data/wordfreq-en.txt: 20000개 (wordfreq en)`
- `data/frequency.json: 20464개 항목`
- `sha256sum data/frequency.json` → `0e6dfc2baa32e9fda85ade9ab30be3b74b19ae51500f09bace2779ad157e87cc`(PM 프로토타입과 같음)

- [ ] **Step 4: 출처 표시**

`data/frequency-NOTICE.md`:

```markdown
# data/frequency.json 출처와 라이선스

`data/frequency.json`은 [wordfreq](https://github.com/rspeer/wordfreq) 3.1.1의 영어 단어 빈도 데이터에서 만든 파생 데이터다. 알파벳 소문자 단어 20,000개의 빈도 순위와, 그 원형의 순위가 들어 있다. 만드는 방법은 `scripts/export-wordfreq.py`, `scripts/build-frequency.ts`(`npm run freq:build`)에 있다.

- 라이선스: wordfreq 데이터와 이 파생 파일은 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)이다. 이 저장소의 코드(MIT)와는 따로 적용된다.
- wordfreq: Robyn Speer. (2022). rspeer/wordfreq: v3.0 (v3.0.2). Zenodo. https://doi.org/10.5281/zenodo.7199437

wordfreq는 아래 자료를 바탕으로 한다. wordfreq의 요청에 따라 출처를 밝힌다.

- SUBTLEX(무료로 공개된 데이터이며, 작성자의 허락을 받아 wordfreq에 쓰였다)
  - Brysbaert, M. & New, B. (2009). Moving beyond Kucera and Francis: A Critical Evaluation of Current Word Frequency Norms and the Introduction of a New and Improved Word Frequency Measure for American English. Behavior Research Methods, 41(4), 977–990.
  - van Heuven, W. J., Mandera, P., Keuleers, E., & Brysbaert, M. (2014). SUBTLEX-UK: A new and improved word frequency database for British English. The Quarterly Journal of Experimental Psychology, 67(6), 1176–1190.
- Google Books Ngram Viewer(https://books.google.com/ngrams). Lin, Y., Michel, J.-B., Aiden, E. L., Orwant, J., Brockman, W., & Petrov, S. (2012). Syntactic annotations for the Google Books Ngram Corpus. Proceedings of the ACL 2012 System Demonstrations, 169–174.
- OpenSubtitles(https://www.opensubtitles.org). Lison, P. & Tiedemann, J. (2016). OpenSubtitles2016: Extracting Large Parallel Corpora from Movie and TV Subtitles. LREC 2016.
- 그 밖에 Wikipedia, Leeds Internet Corpus, ParaCrawl 등 CC 라이선스 자료와 Twitter 통계(내용은 재배포하지 않음). 전체 목록은 wordfreq README를 따른다.
```

`README.md`에서 고칠 곳은 네 군데다.
1. 6번째 줄의 "발음기호는 CMUdict와 Free Dictionary API에서 가져옵니다."를 "발음기호는 CMUdict에서 가져옵니다."로 바꾼다.
2. 5번째 줄의 "빈도·학술어 기준으로"를 "빈도 기준으로"로 바꾼다.
3. "### 학술 핵심어 목록(선택)" 절(제목부터 다음 "## 데이터 출처" 앞까지)을 지운다.
4. 데이터 출처 표의 `data/frequency.json` 줄과 `data/awl.json` 줄을 아래 한 줄로 바꾼다.

```markdown
| `data/frequency.json` | [wordfreq](https://github.com/rspeer/wordfreq) 3.1.1 영어 빈도(SUBTLEX, Google Books Ngram, OpenSubtitles, Wikipedia 등에서 집계). `npm run freq:build`로 다시 만든다(Python, `pip install wordfreq==3.1.1`) | CC BY-SA 4.0, 출처는 `data/frequency-NOTICE.md` |
```

- [ ] **Step 5: 확인과 커밋**

Run: `npx vitest run`
Expected: 모두 통과한다(빈도표만 바뀌고 규칙은 그대로라 테스트 수는 시작과 같다). `tests/server/ingest.test.ts`의 hence 기대값은 아직 학술어 목록 유무에 따른다.

```bash
git add scripts/export-wordfreq.py scripts/build-frequency.ts package.json data/frequency.json data/frequency-NOTICE.md .gitignore README.md
git commit -m "feat: build the frequency list from wordfreq (CC BY-SA 4.0)"
```

---

### Task 2: 학술어 예외 제거, N 기본값 3,000

**Files:**
- Delete: `src/lib/extract/academic.ts`
- Modify: `src/lib/extract/extract.ts`, `src/server/services/ingest.ts`, `src/server/repo/settings.ts`, `src/lib/settings.ts`, `src/app/settings/settings-form.tsx`
- Test: `tests/lib/extract/extract.test.ts`, `tests/lib/extract/word-lists.test.ts`, `tests/server/ingest.test.ts`, `tests/server/repo.test.ts`

- [ ] **Step 1: 실패하는 테스트**

아래 diff대로 테스트를 고친다.

```diff
diff --git a/tests/lib/extract/extract.test.ts b/tests/lib/extract/extract.test.ts
index fdc9070..317c7b1 100644
--- a/tests/lib/extract/extract.test.ts
+++ b/tests/lib/extract/extract.test.ts
@@ -8,7 +8,6 @@ function options(overrides: Partial<ExtractOptions> = {}): ExtractOptions {
     rankOf: (w) => ranks[w],
     knownLemmas: new Set(),
     existingLemmas: new Set(),
-    isAcademic: () => false,
     inDictionary: () => true,
     ...overrides,
   };
@@ -86,21 +85,17 @@ describe('extractCandidates', () => {
     expect(lemmas(['Thanks to Łukasz and Gödel, results.'])).toEqual(['result', 'thank']);
   });
 
-  it('keeps academic words ranked between 2,001 and N', () => {
-    const ranks: Record<string, number> = { hence: 3500, area: 400 };
-    const opts = options({
-      rankOf: (w) => ranks[w],
-      isAcademic: (l) => l === 'hence' || l === 'area',
-    });
-    const result = lemmas(['Hence the area grows.'], opts);
-    expect(result).toContain('hence');
-    expect(result).not.toContain('area'); // 상위 2,000 안의 학술어는 쉬우므로 그대로 거른다
+  it('drops every word ranked within N and keeps the ones ranked after it', () => {
+    // 학술어 예외는 없다(M5). 기준 N이 곧 경계다.
+    const rankOf = (w: string) => ({ the: 1, hence: 3687, area: 400 })[w];
+    expect(lemmas(['Hence the area grows.'], options({ rankOf, excludeTopN: 3000 }))).toEqual(['grow', 'hence']);
+    expect(lemmas(['Hence the area grows.'], options({ rankOf, excludeTopN: 5000 }))).toEqual(['grow']);
   });
 
-  it('still drops known lemmas even when they are academic', () => {
+  it('drops known lemmas even when they rank after N', () => {
     const opts = options({
-      rankOf: (w) => ({ hence: 3500 })[w],
-      isAcademic: () => true,
+      rankOf: (w) => ({ hence: 3687 })[w],
+      excludeTopN: 3000,
       knownLemmas: new Set(['hence']),
     });
     expect(lemmas(['Hence it grows.'], opts)).not.toContain('hence');
@@ -129,10 +124,10 @@ describe('extractCandidates', () => {
   });
 
   it('keeps a frequency-list word whose s-less form is not a word', () => {
-    // whereas는 WordNet에 없지만 빈도표에 있고 wherea는 없다. 학술어 예외도 whereas로 받아야 한다.
+    // whereas는 WordNet에 없지만 빈도표에 있고 wherea는 없다. 순위도 whereas로 찾아야 한다.
     const opts = options({
-      rankOf: (w) => ({ whereas: 4647 })[w],
-      isAcademic: (l) => l === 'whereas',
+      rankOf: (w) => ({ whereas: 3524 })[w],
+      excludeTopN: 3000,
       inDictionary: () => false,
     });
     expect(lemmas(['The first grows, whereas the second shrinks.'], opts)).toContain('whereas');
diff --git a/tests/server/ingest.test.ts b/tests/server/ingest.test.ts
index 56bc160..e45a655 100644
--- a/tests/server/ingest.test.ts
+++ b/tests/server/ingest.test.ts
@@ -9,7 +9,6 @@ import {
   MAX_PDF_BYTES,
   UploadError,
 } from '@/server/services/ingest';
-import { hasAcademicList } from '@/lib/extract/academic';
 import { makePdf } from '../helpers/make-pdf';
 
 // 실제 빈도표(data/frequency.json)를 쓴다. heterogeneous·perturbation은 상위 5,000 밖이다.
@@ -42,7 +41,7 @@ describe('ingestPdf', () => {
     expect(lemmas).not.toContain('paper');
   });
 
-  it('applies the real word lists: academic rescue, dictionary flag, line-end compounds', async () => {
+  it('applies the real word lists: frequency cutoff, dictionary flag, line-end compounds', async () => {
     const pdf = makePdf([
       [
         ...PAPER,
@@ -55,8 +54,7 @@ describe('ingestPdf', () => {
     ]);
     const result = await ingestPdf(db, input(pdf));
     const byLemma = new Map(listCandidates(db, result.documentId).map((c) => [c.lemma, c]));
-    // 순위 4567, AWL 대표어: data/awl.json이 있을 때만 학술어 예외로 남는다(N=5000)
-    expect(byLemma.has('hence')).toBe(hasAcademicList());
+    expect(byLemma.has('hence')).toBe(true); // wordfreq 순위 3,687, 기본 기준 N=3,000 밖
     expect(byLemma.get('conv')?.inDictionary).toBe(false);
     expect(byLemma.get('heterogeneous')?.inDictionary).toBe(true);
     expect(byLemma.has('finetuning')).toBe(false);
diff --git a/tests/server/repo.test.ts b/tests/server/repo.test.ts
index 56bbc2f..5efe7ad 100644
--- a/tests/server/repo.test.ts
+++ b/tests/server/repo.test.ts
@@ -108,7 +108,7 @@ describe('settings repo', () => {
         { key: 'auto_speak', value: 'yes' },
       ])
       .run();
-    expect(getSettings(db)).toEqual({ excludeTopN: 5000, dailyNewLimit: 0, autoSpeak: false });
+    expect(getSettings(db)).toEqual({ excludeTopN: 3000, dailyNewLimit: 0, autoSpeak: false });
   });
 
   it('saves all settings and overwrites earlier values', () => {
```

`tests/lib/extract/word-lists.test.ts`를 아래로 바꾼다(`isAcademic` describe와 import를 지움).

```ts
import { describe, expect, it } from 'vitest';
import { inDictionary } from '@/lib/extract/dictionary';

describe('inDictionary', () => {
  it('accepts English words and rejects abbreviations and symbols', () => {
    expect(inDictionary('residual')).toBe(true);
    expect(inDictionary('heterogeneous')).toBe(true);
    expect(inDictionary('conv')).toBe(false);
    expect(inDictionary('dmodel')).toBe(false);
  });

  it('ignores object prototype keys', () => {
    expect(inDictionary('hasOwnProperty')).toBe(false);
    expect(inDictionary('__proto__')).toBe(false);
    expect(inDictionary('constructor')).toBe(true); // WordNet에 실제로 있는 단어
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/lib/extract tests/server/ingest.test.ts tests/server/repo.test.ts`
Expected(PM이 확인함): 로컬에 `data/awl.json`이 있으면 3개, 없으면 4개 실패한다.
- `extract.test.ts` "drops words ranked within the top N and keeps rarer or unranked words": 옵션에 `isAcademic`이 없어 오류. 기존 테스트이며 고치지 않았다.
- `extract.test.ts` "drops every word ranked within N and keeps the ones ranked after it": 같은 이유
- `repo.test.ts` "accepts a daily new limit of 0 …": 기본값이 아직 5000
- (`data/awl.json`이 없을 때만) `ingest.test.ts` "applies the real word lists …": hence가 N=5000에 걸려 빠진다. 파일이 있으면 AWL 예외로 남아 통과한다.

`word-lists.test.ts`는 아직 `academic.ts`가 있으므로 통과한다.

- [ ] **Step 3: 구현**

```diff
diff --git a/src/app/settings/settings-form.tsx b/src/app/settings/settings-form.tsx
index d5ae876..12c2634 100644
--- a/src/app/settings/settings-form.tsx
+++ b/src/app/settings/settings-form.tsx
@@ -155,7 +155,7 @@ export function SettingsForm({ initial }: { initial: Values }) {
   return (
     <form ref={form} noValidate onSubmit={submit}>
       <Group title="단어 추출">
-        <Row id="excludeTopN" name="흔한 단어 제외 기준" help="빈도 상위 N위 안의 단어는 후보에서 뺍니다. 학술 핵심어는 남깁니다.">
+        <Row id="excludeTopN" name="흔한 단어 제외 기준" help="빈도 상위 N위 안의 단어는 후보에서 뺍니다.">
           <NumberField
             id="excludeTopN"
             value={excludeTopN}
diff --git a/src/lib/extract/extract.ts b/src/lib/extract/extract.ts
index 45dbade..6e54665 100644
--- a/src/lib/extract/extract.ts
+++ b/src/lib/extract/extract.ts
@@ -15,7 +15,6 @@ export interface ExtractOptions {
   rankOf: RankOf;
   knownLemmas: ReadonlySet<string>;
   existingLemmas: ReadonlySet<string>;
-  isAcademic: (lemma: string) => boolean;
   inDictionary: (lemma: string) => boolean;
 }
 
@@ -24,8 +23,6 @@ const NON_ASCII = /[^\x00-\x7F]/;
 const COMBINING_MARKS = /\p{M}/gu;
 const MIN_LENGTH = 3;
 const MAX_SENTENCE_LENGTH = 300;
-// 학술 핵심어 예외는 상위 2,000위 밖에만 적용한다. 그 안의 AWL 단어(area, data, code)는 쉽다.
-const ACADEMIC_RESCUE_MIN_RANK = 2001;
 
 interface Tally {
   lemma: string;
@@ -44,8 +41,7 @@ function bestRank(words: string[], rankOf: RankOf): number | undefined {
 function isExcludedByRank(lower: string, lemma: string, opts: ExtractOptions): boolean {
   // 표면형도 본다: data → datum처럼 원형이 드문 흔한 단어를 거른다.
   const rank = bestRank([lower, lemma], opts.rankOf);
-  if (rank === undefined || rank > opts.excludeTopN) return false;
-  return !(rank >= ACADEMIC_RESCUE_MIN_RANK && opts.isAcademic(lemma));
+  return rank !== undefined && rank <= opts.excludeTopN;
 }
 
 // 300자를 넘으면 단어가 보이도록 단어 주변을 잘라 정확히 300자로 맞춘다.
diff --git a/src/lib/settings.ts b/src/lib/settings.ts
index a44fdee..11ed97e 100644
--- a/src/lib/settings.ts
+++ b/src/lib/settings.ts
@@ -1,5 +1,5 @@
 // 설정 화면 입력 검사. 서버 Action과 테스트가 쓴다(설계서 M4-2 3장).
-export const EXCLUDE_TOP_N_RANGE = { min: 1000, max: 20000 } as const; // 위 한계는 빈도 목록 길이(20,349단어)에 맞춘다
+export const EXCLUDE_TOP_N_RANGE = { min: 1000, max: 20000 } as const; // 위 한계는 빈도 목록 길이(wordfreq 20,000단어)에 맞춘다
 export const DAILY_NEW_LIMIT_RANGE = { min: 0, max: 200 } as const; // 0이면 새 카드 없이 복습만
 
 export const THEMES = ['system', 'light', 'dark'] as const;
diff --git a/src/server/repo/settings.ts b/src/server/repo/settings.ts
index 6563a1d..0894371 100644
--- a/src/server/repo/settings.ts
+++ b/src/server/repo/settings.ts
@@ -9,7 +9,7 @@ export interface Settings {
   autoSpeak: boolean;
 }
 
-export const DEFAULT_SETTINGS: Settings = { excludeTopN: 5000, dailyNewLimit: 20, autoSpeak: false };
+export const DEFAULT_SETTINGS: Settings = { excludeTopN: 3000, dailyNewLimit: 20, autoSpeak: false };
 
 const KEYS: Record<keyof Settings, string> = {
   excludeTopN: 'exclude_top_n',
diff --git a/src/server/services/ingest.ts b/src/server/services/ingest.ts
index cdbc5a3..689ffad 100644
--- a/src/server/services/ingest.ts
+++ b/src/server/services/ingest.ts
@@ -1,4 +1,3 @@
-import { isAcademic } from '@/lib/extract/academic';
 import { inDictionary, isRealWord } from '@/lib/extract/dictionary';
 import { extractCandidates } from '@/lib/extract/extract';
 import { isFrequentWord, rankOf } from '@/lib/extract/frequency';
@@ -61,7 +60,6 @@ export async function ingestPdf(db: Db, input: IngestInput): Promise<IngestResul
       rankOf,
       knownLemmas: listKnownLemmas(db),
       existingLemmas: listWordLemmas(db),
-      isAcademic,
       inDictionary,
     });
     replaceCandidates(db, doc.id, found);
```

```bash
git rm src/lib/extract/academic.ts
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run`, `npm run typecheck`
Expected: 189 통과, 건너뜀 0. 타입 오류 없음. `grep -rn "isAcademic\|academic" src tests`는 아무것도 찾지 않는다.

- [ ] **Step 5: 커밋**

```bash
git add -A src tests
git commit -m "feat: drop the academic word exception and lower the default cutoff to 3,000"
```

---

### Task 3: 사전 API 제거, 발음기호는 CMUdict만

**Files:**
- Delete: `src/lib/phonetic/lookup.ts`, `tests/lib/phonetic/lookup.test.ts`, `tests/lib/phonetic/breaker.test.ts`
- Modify: `src/lib/phonetic/cmudict.ts`(전체 교체), `src/server/services/enrich.ts`
- Test: `tests/lib/phonetic/cmudict.test.ts`(전체 교체)

- [ ] **Step 1: 실패하는 테스트**

`tests/lib/phonetic/cmudict.test.ts`를 아래로 바꾼다. 맨 아래 `withCmudictFirst` 묶음이 `createCmudictPhonetic` 묶음으로 바뀐다.

```ts
import { describe, expect, it, vi } from 'vitest';
import { arpabetToIpa } from '@/lib/phonetic/arpabet';
import { cmudictLookup, createCmudict, createCmudictPhonetic } from '@/lib/phonetic/cmudict';

describe('arpabetToIpa', () => {
  it('converts phones and marks stress before the onset consonant', () => {
    expect(arpabetToIpa('R OW0 B AH1 S T')).toBe('/roʊˈbʌst/');
    expect(arpabetToIpa('P EH1 R AH0 D AY2 M')).toBe('/ˈpɛrəˌdaɪm/');
    expect(arpabetToIpa('R IH0 Z IH1 JH UW0 AH0 L')).toBe('/rɪˈzɪdʒuəl/');
  });

  it('puts the stress mark before the longest allowed onset cluster', () => {
    expect(arpabetToIpa('AE0 B S T R AE1 K T')).toBe('/æbˈstrækt/'); // abstract
    expect(arpabetToIpa('AH0 P R OW1 CH')).toBe('/əˈproʊtʃ/'); // approach
    expect(arpabetToIpa('K AH0 N T R OW1 L')).toBe('/kənˈtroʊl/'); // control
  });

  it('uses schwa and r-colored schwa for unstressed AH and ER', () => {
    expect(arpabetToIpa('HH EH2 T ER0 AH0 JH IY1 N Y AH0 S')).toBe('/ˌhɛtɚəˈdʒinjəs/');
  });

  it('omits stress marks for one-vowel words', () => {
    expect(arpabetToIpa('DH AH0')).toBe('/ðə/');
    expect(arpabetToIpa('S T R EH1 NG K TH')).toBe('/strɛŋkθ/');
  });

  it('returns null for unknown symbols', () => {
    expect(arpabetToIpa('XX AH1')).toBeNull();
    expect(arpabetToIpa('B1 AH1')).toBeNull();
  });
});

describe('createCmudict', () => {
  const lookup = createCmudict('read R EH1 D\nread R IY1 D\nrobust R OW0 B AH1 S T\n');

  it('looks up words case-insensitively and keeps the first pronunciation', () => {
    expect(lookup('Robust')).toBe('/roʊˈbʌst/');
    expect(lookup('read')).toBe('/rɛd/');
    expect(lookup('missing')).toBeNull();
  });
});

describe('cmudictLookup', () => {
  it('reads the bundled data file', () => {
    expect(cmudictLookup('residual')).toBe('/rɪˈzɪdʒuəl/');
    expect(cmudictLookup('constructor')).not.toBeNull();
    expect(cmudictLookup('dmodel')).toBeNull();
  });
});

describe('createCmudictPhonetic', () => {
  it('returns the CMUdict pronunciation, or null when CMUdict has none', async () => {
    const lookup = createCmudictPhonetic((w) => (w === 'robust' ? '/roʊˈbʌst/' : null));
    expect(await lookup('robust')).toBe('/roʊˈbʌst/');
    expect(await lookup('softmax')).toBeNull();
  });

  it('returns null and logs once when CMUdict itself fails', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const lookup = createCmudictPhonetic(() => {
      throw new Error('cmudict.txt not found');
    });
    expect(await lookup('robust')).toBeNull();
    expect(await lookup('paradigm')).toBeNull();
    expect(errors).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });
});
```

Run: `npx vitest run tests/lib/phonetic/cmudict.test.ts`
Expected: `createCmudictPhonetic`이 없어 실패한다.

- [ ] **Step 2: 구현**

`src/lib/phonetic/cmudict.ts`(전체 교체):

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

// 발음기호는 CMUdict(미국식, 발음 듣기 en-US와 같은 표기)에서만 찾는다. 조회가 실패해도(파일 없음 등)
// 저장 전체를 오류로 만들지 않고 발음기호 없이 둔다. 로그는 한 번만 남긴다.
// (2026-10-16 M5: 사전 API dictionaryapi.dev는 이용 조건이 밝혀져 있지 않고, 실측에서 CMUdict에 없는 단어를
// 채운 적이 없어 뺐다.)
export function createCmudictPhonetic(
  primary: PhoneticSource = cmudictLookup,
): (word: string) => Promise<string | null> {
  let logged = false;
  return async (word) => {
    try {
      return primary(word);
    } catch (err) {
      if (!logged) console.error('CMUdict 발음기호 조회 실패', err);
      logged = true;
      return null;
    }
  };
}
```

```diff
diff --git a/src/server/services/enrich.ts b/src/server/services/enrich.ts
index 428a932..4726c28 100644
--- a/src/server/services/enrich.ts
+++ b/src/server/services/enrich.ts
@@ -1,8 +1,7 @@
 import { mapWithConcurrency } from '@/lib/async/pool';
 import { createGeminiMeaningModel } from '@/lib/meaning/gemini';
 import { generateMeanings, type MeaningModel } from '@/lib/meaning/generate';
-import { withCmudictFirst } from '@/lib/phonetic/cmudict';
-import { createPhoneticLookup } from '@/lib/phonetic/lookup';
+import { createCmudictPhonetic } from '@/lib/phonetic/cmudict';
 import type { Db } from '../db/client';
 import {
   listMeaningRequests,
@@ -32,9 +31,8 @@ export function defaultMeaningModel(): MeaningModel | null {
 export function defaultEnrichDeps(): EnrichDeps {
   return {
     meaningModel: defaultMeaningModel(),
-    // CMUdict를 먼저 쓰고, 없는 단어만 사전 API로 찾는다. API는 저장마다 새 차단기를 쓴다
-    // (사전 API가 죽어 있으면 연속 5번 실패 후 나머지 조회를 건너뛴다).
-    lookupPhonetic: withCmudictFirst(createPhoneticLookup()),
+    // 발음기호는 CMUdict에서만 찾는다(네트워크 없음).
+    lookupPhonetic: createCmudictPhonetic(),
   };
 }
 
```

```bash
git rm src/lib/phonetic/lookup.ts tests/lib/phonetic/lookup.test.ts tests/lib/phonetic/breaker.test.ts
```

- [ ] **Step 3: 통과 확인**

Run: `npx vitest run`, `npm run typecheck`, `npm run lint`
Expected:
- 28 files / 181 tests 통과, 건너뜀 0
- 오류 없음
- `grep -rn "dictionaryapi\|withCmudictFirst\|createPhoneticLookup" src tests`는 `cmudict.ts`의 설명 주석 한 줄만 찾는다.

- [ ] **Step 4: 커밋**

```bash
git add -A src tests
git commit -m "feat: look up phonetics in CMUdict only and drop the dictionary API"
```

---

### Task 4: 추출 결과 확인, 변경 기록, PR

- [ ] **Step 1: 논문 3편 후보 비교** (PM 실측과 같아야 한다)

저장소 루트에 `dump.tmp.mts`를 만든다(커밋하지 않음).

```ts
// 확인용(커밋하지 않음): 논문 PDF 3편의 후보를 빈 단어장, 기본 기준 N으로 뽑아 JSON으로 쓴다.
import { readFileSync, writeFileSync } from 'node:fs';
import { inDictionary, isRealWord } from '@/lib/extract/dictionary';
import { extractCandidates } from '@/lib/extract/extract';
import { isFrequentWord, rankOf } from '@/lib/extract/frequency';
import { parsePdf } from '@/lib/pdf/parse';
import { DEFAULT_SETTINGS } from '@/server/repo/settings';

const [pdfDir, outFile] = process.argv.slice(2);
const result: Record<string, { lemma: string; surface: string; count: number }[]> = {};
for (const name of ['resnet', 'attention', 'bert']) {
  const bytes = new Uint8Array(readFileSync(`${pdfDir}/${name}.pdf`));
  const sentences = await parsePdf(bytes, { isKnownWord: isFrequentWord, isRealWord });
  result[name] = extractCandidates(sentences, {
    excludeTopN: DEFAULT_SETTINGS.excludeTopN,
    rankOf,
    knownLemmas: new Set(),
    existingLemmas: new Set(),
    inDictionary,
  }).map((c) => ({ lemma: c.lemma, surface: c.surface, count: c.count }));
}
writeFileSync(outFile, JSON.stringify(result, null, 1));
console.log(Object.entries(result).map(([k, v]) => `${k}: ${v.length}`).join(', '));
```

PDF와 PM 실측 결과는 PM 작업 폴더 `C:\Users\iwtkm\AppData\Local\Temp\claude\C--Users-iwtkm-workspace-slave-voca\d44d2645-12b6-43b3-abd5-0818f7c137c2\scratchpad`에 있다.
- PDF: `pdfs\`
- 실측 결과: `lic\cand-wfN3000.json`

Run:
```bash
npx tsx dump.tmp.mts "<PM 작업 폴더>/pdfs" m5-after.tmp.json
```
Expected: `resnet: 267, attention: 278, bert: 255`

```bash
python -c "import json,sys;a,b=(json.load(open(f,encoding='utf8')) for f in sys.argv[1:]);print('SAME' if a==b else 'DIFF')" m5-after.tmp.json "<PM 작업 폴더>/lic/cand-wfN3000.json"
```
Expected: `SAME`. 확인한 뒤 두 tmp 파일을 지운다.

- [ ] **Step 2: 브라우저 확인** (빈 DB, `next start -p 3300`, 헤드리스 Edge)

1. 설정 화면의 "흔한 단어 제외 기준" 값이 3000이고, 도움말이 "빈도 상위 N위 안의 단어는 후보에서 뺍니다."인지 본다.
2. attention.pdf를 올려 검토 화면 후보 수를 본다(278, 기본 체크 기준은 지금과 같음).
3. 몇 개를 저장한다. CMUdict에 있는 단어(예: robust)는 발음기호가 채워지고, 없는 단어(예: softmax)는 비고, 오류는 없는지 본다.

실제 Gemini 호출을 피하려면 `GEMINI_API_KEY` 없이 띄운다. 뜻은 "실패"로 남는 것이 정상이다.

- [ ] **Step 3: 변경 기록**

`CHANGELOG.md`의 `## [Unreleased]` 아래에 넣는다.

```markdown
### 바뀜
- 빈도표를 wordfreq(CC BY-SA 4.0)로 바꿨다. 상업적으로 쓸 수 있고, 출처는 `data/frequency-NOTICE.md`에 있다.
- 흔한 단어 제외 기준(N)의 기본값을 5,000에서 3,000으로 낮췄다. 학술 핵심어 예외 없이도 hence, whereas, respectively 등이 후보로 남는다.

### 없앰
- 학술 핵심어 예외(AWL, `data/awl.json`). 이용 조건이 밝혀져 있지 않다.
- 발음기호 보조용 사전 API(dictionaryapi.dev). 이제 CMUdict만 쓰고, 저장할 때 네트워크 요청이 없다.

### 업그레이드 시 주의
- 이미 저장된 후보·카드는 그대로다. 새로 올리는 문서부터 적용된다.
- 설정에서 N을 저장해 둔 경우 그 값이 그대로 쓰인다. 새 기본값을 쓰려면 설정에서 3000으로 바꾼다.
- 처음 몇 편은 후보가 15% 안팎 늘고 쉬운 기술어(accuracy, algorithm 등)가 섞인다. "안다"로 정리하면 다음 문서부터 빠진다.
```

```bash
git add CHANGELOG.md
git commit -m "docs: record M5 in the changelog"
```

- [ ] **Step 4: PR, CI, 리뷰, 병합**

```bash
git push -u origin feat/m5-data-license
gh pr create --base development --title "feat: M5 commercial-safe data (wordfreq, N=3000, no AWL, no dictionary API)" --body-file <본문>
gh pr checks --watch
```

본문에 넣을 것:
- 설계서·계획서 경로
- 바뀌는 것 4가지
- 확인 결과(테스트 181, 빌드 표, Step 1 SAME과 편당 후보 수, Step 2 결과)

Codex 리뷰에 Review Focus 1~5를 보낸다. 지적이 없거나 고친 뒤 요약을 PR 댓글로 남긴다. 그다음 병합한다.

```bash
gh pr merge --merge --delete-branch
```

PM에게 보낼 것:
- PR 링크, CI 링크, 병합 커밋 해시
- 테스트 수
- Step 1 결과(편당 후보 수, SAME)
- Step 2 결과
- 리뷰 요약
