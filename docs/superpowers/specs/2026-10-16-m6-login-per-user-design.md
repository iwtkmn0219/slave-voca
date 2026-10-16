# M6 설계: 로그인과 사용자별 데이터(베타 로드맵 B, v0.6.0)

- 상태: 사용자 승인(2026-10-16). 방식 A(Better Auth)
- 화면 규칙(Designer): `2026-10-16-m6-1-auth-screens.md`, 목업 `docs/superpowers/mockups/m6-1-auth.html`
- 계획서: M6-1 `docs/superpowers/plans/2026-10-16-m6-1-auth.md`. M6-2는 M6-1이 끝난 뒤 따로 쓴다.
- 상위 설계서: `2026-10-13-slave-voca-design.md` 1장(사용자 1명, 로그인 없음 → 바뀜), 5장 화면, 7장 DB, 11장 로드맵

## 1. 사용자 결정(2026-10-16)

- 목표는 수익화다. 첫 배포는 지인 10명 안팎의 비공개 베타다.
- 로그인: **Google 계정**
- 가입: **누구나 Google로 가입 신청 → 관리자가 승인해야 쓸 수 있다.** 관리자는 `ADMIN_EMAILS` 환경변수의 이메일이다.
- 방식: **Better Auth**(OAuth의 state·PKCE·CSRF·세션 처리를 검증된 라이브러리에 맡긴다). 직접 구현(Arctic + 세션)은 하지 않는다.

## 2. 계정 상태와 흐름

| 상태 | 뜻 | 볼 수 있는 화면 |
|---|---|---|
| (로그인 안 함) | 세션 없음 | `/login` |
| `pending` | 가입했지만 승인 전 | `/pending`(승인 대기) |
| `approved` | 승인됨 | 앱 전체. `role=admin`이면 `/admin`도 |
| `blocked` | 관리자가 사용을 멈춤(화면 문구: "사용 중지") | `/blocked` |

- 새 계정의 `status`·`role`은 가입 직전에 서버가 정한다.
  - `ADMIN_EMAILS`에 있는 이메일(대소문자 무시)은 `approved`·`admin`
  - 나머지는 `pending`·`user`
  - 사용자가 보낸 값은 받지 않는다(Better Auth `input: false`).
- 관리자는 다른 사람을 승인, 사용 중지, 다시 허용할 수 있다.
  - 자기 자신은 사용 중지할 수 없다(화면에 버튼이 없고 서버도 거부한다).
  - `pending`으로 되돌리는 동작은 없다.
- 사용 중지하면 그 사람의 세션을 모두 지운다. 다음 요청부터 바로 로그인 화면으로 가고, 다시 로그인하면 `/blocked`가 보인다.
- 상태는 요청마다 DB에서 읽는다(Better Auth 쿠키 캐시를 쓰지 않는다).
- 로그인 뒤 원래 주소로 돌아가기, 승인 대기 화면 저절로 넘어가기는 화면 규칙 2.4·3.3(PM 결정)을 따른다.
- 승인 대기·사용 중지 계정은 PDF 업로드를 포함한 어떤 동작도 할 수 없다. 그래서 Gemini 비용도 생기지 않는다.

## 3. 인증 구조

- **표:** `users`·`sessions`·`accounts`·`verifications`(Better Auth SQLite 모양, 복수형 이름, `drizzleAdapter` `usePlural`)
  - `users`에 `status`(기본 `pending`)와 `role`(기본 `user`)을 더한다.
  - 마이그레이션 `0005_auth`. 기존 표는 M6-1에서 바뀌지 않는다.
- **인스턴스:** `src/server/auth/auth.ts`의 `createAuth(db, env)`(테스트가 메모리 DB로 만든다)와 `getAuth()`(앱용, 처음 쓸 때 만든다. 빌드 중에 DB를 열지 않게)
- **로그인 확인 계층**(`src/server/auth/current-user.ts`)
  - `getSessionUser()`: 요청 헤더로 세션을 읽어 `{ id, name, email, status, role }` 또는 null을 돌려준다. 헤더를 먼저 읽어서 프리렌더 중에는 인증 객체를 만들지 않는다.
  - `requireUser()`: 승인된 사용자가 아니면 `/login`·`/pending`·`/blocked`로 보낸다.
  - `requireAdmin()`: 관리자가 아니면 홈으로 보낸다.
  - **모든 앱 화면의 데이터 구성 요소와 모든 Server Action이 이 함수로 시작한다.** `/api/usage-meaning`은 보낼 수 없으므로 401로 답한다.
- **1차 확인(`src/proxy.ts`):** 세션 쿠키가 아예 없으면 화면을 그리기 전에 `/login?next=…`로 보낸다. 쿠키가 있다고 들여보내는 것은 아니다. 진짜 확인은 위 계층이 한다. API, Next 정적 파일, 인증 화면은 제외한다.
- **화면 구조:** 라우트 그룹 두 개로 나눈다. 주소는 바뀌지 않는다.
  - `(app)`: 상단 바가 있는 앱 화면(홈, 복습, 문서, 설정, 관리)
  - `(auth)`: 상단 바가 없는 로그인·승인 대기·사용 중지 화면
  - 루트 레이아웃에는 html·body·글꼴·테마만 남긴다.
- **Next 16 Cache Components:** 세션 읽기는 지금 `await connection()`이 있던 자리(Suspense 안)에서 한다. 그래서 페이지의 정적 뼈대(◐)는 그대로이고, `/_not-found`는 완전 정적(○)이 된다.
- **로그인·로그아웃 뒤 이동은 페이지를 통째로 다시 연다**(`window.location.assign`).
  - 프로토타입에서 클라이언트 이동(`router.push`/`refresh`)을 쓰면 이전 화면의 제목이 겹쳐 남았다.
  - 또 사용자가 바뀌는 순간 브라우저 라우터 캐시에 이전 사용자의 화면이 남지 않아야 한다.
- **환경변수:** `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`(필수, 32자 이상), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`, `AUTH_DEV_LOGIN`. `.env.example`과 README "Google 로그인 설정"에 적는다.

## 4. 개발 전용 로그인

- 헤드리스 브라우저 확인과 Google 없는 로컬 실행을 위해 둔다.
- `AUTH_DEV_LOGIN=1`이고 `BETTER_AUTH_URL`의 호스트가 `localhost`·`127.0.0.1`일 때만 켜진다. 그때 Better Auth의 이메일·비밀번호 로그인을 열고, 로그인 화면에 이메일 칸을 보인다.
  - 배포 주소에서는 켤 수 없다.
  - `next start`는 `NODE_ENV=production`이므로, 켜는 조건을 `NODE_ENV`로 나누지 않는다.
- 가입 규칙(관리자 이메일, 승인 대기)은 Google 로그인과 같다.

## 5. 사용자별 데이터(M6-2, 다음 계획서)

- 문서·단어·아는 단어·설정에 사용자를 붙인다.
  - 단어: `(user_id, lemma)`가 고유하다.
  - 아는 단어: 키가 `(user_id, lemma)`다.
  - 설정: 키가 `(user_id, key)`다.
  - 후보·용례·복습 기록은 문서·단어를 따라 나뉜다.
- 모든 저장소 함수가 사용자를 인자로 받는다. 남의 id는 "없음"으로 처리한다.
- 화면 동작마다 사용자 A·B 격리 테스트를 둔다.
- 화면 테마는 지금처럼 브라우저 쿠키다.
- 기존 데이터: 마이그레이션 때 남은 데이터를 임시 소유자에게 묶고, `npm run db:claim -- <이메일>`로 그 계정에 넘긴다(지금 실데이터는 없고 데모 DB뿐이다).
- **M6-1만 병합된 development에서는 승인된 사용자끼리 데이터를 함께 본다.** 그래서 v0.6.0 릴리스는 M6-2까지 끝난 뒤에 한다.

## 6. 사용자가 할 일

- Google Cloud Console에서 OAuth 클라이언트를 만든다(README "Google 로그인 설정"). 실제 Google 로그인 확인은 이 클라이언트가 생긴 뒤에 한다. 그 전까지는 개발 전용 로그인으로 확인한다.
- 동의 화면 게시 상태가 "테스트"이면 등록한 테스트 사용자만 로그인할 수 있다. 누구나 가입 신청을 하게 하려면 "프로덕션으로 게시"한다(기본 범위만 쓰므로 Google 검토가 필요 없다).

## 7. 범위 밖

- 사용자별 월 사용량 제한, Gemini 비용 상한, 서버 배포, 오류 알림: C단계(0.7.0)
- 계정 삭제·데이터 내보내기, 개인정보 안내: D단계(1.0.0)
- 카카오 로그인, 이메일 링크 로그인
