# C-3: 휴대폰 복습 화면 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 폭 640px 미만에서 복습을 한 손 엄지로 끝까지 할 수 있게 한다. 나머지 화면은 360px에서 깨지지 않게 한다.
- PC 화면은 바꾸지 않는다. 바뀌는 것은 세 가지뿐이다: 저장 실패 문구, 빈 화면 둘, 한도 문구 자리.

**Architecture:**
- **배치 전환:** 같은 DOM에 Tailwind `max-sm:`(640px 미만) 변형을 더해 휴대폰 배치로 바꾼다. 복습 화면을 PC용과 휴대폰용으로 두 벌 그리지 않는다.
- **터치 기기 판별:** 단축키 표시는 폭이 아니라 입력 장치로 숨긴다. CSS 변형 `touch:` = `@media (hover: none) and (pointer: coarse)`.
- **고정 줄:** 휴대폰에서는 답 버튼 묶음 전체가 `sticky bottom-0` 고정 줄이 된다. 그 안에서 상태 칸이 `order-first`로 버튼 위에 온다.

**Tech Stack:** 기존 스택 그대로. Tailwind v4 `@custom-variant`, Next `viewport` export(`viewportFit: "cover"`)

**Spec:**
- Designer 화면 규칙 `docs/superpowers/specs/2026-10-17-c-screens.md` 2부(6~10장)
- 목업 `docs/superpowers/mockups/c-mobile-usage.html`
- 설계서 `docs/superpowers/specs/2026-10-17-c-deploy-foundation-design.md` 4장

## Global Constraints

- **브랜치:** 최신 `origin/development`(C-1 병합 aa37987 이후)에서 `feat/c3-mobile-study`를 딴다. PR은 **`--base development`**로 열고, 태스크마다 커밋한다.
- **리뷰:** Orca의 Codex 터미널에 맡긴다. Important 이상은 테스트를 먼저 써서 고친다. 요약은 PR 댓글로 남긴다. development 병합은 묻지 않는다.
- **Designer 검수:** 병합 **전에** Designer에게 받는다(Task 3). 릴리스는 이 계획에 없다.
- **포트:** 3300(쓰고 있으면 3301). 헤드리스 서버는 임시 DB를 쓴다. 비밀값, 임시 DB, 로그는 커밋하지 않는다.
- **PM 프로토타입에서 확인한 것:** 패치 `2026-10-17-c3-mobile-study.patch`(이 파일 옆)
  - 태스크 범위대로 새 복제본에 적용했고, 단계마다 typecheck 0, lint 0이었다. 테스트는 253 → 254다. 빌드 라우트 표는 그대로다(◐ 유지, `/_not-found` ○).
  - 최종 트리는 프로토타입과 같다. 다만 원래 CRLF·LF가 섞여 있던 `src/app/layout.tsx`와 `src/app/(app)/layout.tsx`는 체크아웃 환경에 따라 줄 끝만 다를 수 있다. `git diff --ignore-cr-at-eol`로 보면 같다.
- **패치 적용:** `git apply --include=<경로> … docs/superpowers/plans/2026-10-17-c3-mobile-study.patch`. 경로의 `[id]`는 `[[]id]`로 쓴다. 적용 전에 그 부분을 읽고 이해한다. 패치와 다르게 고치려면 PM에게 먼저 묻는다. 리뷰 반영은 괜찮다.
- **iOS 음성:** 뒷면을 여는 탭 처리 안에서 바로 `speak()`를 부르는 경로(`reveal()`)를 바꾸지 않는다(규칙 7.8).

## Review Focus

1. **망이 끊긴 휴대폰에서 응답을 누르면** 화면이 깨지지 않고 "응답을 저장하지 못했습니다 · 다시 눌러 주세요"가 보여야 하며, 다시 누를 수 있어야 한다.
   - 지금은 Action이 예외를 던지면 transition 오류로 화면이 깨진다.
   - `answer()`에 `catch`를 더했다. 헤드리스에서 POST를 끊어 확인한다(Task 3 표 3).
2. **발음 버튼 탭이 앞면 카드 탭으로 번지지 않아야 한다**(`stopPropagation`). 확인: 표 2
3. **뒷면이 짧을 때도 고정 줄이 화면 맨 아래에 붙어야 한다.** 프로토타입 첫 판에서는 중간에 떠 있었다. 바(bar)를 `max-sm:mt-auto`로 내리고 카드에 `max-sm:mb-3`을 줘서 고쳤다. 확인: 표 5(고정 줄 bottom = 화면 높이)
4. **같은 내용의 live region이 겹치지 않아야 한다.** 휴대폰 상태 칸(저장 중·실패)과 `UndoControl`은 각자 따로 알린다. 감싼 줄에 `aria-live`를 두지 않는다.
5. **좁은 창의 PC(터치 없음)에서는 단축키 표시가 그대로 보여야 한다**(폭이 아니라 `pointer: coarse`로 나눈다). 확인: 표 8

---

### Task 1: 공통 장치(터치 변형·누르는 범위·상단 바·Notice alert)

**Files:**
- Modify:
  - `src/app/globals.css`(`@custom-variant touch`, `.tap`, `.hit-44`, 휴대폰 입력칸 16px)
  - `src/app/layout.tsx`(`export const viewport`, `viewportFit: "cover"`)
  - `src/app/(app)/layout.tsx`, `src/components/nav/nav-links.tsx`(규칙 7.2: 작업명 숨김, 여백 축소)
  - `src/components/ui/kbd.tsx`(`touch:hidden`)
  - `src/components/ui/regen-slot.tsx`(글자 버튼 `hit-44 tap`)
  - `src/components/ui/notice.tsx`(`alert` prop)
  - `src/app/(app)/documents/[id]/review/candidate-table.tsx`, `src/app/(app)/documents/[id]/retry-all-button.tsx`

**내용:**
- **C-1 리뷰 Minor ④ 처리:** 한도 Notice를 `role="alert"`로 바꾼다(규칙 3장). 색은 그대로 hard다.
- **C-1 리뷰 Minor ③("모두 다시 시도"가 한도 뒤에도 눌림)은 그대로 둔다.** 규칙 4.2가 "한도에 걸렸다고 다른 버튼을 숨기지 않는다. 누르면 같은 결과"이기 때문이다(PM 판단).
- **입력칸 16px:** `globals.css`의 `@media (max-width: 639.98px)` 규칙이 맡는다. 레이어 밖 CSS라서 Tailwind `text-sm`보다 우선한다. 체크박스·라디오·hidden은 뺀다.

- [ ] **Step 1:** 적용한다.

  ```bash
  git apply --include=src/app/globals.css --include=src/app/layout.tsx --include='src/app/(app)/layout.tsx' \
    --include=src/components/nav/nav-links.tsx --include=src/components/ui/kbd.tsx --include=src/components/ui/notice.tsx \
    --include=src/components/ui/regen-slot.tsx --include='src/app/(app)/documents/[[]id]/review/candidate-table.tsx' \
    --include='src/app/(app)/documents/[[]id]/retry-all-button.tsx' docs/superpowers/plans/2026-10-17-c3-mobile-study.patch
  ```

- [ ] **Step 2:** 확인한다.

  ```bash
  npm run typecheck && npm run lint && npx vitest run
  ```

  Expected: Tests **253 passed**, 오류 0

- [ ] **Step 3:** 커밋한다. 메시지: `feat(c3): touch variant, tap targets, compact nav, alert notices`

### Task 2: 복습 화면 휴대폰 배치

**Files:**
- Modify:
  - `src/app/(app)/study/study-session.tsx`
  - `src/app/(app)/study/speak-button.tsx`
  - `src/app/(app)/study/page.tsx`
  - `src/server/repo/study.ts`(`hasAnyCard`)
- Test: `tests/server/study.test.ts`

**Interfaces:**
- Produces:
  - `hasAnyCard(db, userId): boolean`
  - `StudySession`의 새 prop `hasCards: boolean`(페이지가 `cards.length > 0 || hasAnyCard(...)`로 넘긴다)

**내용(규칙 절 번호):**
- **7.1 틀:**
  - 페이지 `main`: 휴대폰에서 `min-h-[calc(100dvh-52px)]`, 위·아래 여백 0
  - 세션: `flex-1 flex-col`
  - 앞면 카드: `flex-1`로 남은 높이를 채운다.
  - 고정 줄: `sticky bottom-0`, `mt-auto`, 바탕 `bg`, 위 테두리, 아래 여백 `calc(12px + env(safe-area-inset-bottom))`
- **7.4 카드:**
  - 단어 크기: 앞 36px, 뒤 30px. 13자 이상은 28px, 24px로 줄인다.
  - `[overflow-wrap:anywhere]`
  - 발음 버튼: 40px, `after:-inset-1`로 누르는 범위 48px
  - 용례 글자 크기를 줄이고, 다시 만들기는 출처 아래 줄로 옮긴다(`max-sm:flex-col`).
  - 다시 만들기 자리가 비면 `empty:hidden`
- **7.5:**
  - 앞면 `section`의 `onClick`이 `reveal`이다. `role`은 주지 않는다.
  - 발음 버튼은 `stopPropagation`한다.
  - 휴대폰에서는 뒷면을 열면 카드 맨 위로 `scrollIntoView`한다.
- **7.6 고정 줄:**
  - 상태 칸 32px, 우선순위는 저장 실패 > 저장 중(400ms 뒤) > 되돌리기
  - 답 버튼 60px, "뒷면 보기" 52px
  - `:active` 색 섞기, `.tap`
  - 단축키 표시는 `touch:hidden`
- **7.6 저장 실패:** `saveFailed`(불리언)로 바꾸고 고정 문구 `SAVE_FAILED`를 `Failed`로 보인다. PC는 카드 아래, 휴대폰은 상태 칸이다. 서버 문구는 보이지 않는다. 망 오류는 `catch`로 잡는다.
- **7.9 빈 화면:** 이번 세션에 답한 것이 없으면, `hasCards`에 따라 "지금 복습할 카드가 없습니다"(홈으로) 또는 "아직 카드가 없습니다"(문서로)를 보인다. Enter도 같은 곳으로 간다. 휴대폰에서는 버튼이 폭 전체, 높이 48px다.

- [ ] **Step 1:** 테스트를 적용하고 실패를 확인한다.

  ```bash
  git apply --include=tests/server/study.test.ts docs/superpowers/plans/2026-10-17-c3-mobile-study.patch
  npx vitest run tests/server/study.test.ts
  ```

  Expected: FAIL `hasAnyCard is not a function`

- [ ] **Step 2:** 구현을 적용한다.

  ```bash
  git apply --include='src/app/(app)/study/*' --include=src/server/repo/study.ts docs/superpowers/plans/2026-10-17-c3-mobile-study.patch
  ```

- [ ] **Step 3:** 확인한다.

  ```bash
  npm run typecheck && npm run lint && npx vitest run && npm run build
  ```

  Expected: **254 passed**. 라우트 표는 그대로다.

- [ ] **Step 4:** 커밋한다. 메시지: `feat(c3): mobile study layout with sticky answer bar (Designer C rules part 2)`

### Task 2b: Designer 사전 검수 수정 3건(2026-10-17 추가)

Designer가 PM 스크린샷을 미리 보고 요청한 수정이다. 패치 파일에는 없다. 아래 diff대로 직접 고친다(PM 프로토타입에서 확인).

**Files:**
- Modify:
  - `src/app/(app)/study/study-session.tsx`
  - `src/app/(app)/documents/[id]/word-table.tsx`
  - `src/components/ui/status.tsx`
  - `src/app/(app)/documents/page.tsx`

**1. "발음기호 없음"은 sans로 쓴다(개편안 3.3).** 지금은 `font-en`이라, Gentium에 없는 한글을 대체 세리프 글꼴이 그리며 자간이 벌어진다.

```diff
// study-session.tsx (뒷면 발음기호 줄)
+            {/* 발음기호가 없을 때의 안내는 한글이라 영어 글꼴(Gentium)이 아닌 sans로 쓴다(개편안 3.3) */}
             <p
-              className={`mt-1 font-en text-[19px] max-sm:text-[17px] ${card.phonetic ? "text-muted" : "text-[15px] text-muted max-sm:text-[15px]"}`}
+              className={`mt-1 text-muted ${card.phonetic ? "font-en text-[19px] max-sm:text-[17px]" : "font-sans text-[15px]"}`}
             >

// word-table.tsx (단어 칸)
-                  <div className="font-en text-sm text-muted">{r.phonetic ?? "발음기호 없음"}</div>
+                  {r.phonetic ? (
+                    <div className="font-en text-sm text-muted">{r.phonetic}</div>
+                  ) : (
+                    <div className="text-[15px] text-muted">발음기호 없음</div>
+                  )}
```

**2. 실패·한도 표시는 굵은 칸 안에서도 보통 굵기로 쓴다.** 복습 카드의 뜻 칸(700) 안에서 "문맥 뜻을 만들지 못했습니다"가 굵게 나왔다.

```diff
// status.tsx
-    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
+    <span className="inline-flex items-center gap-1.5 text-[13px] font-normal text-muted">
       <span aria-hidden className="w-2.5 border-t-2 border-dashed border-again" />
 …
-    <span className={`inline-flex items-baseline gap-1.5 whitespace-normal text-muted ${className}`}>
+    <span className={`inline-flex items-baseline gap-1.5 font-normal whitespace-normal text-muted ${className}`}>
```

**3. 문서 목록 360px:** 640px 미만에서는 종류·단어 열을 숨긴다(둘 다 상세 화면 제목 아래에 있다). 상태·날짜 칸은 줄바꿈하지 않고 폭을 내용 크기로 둔다. PM 실측으로 제목 칸이 약 100px에서 **199px**가 됐다.

```diff
// documents/page.tsx
-            <th className="w-20 px-3 py-2">종류</th>
-            <th className="w-[130px] px-3 py-2">상태</th>
-            <th className="w-[110px] px-3 py-2 text-right">단어</th>
-            <th className="w-[120px] px-3 py-2 text-right">올린 날</th>
+            <th className="w-20 px-3 py-2 max-sm:hidden">종류</th>
+            <th className="w-[130px] px-3 py-2 max-sm:w-auto">상태</th>
+            <th className="w-[110px] px-3 py-2 text-right max-sm:hidden">단어</th>
+            <th className="w-[120px] px-3 py-2 text-right max-sm:w-auto">올린 날</th>
 …
-                <td className="px-3 py-2.5 text-sm">{KIND_LABEL[doc.kind]}</td>
-                <td className="px-3 py-2.5">
+                <td className="px-3 py-2.5 text-sm max-sm:hidden">{KIND_LABEL[doc.kind]}</td>
+                <td className="px-3 py-2.5 whitespace-nowrap">
                   <DocumentStatusLabel status={doc.status} />
                 </td>
-                <td className="px-3 py-2.5 text-right text-sm tabular-nums">
+                <td className="px-3 py-2.5 text-right text-sm tabular-nums max-sm:hidden">
 …
-                <td className="px-3 py-2.5 text-right text-sm text-muted tabular-nums">
+                <td className="px-3 py-2.5 text-right text-sm whitespace-nowrap text-muted tabular-nums">
```

- [ ] **Step 1:** 위 diff대로 고친다.
- [ ] **Step 2:** 확인한다.

  ```bash
  npm run typecheck && npm run lint && npx vitest run && npm run build
  ```

  Expected: 254 passed, 오류 0

- [ ] **Step 3:** 커밋한다. 메시지: `fix(c3): sans for missing phonetic, normal weight for Failed/Limited, compact document list on phones`
- [ ] **Step 4:** Task 3 확인 때 Designer가 지정한 세 장으로 본다.
  - `limit-390-dark`: "발음기호 없음"이 sans이고, "문맥 뜻을 만들지 못했습니다"가 보통 굵기다.
  - 문서 상세 360: `latent` 행의 "발음기호 없음"이 sans다.
  - 문서 목록 360: 열이 제목·상태·올린 날 셋이고, 날짜가 한 줄이다.

### Task 3: 헤드리스 확인과 Designer 검수

- [ ] **Step 1:** 헤드리스 Edge로 확인한다.
  - **서버:** `npm run build` 후 아래 환경변수로 띄운다.
    - `BETTER_AUTH_URL=http://localhost:3300`, `AUTH_DEV_LOGIN=1`, `ADMIN_EMAILS=owner@example.com`
    - `SLAVE_VOCA_DB=<임시>/app.db`, `MONTHLY_WORD_LIMIT=5`
  - **휴대폰 컨텍스트:** `viewport 360×740`(또는 390×844), `hasTouch: true`, `isMobile: true`
  - **준비:** owner로 로그인한 뒤 DB에 넣는다.
    - 문서 1: 긴 제목
    - 단어 `heteroscedasticity`: 18자, 용례 2개
    - `residual`
    - `latent`: 발음기호 없음, 뜻 failed
  - **PM 결과**(같아야 한다)

    | 순서 | 동작 | 기대(PM 실측) |
    |---|---|---|
    | 1 | 360 앞면 | `scrollWidth` 360. 단어 28px(18자라 한 단계 작게), 오른쪽 끝 261px. 고정 줄 bottom 740 = 화면 높이. 보이는 `kbd` 0 |
    | 2 | 발음 버튼 탭 → 카드 탭 | 발음 탭으로는 안 열린다. 카드 탭으로 열린다. 뒷면 단어 24px, 답 버튼 높이 60. 맨 아래로 스크롤해도 고정 줄이 보인다 |
    | 3 | `page.route`로 `/study` POST를 1.5초 끌다 끊고 "앎" 탭 | 0.8초에 상태 칸 "저장 중", 끊긴 뒤 "응답을 저장하지 못했습니다 · 다시 눌러 주세요". 화면은 그대로다 |
    | 4 | 다시 "앎" → 상태 칸의 "되돌리기" | "되돌리기 heteroscedasticity · 앎" → "heteroscedasticity 응답을 되돌렸습니다" |
    | 5 | 390 다크, 이번 달 사용량을 5단어로 채운 뒤 `latent` 뒷면에서 "뜻 다시 만들기" | 출처 아래 `LIMIT_CARD` 한 줄(hard 실선). 그 위에 빈 줄이 없다. 고정 줄 bottom 844 = 화면 높이 |
    | 6 | 마지막 카드 응답 | "오늘 복습을 마쳤습니다 카드 3장 응답 3번 모름 0 … 홈으로 마지막 응답 되돌리기 latent · 앎" |
    | 7 | 다시 `/study`(카드 있음, 남은 것 없음) / 카드 없는 새 승인 사용자 | "지금 복습할 카드가 없습니다 … 홈으로" / "아직 카드가 없습니다 PC에서 논문 PDF를 … 문서로" |
    | 8 | 터치 **없는** 360 컨텍스트로 `/study` | 보이는 `kbd` 2(Space, P) |
    | 9 | 360에서 `/`, `/settings`, `/documents`, `/documents/1`, `/admin`, `/study`, 검토 화면, `/login`, `/pending`, `/blocked` | 모두 `scrollWidth` 360. 설정·문서의 입력칸 글자 16px(PC 1280에서는 14px 그대로) |

  - **PC 1280:** 복습 앞·뒷면이 지금과 같은지 스크린샷으로 본다. PM 확인: 같았다.
- [ ] **Step 2:** Designer 검수를 받는다. PR을 연 뒤(`--base development`) Designer에게 아래를 보낸다.
  - PR 주소
  - 스크린샷 경로: 360·390, 라이트·다크, 규칙 10장 목록
  - 확인 요청 한 가지: 원래 PC는 서버 오류 문구를 카드 아래에 `text-again` 글자로 보였다. 이제 PC 저장 실패는 고정 문구 `Failed`를 카드 아래에 보인다.
  - 검수 수정은 이 PR에 더한다.
- [ ] **Step 3:** CI → Codex 리뷰 → 반영 → Designer 통과 → development 병합 → PM에 알린다.

## Self-Review(PM)

- **규칙 대응:**
  - 6장 원칙 1~4: Task 1, 2
  - 7.1~7.9: Task 2(7.2 상단 바는 Task 1)
  - 8장 PC 세 가지: Task 2
  - 9장 나머지 화면: Task 1(입력칸 16px, 상단 바). 나머지는 이미 맞았다. PM이 360에서 10개 화면을 쟀더니 모두 `scrollWidth` 360이었다. 표는 감싼 상자만 스크롤하고, 홈·설정은 이미 1열이다.
  - 10장 확인: Task 3
- **C-1 Minor 둘:** ④는 Task 1에서 고쳤다. ③은 규칙 4.2에 맞으므로 그대로 둔다.
- **Designer 사전 검수(2026-10-17):** 판단 4건은 모두 그대로 좋다고 했다. 수정 3건은 Task 2b로 더했다. 관리 표 360에서 이메일이 꺾이는 것은 고치지 않는다(PC용 화면, 상자 안 스크롤).
- **남는 것:** 실제 iPhone·Android에서 자동 발음과 safe-area는 C-2 배포 뒤 사용자 폰으로 확인한다(설계서 4.4).
