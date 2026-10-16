# 개발 흐름(브랜치·PR)과 버전 관리

- 상태: 사용자 결정(2026-10-16).
  - "지금부터 GitHub Flow를 따르고, 배포도 할 것이니 버전 관리도 한다."
  - 같은 날 덧붙임: "기능 개발은 development 브랜치로 따로 관리하고, main은 배포용으로 한다."
- 계획서: `docs/superpowers/plans/2026-10-16-github-flow-setup.md`
- 저장소: https://github.com/iwtkmn0219/slave-voca (공개, MIT)

## 1. 브랜치

| 브랜치 | 용도 | 들어오는 길 |
|---|---|---|
| `main` | 배포용. 늘 릴리스된 상태다. 릴리스 태그는 main에만 단다. **기본 브랜치** | `development`에서 오는 릴리스 PR, 핫픽스 PR |
| `development` | 개발 통합. 다음 릴리스에 들어갈 기능이 모인다 | 작업 브랜치 PR |
| `feat/…`, `fix/…`, `docs/…`, `chore/…` | 작업 하나(마일스톤, 고치기, PM 문서, 설정) | `origin/development`에서 딴다 |
| `hotfix/…` | 배포된 버전의 급한 고치기 | `origin/main`에서 딴다 |

- `main`과 `development`에는 직접 커밋하거나 push하지 않는다. 둘 다 규칙 세트로 막는다(4장).
- 기본 브랜치는 `main`이다(2026-10-16 사용자 결정. 처음에는 development였다). 저장소를 연 사람이 릴리스된 안정 버전을 먼저 본다. 그래서 `gh pr create`의 기본 대상도 main이다. **PR을 열 때는 `--base development`를 반드시 적는다**(릴리스·핫픽스만 `--base main`).

## 2. 흐름

1. **작업:** 최신 `origin/development`에서 브랜치를 따고, 태스크마다 커밋한다.
   - 커밋 메시지는 지금처럼 Conventional Commits(`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)를 쓴다.
   - 기능 PR은 `CHANGELOG.md`의 `## [Unreleased]`에 자기 항목을 적는다.
2. **PR → development:** `gh pr create --base development`
   - 본문: 무엇을 왜 바꿨는지, 설계서·계획서 경로, 확인 결과(테스트 수, 빌드 표, 실제 호출 결과)
   - 병합 조건: CI(`ci`)가 통과하고, Codex 리뷰(Orca 터미널, 지금과 같음)에서 Important 이상이 남지 않는다. 리뷰 요약은 PR 댓글로 남긴다.
   - 병합: `gh pr merge --merge --delete-branch`(병합 커밋만 허용)
3. **릴리스:** development가 배포할 만하면 main으로 올린다(3장). 보통 마일스톤 하나가 끝났을 때다.
4. **핫픽스:**
   1. `origin/main`에서 `hotfix/…`를 딴다.
   2. 고치는 커밋과 `chore(release): vX.Y.Z`(PATCH) 커밋을 넣고 `--base main` PR을 연다.
   3. 사용자 검수(2.1)를 받아 병합한 뒤 태그와 릴리스를 만든다.
   4. 이어서 `main` → `development` PR을 열어 고친 내용을 development에도 들인다.
5. 강제 push는 하지 않는다. 열린 PR 브랜치의 커밋도 고쳐 쓰지 않고 새 커밋으로 고친다.

### 2.1 누가 무엇을 하나

- **PM:** 설계서·계획서를 `docs/…` 브랜치로 올려 `--base development` PR을 열고, CI가 통과하면 직접 병합한다. 문서 PR은 Codex 리뷰를 받지 않는다.
- **Developer:** `feat/…`·`fix/…`·`hotfix/…`에서 구현한다. PR, CI, Codex 리뷰, 병합을 맡는다. 릴리스(3장)는 PM이 "릴리스하자"고 알릴 때 한다.
- **main 병합 전 사용자 검수(2026-10-16 사용자 지시):** "앞으로 main에 병합하기 전에 항상 나에게 우선 검수 부탁해." main으로 가는 PR(릴리스, 핫픽스, PR #1)은 CI 통과와 리뷰 요약까지 마친 뒤 멈춘다. PR 링크, CI 결과, 리뷰 요약, 들어가는 변경(변경 기록의 그 버전 구역)을 사용자에게 보이고, 승인을 받은 다음에 병합한다. 태그와 릴리스는 그 승인에 포함된다. development로 가는 PR은 묻지 않고 병합한다.
- **사용자 승인(2026-10-16):** 위의 main 병합을 빼면, 이 흐름 안에서 브랜치 push, PR, development 병합, 태그, 릴리스를 할 때 매번 묻지 않는다. 다음은 이 승인에 들어가지 않으므로 그때마다 사용자에게 묻는다.
  - 기록 고쳐 쓰기
  - 강제 push
  - 규칙 세트 해제
  - 저장소 공개 범위 변경
  - 실제 배포

### 2.2 작업 폴더

PM과 Developer가 같은 작업 폴더를 쓰면 브랜치를 바꿀 때 서로의 작업이 꼬인다. 그래서 폴더를 나눈다.
- 원래 폴더(`C:\Users\iwtkm\workspace\slave-voca`): Developer
- 별도 git worktree(`C:\Users\iwtkm\workspace\slave-voca-pm`): PM

## 3. 버전과 릴리스

- **유의적 버전(SemVer)** `MAJOR.MINOR.PATCH`. 한 군데에서만 정한다: `package.json`의 `version`. 태그는 `v` + 버전(`v0.5.0`)이다.
- **1.0.0 전(지금)의 규칙:**
  - MINOR: main으로 올리는 릴리스에 새 기능이 있을 때. 보통 마일스톤 하나다. 예: M5 → 0.5.0
  - PATCH: 고치기만 있는 릴리스나 핫픽스. 예: 0.5.1
  - 0.x 동안에는 MINOR가 DB 마이그레이션이나 설정 변경을 포함할 수 있다. 그때는 변경 기록에 "업그레이드 시 주의"로 적는다.
- **1.0.0:** 처음 배포해서 로컬이 아닌 곳에서 쓰는 시점이다. 그 뒤로는 호환이 깨지는 변경(데이터를 옮겨야 하는 변경 등)이 MAJOR다.
- **변경 기록:** 저장소 루트의 `CHANGELOG.md`([Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식, 한국어)에 둔다. 구역은 `추가`, `바뀜`, `고침`, `없앰`, `업그레이드 시 주의`를 쓴다.
- **릴리스 순서**(development → main):
  1. `origin/development`에서 `chore/release-vX.Y.Z`를 따고 `chore(release): vX.Y.Z` 커밋 하나를 만든다.
     - `npm version X.Y.Z --no-git-tag-version`
     - `[Unreleased]`를 `## [X.Y.Z] - 날짜`로 바꾸고, 비교 링크를 고친다.
     - 이 커밋으로 `--base development` PR을 열고 병합한다.
  2. `development` → `main` PR(`gh pr create --base main --head development --title "release: vX.Y.Z"`)을 연다. CI가 통과하면 **사용자 검수를 받은 뒤**(2.1) 병합 커밋으로 병합한다. 브랜치를 지우지 않도록 `--delete-branch`는 쓰지 않는다.
  3. main의 그 병합 커밋에 주석 태그를 단다: `git tag -a vX.Y.Z -m "vX.Y.Z"` → `git push origin vX.Y.Z`
  4. GitHub 릴리스를 만든다: `gh release create vX.Y.Z --title vX.Y.Z --notes-file <변경 기록의 그 버전 구역>`
- **지금까지의 기록에 다는 태그:** 마일스톤 병합 커밋에 단다. `package.json`은 그동안 0.1.0이었지만 태그가 기준이다.

| 태그 | 커밋 | 내용 |
|---|---|---|
| v0.1.0 | `1c4524c` | M1 단어 추출, 검토 화면 |
| v0.2.0 | `2f85457` | M2 카드 저장, 문맥 뜻(Gemini), 발음기호 |
| v0.3.0 | `2f201e3` | M3 복습(FSRS) |
| v0.4.0 | PR #1(흐름 설정)의 main 병합 커밋 | UI 개편, 뜻 모델·지시 개선, M4-1~M4-4, 공개 준비 |

v0.4.0은 development를 만들기 전이라 예외로 설정 PR을 main에 바로 병합한다. development는 그 뒤의 main에서 만든다.

## 4. GitHub 설정

- **CI**(`.github/workflows/ci.yml`, 작업 이름 `ci`):
  - 언제 도나: 모든 `pull_request`와, `main`·`development` push
  - 환경: Ubuntu, Node 24
  - 순서: `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`
  - `data/awl.json`이 없으므로 AWL 테스트 2개는 건너뛴다(189 통과 + 2 건너뜀).
  - Gemini 키는 넣지 않는다. 테스트는 SDK를 목으로 쓴다.
- **규칙 세트(ruleset)**, `main`과 `development` 둘 다에 적용:
  - PR로만 변경한다. 승인 수는 0이다(혼자 쓰는 저장소라 자기 PR을 승인할 수 없다).
  - 상태 검사 `ci` 통과가 필요하다.
  - 강제 push와 삭제를 막는다.
  - 병합 방식은 병합 커밋만 허용한다.
  - 관리자 우회는 두지 않는다. 같은 계정(iwtkmn0219)을 쓰는 PM·Developer에게도 적용된다.
- **저장소 설정:**
  - squash·rebase 병합을 끄고 병합 커밋만 켠다.
  - 병합한 브랜치는 자동으로 지운다. 규칙 세트가 삭제를 막으므로 `development`는 릴리스 PR을 병합해도 지워지지 않는다.
  - 기본 브랜치는 `main`이다(1장).
- `CONTRIBUTING.md`에 1~3장을 짧게 옮기고, README에서 링크한다.

## 5. 범위 밖

- 배포 자동화(CD)와 배포 대상 선택: 배포 마일스톤에서 정한다. main에 태그가 생기면 배포하는 방식을 그때 검토한다.
- 자동 버전 도구(release-please, changesets): 릴리스가 마일스톤마다 한 번이라 손으로 한다.
- 의존성 자동 갱신(Dependabot): 나중에 검토한다.
