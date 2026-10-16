# C-1: 사용량·비용·알림 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gemini로 뜻을 만드는 모든 요청을 기록하고, 사용자별 월 단어 한도와 서비스 전체 월 비용 상한으로 막는다.
- 한도에 걸리면 Designer 규칙대로 알리고, 관리자에게는 사용량과 비용을 보여 준다.
- 가입 신청, 한도 도달, 비용 80%·100%, 서버 오류를 웹훅으로 알린다.

**Architecture:**
- **기록:** 새 표 `meaning_usage`에 요청 한 번마다 한 줄을 쓴다.
  - Gemini를 부르기 전에 한도를 확인하고, 예상 비용으로 맡아 둔다.
  - 끝나면 응답의 실제 토큰으로 정산한다.
- **토큰 전달:** 모델 함수(`MeaningModel`)가 응답마다 `onUsage`로 토큰을 알린다.
- **검토 저장:** 카드 저장과 맡아 두기를 한 트랜잭션에서 한다. 한도에 걸리면 저장까지 되돌린다.
- **알림:** `src/server/alerts/notify.ts` 하나로 보낸다.
  - 한 달에 한 번만 보낼 알림은 `alert_log` 표에 기록한다.
  - 서버 오류는 메모리에서 10분에 한 번으로 거른다.

**Tech Stack:** 기존 스택 그대로(새 의존성 없음). Next `instrumentation.ts`의 `onRequestError`(번들 문서 `01-app/03-api-reference/03-file-conventions/instrumentation.md`)

**Spec:**
- `docs/superpowers/specs/2026-10-17-c-deploy-foundation-design.md` 3장
- Designer 화면 규칙 `docs/superpowers/specs/2026-10-17-c-screens.md` 1부(1~5장), 목업 `docs/superpowers/mockups/c-mobile-usage.html`

## Global Constraints

- **브랜치:** 최신 `origin/development`(b372eeb 이후)에서 `feat/c1-usage-limits`를 딴다. PR은 **`--base development`**로 열고, 태스크마다 커밋한다.
- **리뷰:** Orca의 Codex 터미널에 맡긴다. Important 이상은 테스트를 먼저 써서 고친다. 요약은 PR 댓글로 남긴다. development 병합은 묻지 않는다.
- **릴리스(v0.7.0)는 이 계획에 없다.** C-3, C-2까지 끝난 뒤 PM이 한다.
- **커밋하지 않는 것:** 비밀값, `.env.local`, 확인용 DB, 로그
- **포트:** 3300. 헤드리스 확인용 서버는 `.env.local`과 다른 DB(`SLAVE_VOCA_DB`)를 쓴다.
- **실제 Gemini 호출:** 태스크 6에서만 몇 번 한다. 비용은 1센트 미만이다.
- **PM 프로토타입에서 확인한 것:** 패치 `2026-10-17-c1-usage-limits.patch`(이 파일 옆)
  - 각 태스크의 `--include` 범위로 차례로 적용했고, 단계마다 typecheck 오류 0, lint 0이었다.
  - 테스트 수는 아래 기대값과 같다.
  - 마지막 트리는 프로토타입과 같다(`git write-tree` f1e70a0).
  - 빌드에서 라우트 표시는 그대로다(◐ 유지, `/_not-found` ○).
- **패치 적용:** 저장소 루트에서 아래처럼 한다. 경로의 `[id]`는 `--include`에서 `[[]id]`로 쓴다(glob 문자 이스케이프).

  ```bash
  git apply --include=<경로> … docs/superpowers/plans/2026-10-17-c1-usage-limits.patch
  ```

- **패치 읽기:** 적용 전에 그 태스크 부분을 읽고 이해한 뒤 적용한다. 패치와 다르게 고치고 싶으면 PM에게 먼저 묻는다. 리뷰 반영으로 고치는 것은 괜찮다.
- **문구:** Designer 규칙 2장 그대로다(`LIMIT_SAVE`·`LIMIT_REGEN`·`LIMIT_CARD`·`LIMIT_SLOT`).
- **사용자에게 사용량·남은 양을 보이지 않는다**(사용자 결정). 사용량은 관리 화면에서만 보인다.

## Review Focus

1. **한도에 걸린 검토 저장은 아무것도 바꾸지 않아야 한다:** 카드, 용례, 아는 단어, 문서 상태, 후보, 사용량 기록 모두 그대로다. 저장소 함수 `saveReviewSelection`과 맡아 두기가 한 트랜잭션이라 되돌려진다. 테스트: `usage.test.ts` "changes nothing when the save would pass the limit"
2. **재시도는 단어를 다시 세지 않지만 비용은 모두 센다.** 503 뒤 재시도한 묶음은 `words` 1, 토큰 2회분이다. 테스트: "counts a retried batch once but bills every response"
3. **남의 id로 다시 만들기를 불러도 사용량이 생기지 않는다**(`listMeaningRequests`가 거른 뒤 센다). 테스트: "does not count ids that belong to someone else"
4. **한 달 경계는 한국 시간이다.** 서버 시간대(UTC on Fly)와 상관없다. 테스트: `limits.test.ts`의 10/31 14:59:59Z ↔ 15:00Z
5. **알림 실패·웹훅 오설정이 앱을 막지 않는다.** fetch 예외, 비 Discord·Slack 주소, http 주소, 5초 시간 제한을 확인한다. 알림에 문장·뜻·비밀값이 들어가지 않는다. 테스트: `alerts.test.ts`

---

### Task 1: 모델 응답의 토큰 전달

**Files:**
- Modify: `src/lib/meaning/generate.ts`
- Modify: `src/lib/meaning/gemini.ts`
- Test: `tests/lib/meaning/gemini.test.ts`

**Interfaces:**
- Produces:
  - `TokenUsage { inputTokens: number; outputTokens: number }`
  - `MeaningModel = (batch, onUsage?: (u: TokenUsage) => void) => Promise<MeaningResult[]>`
  - `RetryOptions.onUsage`
  - `tokenUsage(usageMetadata)`(gemini.ts, 사고 토큰은 출력에 더한다)
- 기존 가짜 모델(인자 하나)은 그대로 쓸 수 있다.

**내용:**
- `requestWithRetry`가 재시도마다 `model(batch, onUsage)`를 부른다.
- Gemini 모델은 응답을 받자마자, 그리고 형식 검사(빈 응답, 낱자모 깨짐)로 예외를 던지기 **전에** `onUsage`를 부른다. 받은 응답은 모두 과금되기 때문이다.

- [ ] **Step 1:** 테스트 부분을 적용하고 실패를 확인한다.

  ```bash
  git apply --include=tests/lib/meaning/gemini.test.ts docs/superpowers/plans/2026-10-17-c1-usage-limits.patch
  npx vitest run tests/lib/meaning/gemini.test.ts
  ```

  Expected: FAIL(`tokenUsage`를 가져올 수 없다)

- [ ] **Step 2:** 구현을 적용한다.

  ```bash
  git apply --include=src/lib/meaning/generate.ts --include=src/lib/meaning/gemini.ts docs/superpowers/plans/2026-10-17-c1-usage-limits.patch
  ```

- [ ] **Step 3:** 확인한다.

  ```bash
  npx vitest run && npm run typecheck && npm run lint
  ```

  Expected: Tests **224 passed**, 타입·lint 오류 0

- [ ] **Step 4:** 커밋한다. 메시지: `feat(c1): report Gemini token usage per response`

### Task 2: 한도 계산, 사용량 표, 맡아 두기

**Files:**
- Create:
  - `src/lib/usage/limits.ts`
  - `src/server/repo/usage.ts`
  - `src/server/alerts/notify.ts`
  - `src/server/services/meaning-usage.ts`
  - `drizzle/0007_usage.sql`, `drizzle/meta/0007_snapshot.json`
  - `tests/lib/usage/limits.test.ts`
- Modify:
  - `src/server/db/schema.ts`(`meaningUsage`, `alertLog`, `USAGE_SOURCES`)
  - `drizzle/meta/_journal.json`
  - `src/lib/regen-messages.ts`(한도 문구 4개)
  - `tests/server/per-user-migration.test.ts`

**Interfaces:**
- Produces:
  - `readUsageLimits(env)` → `{ monthlyWords, monthlyBudgetUsd }`(기본 4000, 5. 비었거나 음수이거나 숫자가 아니면 기본값)
  - `costUsd(TokenUsage)`, `kstMonthRange(now)` → `{ start, end, key: "2026-10" }`, `resetsOnLabel(now)` → `"11월 1일"`
  - `reserveUsage(db, userId, source, words, now, limits)` → `{ ok: true, id } | { ok: false, reason: 'user-limit' | 'budget' }`
  - `settleUsage`, `monthlyWordsOf`, `monthlySpendUsd`, `monthlyWordsByUser`, `claimAlert(db, key)` → 처음만 true
  - `reserveMeaningUsage(db, userId, source, words, { now?, limits? })` → `UsageMeter { onUsage, finish }`. 걸리면 `UsageLimitError { reason, resetsOn }`를 던진다.
  - `reportUsageLimit(db, userId, err, ctx)`: 트랜잭션 **밖에서** 부른다. 알림 "보냈음" 기록이 되돌려지지 않게 하려는 것이다.
  - `notify(text, env?, fetcher?)`, `webhookBody(url, text)`, `notifyServerError(where, err)`, `shouldSendThrottled`
  - `LIMIT_SAVE(d)`, `LIMIT_REGEN(d)`, `LIMIT_CARD(d)`, `LIMIT_SLOT`

**내용:**
- **단가:** 입력 $0.30, 출력 $2.50 / 100만 토큰. 2026-10-17 공식 요금표로 확인했다.
- **예상 비용:** 단어당 $0.0001이다.
  - PM 실측: 3단어 저장이 입력 484, 출력 92토큰, $0.000375였다(작은 요청은 지시문 몫이 커서 단어당 비용이 높다).
  - 논문 한 편 규모(50개 묶음)에서는 단어당 약 $0.000064다.
- **마이그레이션 0007:** 새 표 둘만 만든다. `meaning_usage.user_id`는 `ON DELETE SET NULL`이다(사용자를 지워도 비용은 남는다). `drizzle-kit generate`로 만든 것과 같다.
- **마이그레이션 테스트:** `per-user-migration.test.ts`는 지금 "0006만 빼고" 먼저 적용한다. 그러면 0007이 먼저 적용되고, drizzle은 그보다 오래된 0006을 건너뛴다. 그래서 **0006부터 뒤를 모두 빼도록** 고친다. 이걸 안 고치면 3개가 실패한다.
- **알림:** `meaning-usage.ts`가 비용 80%·100% 알림(`budget-80:2026-10`, `budget-100:2026-10`)과 한도 알림을 보낸다.
  - 한도 알림은 개인 `user-limit:<id>:<월>`, 전체 `budget-blocked:<월>`이다.
  - 모두 `void notify(...)`로 기다리지 않는다.

- [ ] **Step 1:** 테스트를 적용하고 실패를 확인한다.

  ```bash
  git apply --include=tests/lib/usage/limits.test.ts docs/superpowers/plans/2026-10-17-c1-usage-limits.patch
  npx vitest run tests/lib/usage
  ```

  Expected: FAIL(모듈 없음)

- [ ] **Step 2:** 나머지를 적용한다.

  ```bash
  git apply --include=src/lib/usage/limits.ts --include=src/server/db/schema.ts --include='drizzle/*' --include='drizzle/meta/*' \
    --include=tests/server/per-user-migration.test.ts --include=src/server/repo/usage.ts --include=src/server/alerts/notify.ts \
    --include=src/server/services/meaning-usage.ts --include=src/lib/regen-messages.ts docs/superpowers/plans/2026-10-17-c1-usage-limits.patch
  ```

- [ ] **Step 3:** `npx drizzle-kit generate --name usage`를 실행한다.

  Expected: "No schema changes"(패치의 0007이 스키마와 맞는다)

- [ ] **Step 4:** 확인한다.

  ```bash
  npx vitest run && npm run typecheck && npm run lint
  ```

  Expected: Tests **230 passed**

- [ ] **Step 5:** 커밋한다. 메시지: `feat(c1): meaning_usage table, monthly limits and reservation`

### Task 3: 세 입구에 한도 연결

**Files:**
- Create:
  - `src/server/services/save-review.ts`
  - `tests/server/usage.test.ts`
- Modify:
  - `src/server/services/enrich.ts`
  - `src/server/services/usage-meaning.ts`
  - `src/app/(app)/documents/[id]/actions.ts`
  - `src/app/(app)/documents/[id]/review/actions.ts`

**Interfaces:**
- Consumes: Task 2의 `reserveMeaningUsage`, `reportUsageLimit`, `UsageLimitError`
- Produces:
  - `saveReviewAndEnrich(db, userId, documentId, ids, deps)` → `{ error: string | null; limitResetsOn?: string }`
  - `regenerateMeanings(db, userId, ids, model, source = 'regenerate')` → `… | { error: 'usage-limit'; resetsOn }`
  - `enrichDocument(…, meter = null)`
  - **화면이 받는 값:**
    - Action `saveReview` → `{ error, limitResetsOn? }`
    - `regenerateDocumentMeanings` → `{ error, limitResetsOn? } | { error: null, done, failed }`
    - `/api/usage-meaning` → `{ error, limitResetsOn? } | …`
    - **`limitResetsOn`이 있으면 한도다.**

**내용:**
- **검토 저장:** `db.transaction(() => { saveReviewSelection(...); reserveMeaningUsage(..., 저장된 용례 수) })`
  - better-sqlite3는 중첩 트랜잭션을 savepoint로 처리하므로 그대로 된다.
  - 키가 없거나 용례가 0개면 맡아 두지 않는다.
- **다시 만들기:** `listMeaningRequests`로 그 사용자의 용례만 거른 뒤, 그 수로 맡아 둔다. 카드 뒷면은 `source: 'card'`다.
- **정산:** 생성이 끝나면 성공이든 예외든 `finally`에서 `meter.finish()`로 정산한다.
- **알림:** 뜻 채우기가 예외로 끝나면 `notifyServerError('뜻·발음 채우기', …)`를 부른다.

- [ ] **Step 1:** `tests/server/usage.test.ts`를 적용하고 실패를 확인한다.

  Expected: FAIL(`save-review` 모듈 없음)

- [ ] **Step 2:** 구현 넷을 적용한다. 경로의 `[id]`는 `[[]id]`로 쓴다.

  ```bash
  git apply --include=src/server/services/enrich.ts --include=src/server/services/save-review.ts --include=src/server/services/usage-meaning.ts \
    --include='src/app/(app)/documents/[[]id]/actions.ts' --include='src/app/(app)/documents/[[]id]/review/actions.ts' \
    docs/superpowers/plans/2026-10-17-c1-usage-limits.patch
  ```

- [ ] **Step 3:** 확인한다.

  Expected: Tests **243 passed**, 타입·lint 0

- [ ] **Step 4:** 돌연변이 확인을 한다. `save-review.ts`에서 `reserveMeaningUsage(...)` 줄을 잠시 지우고 테스트를 돌린다.

  Expected: `usage.test.ts`에서 4개 실패. 확인한 뒤 되돌린다.

- [ ] **Step 5:** 커밋한다. 메시지: `feat(c1): enforce usage limits on save and regenerate`

### Task 4: 가입 신청·서버 오류 알림

**Files:**
- Create:
  - `src/instrumentation.ts`
  - `tests/server/alerts.test.ts`
- Modify:
  - `src/server/auth/auth.ts`(`databaseHooks.user.create.after`)
  - `tests/server/auth.test.ts`

**내용:**
- **가입 신청 알림:** `status === 'pending'`인 새 계정만 알린다. 관리자 이메일 가입은 알리지 않는다.
  - 문구: `가입 신청: 이름 (이메일)\n<BETTER_AUTH_URL>/admin`
- **`onRequestError`:**
  - Node 런타임에서만 동작한다.
  - digest가 `NEXT_`로 시작하는 redirect·notFound는 거른다.
  - 주소에서 검색어를 빼고 `METHOD 경로 · routeType`으로 보낸다.

- [ ] **Step 1:** 테스트 둘을 적용하고 실패를 확인한다.
- [ ] **Step 2:** 구현 둘을 적용한다.
- [ ] **Step 3:** 확인한다.

  Expected: Tests **250 passed**

- [ ] **Step 4:** 커밋한다. 메시지: `feat(c1): webhook alerts for sign-ups and server errors`

### Task 5: 화면(Designer 규칙 1부)

**Files:**
- Create: `src/app/(app)/admin/usage-cost.tsx`
- Modify:
  - `src/components/ui/status.tsx`(`Limited`)
  - `src/components/ui/regen-slot.tsx`(`phase: "limited"`)
  - `src/app/(app)/documents/[id]/retry-all-button.tsx`(→ `FailedMeaningsNotice`)
  - `src/app/(app)/documents/[id]/page.tsx`
  - `src/app/(app)/documents/[id]/word-table.tsx`
  - `src/app/(app)/documents/[id]/review/candidate-table.tsx`
  - `src/app/(app)/study/study-session.tsx`
  - `src/app/(app)/admin/page.tsx`
  - `src/app/(app)/admin/user-table.tsx`

**내용(규칙 절 번호):**
- **4.1 검토 저장:**
  - 한도면 도구 줄 아래 `Notice`로 `LIMIT_SAVE`를 보인다. 다른 오류는 `Failed`로 보인다(`text-again` 글자를 없앤다).
  - 저장을 다시 누르면 안내를 지운다.
- **4.2 문서 화면:**
  - 행 하나: 버튼 자리에 `Limited`로 `LIMIT_SLOT`을 보인다. 자리 높이를 `h-5`에서 `min-h-5`로 바꿔 두 줄이 들어가게 한다.
  - "모두 다시 시도": 안내 줄 아래 `Notice`로 `LIMIT_REGEN`을 보인다. 실패 결과는 `Failed`로 보인다.
  - 안내 줄 전체를 클라이언트 구성 요소 `FailedMeaningsNotice`로 옮긴다. `<p>`(Notice) 안에 `<p>`를 넣을 수 없기 때문이다.
- **4.3 복습 카드:** 출처 아래 한 줄에 `Limited`로 `LIMIT_CARD`를 보인다. 그동안 그 용례의 버튼 자리는 비운다.
- **5장 관리 화면:**
  - 폭 880px
  - 비용 칸: 정산 전 예상 비용 포함, 막대 색 accent/hard/again, `role="meter"`
  - "이번 달 단어" 열: 한도에 닿으면 hard 점과 "한도"
  - 표 아래 한도 한 줄
- **C-3으로 넘기는 것:** 복습 저장 실패의 `text-again`(Designer 요청)은 C-3 계획서에서 문구(7.6)와 함께 바꾼다.

- [ ] **Step 1:** 적용한다. `[id]`는 `[[]id]`로 쓴다. `admin/*`도 포함한다.
- [ ] **Step 2:** 확인한다.

  ```bash
  npm run typecheck && npm run lint && npx vitest run && npm run build
  ```

  Expected: 250 passed. 빌드 라우트 표는 지금과 같다(◐ 유지).

- [ ] **Step 3:** 커밋한다. 메시지: `feat(c1): limit notices and admin usage (Designer C rules part 1)`

### Task 6: 문서와 헤드리스 확인

**Files:**
- Modify: `README.md`, `.env.example`

**내용:**
- **README:** 맨 위 "로그인이 없는 1인용 로컬 앱" 경고를 지금 상태에 맞게 바꾼다.
- **"사용량 한도와 알림" 절:** 환경변수 3개와 알림 4종을 적는다.

- [ ] **Step 1:** 적용하고 커밋한다. 메시지: `docs(c1): usage limits and alert webhook`
- [ ] **Step 2:** 헤드리스 Edge로 확인한다.
  - **서버:** `npm run build` 후 아래 환경변수로 띄운다.
    - `BETTER_AUTH_URL=http://localhost:3300`, `AUTH_DEV_LOGIN=1`, `ADMIN_EMAILS=owner@example.com`
    - `SLAVE_VOCA_DB=<임시 폴더>/app.db`, `MONTHLY_WORD_LIMIT=5`, `ALERT_WEBHOOK_URL=`
    - 실행: `npx next start -p 3300`
  - **PM이 얻은 결과**(같아야 한다)

    | 순서 | 동작 | 기대 |
    |---|---|---|
    | 1 | owner로 개발 로그인 → resnet.pdf 올리기 → "보이는 행 모두" 두 번으로 전부 해제 → 체크박스 3개 클릭 → 저장 | 단어 목록으로 이동. `meaning_usage`에 save 3단어, settled 1 |
    | 2 | bert.pdf 올리기 → 기본 선택 그대로 저장 | 검토 화면에 머문다. `LIMIT_SAVE`("…11월 1일부터 저장할 수 있고…")가 Notice로 보인다. 체크 수가 그대로다(PM 164 → 164). `words` 수 3 그대로 |
    | 3 | 문서 1에서 행 1, 2, 3의 "뜻 다시 만들기" | 1·2는 "새 뜻으로 바꿨습니다", 3은 `LIMIT_SLOT`이 두 줄로 나온다. 뜻이 진하게 보인다 |
    | 4 | DB에서 용례 하나를 failed로 바꾸고 새로 고침 → "모두 다시 시도" | 안내 줄 아래 `LIMIT_REGEN` Notice |
    | 5 | /study → Space → "뜻 다시 만들기" | 출처 아래 `LIMIT_CARD` 한 줄. 그 용례의 버튼은 사라진다 |
    | 6 | /admin | 비용 칸 "$0.00 / $5.00 0% … 10월 1일부터 · 한국 시간…", owner 행 "● 5 한도", 표 아래 "한도: 사용자당 월 5단어 · 전체 월 $5.00" |

  - **서버 로그:** `[알림] owner (owner@example.com) 님이 이번 달 한도(5단어)에 닿았습니다.`가 **한 번만** 찍힌다. `alert_log`에는 `user-limit:<id>:2026-10` 한 줄이 있다.
  - **주의:** 0개를 고른 채 저장하면 후보가 모두 아는 단어가 된다. 그러면 같은 PDF를 다시 올렸을 때 검토 없이 바로 완료된다(정상 동작). 확인을 다시 할 때는 DB를 새로 만든다.
  - **스크린샷:** 검토 저장, 행, 모두 다시 시도, 카드, 관리 화면. PR에 붙인다.
- [ ] **Step 3:** 실제 웹훅을 확인한다(선택). 사용자가 웹훅 주소를 주면 가입 신청 알림이 오는지 본다. 주소가 없으면 건너뛰고, PR에 "웹훅 실제 수신은 C-2에서 확인"이라고 적는다.
- [ ] **Step 4:** PR을 연다(`--base development`). 그 뒤 순서: CI → Codex 리뷰 → 반영 → 병합 → PM에 알림.

## Self-Review(PM)

- **설계서 3장 대응:**
  - 3.1 세 입구: Task 3
  - 3.2 기록: Task 1, 2
  - 3.3 한도 확인과 맡아 두기: Task 2, 3
  - 3.4 화면: Task 5. 문구와 날짜는 Designer 규칙에 따라 정했다.
  - 3.5 알림 넷: Task 2(비용·한도), Task 4(가입·오류). 전체 상한에 걸렸을 때의 `budget-blocked` 알림은 설계서의 "비용 100%"를 보완한다.
  - 3.6 확인: Task 1~6
- **바뀐 결정:** 설계서 3.4는 "개인 한도와 전체 상한을 같은 내용으로"였다. Designer 규칙에 따라 다시 쓸 수 있는 날("11월 1일")을 더했다. 날짜만 알리므로 사용량은 드러나지 않는다.
