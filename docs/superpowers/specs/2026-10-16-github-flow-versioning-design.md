# 개발 흐름(GitHub Flow)과 버전 관리

- 상태: 사용자 결정(2026-10-16). "지금부터 GitHub Flow를 따르고, 배포도 할 것이니 버전 관리도 한다."
- 계획서: `docs/superpowers/plans/2026-10-16-github-flow-setup.md`
- 저장소: https://github.com/iwtkmn0219/slave-voca (공개, MIT)

## 1. 흐름

1. **main은 늘 실행·배포 가능한 상태다.** main에 직접 커밋하거나 push하지 않는다(규칙 세트로 막는다, 3장).
2. 모든 변경은 최신 `origin/main`에서 딴 브랜치에서 한다. 이름은 하는 일의 종류를 앞에 붙인다.
   - `feat/…`: 기능(마일스톤 등). 예: `feat/m5-stats`
   - `fix/…`: 버그 고치기
   - `docs/…`: 문서만(PM의 설계서·계획서 포함)
   - `chore/…`: 설정·의존성·릴리스 준비
3. 커밋 메시지는 지금처럼 Conventional Commits(`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)를 쓴다. 태스크마다 커밋한다.
4. 브랜치를 push하고 PR을 연다(`gh pr create`).
   - 본문: 무엇을 왜 바꿨는지, 설계서·계획서 경로, 확인 결과(테스트 수, 빌드 표, 실제 호출 결과)
   - PR 하나는 마일스톤 하나 또는 고치기 하나다.
5. **병합 조건:** CI(`ci`)가 통과하고, Codex 리뷰(Orca 터미널, 지금과 같음)에서 Important 이상이 남지 않는다. 리뷰 요약은 PR 댓글로 남긴다(`gh pr comment`).
6. 병합은 **병합 커밋**(`gh pr merge --merge --delete-branch`)으로 한다. 지금까지의 `--no-ff`와 같은 모양이라 태스크 커밋이 기록에 남는다. squash·rebase 병합은 저장소 설정에서 끈다. 병합한 브랜치는 지운다.
7. 강제 push는 하지 않는다. 열린 PR 브랜치의 커밋도 고쳐 쓰지 않고 새 커밋으로 고친다.

### 1.1 누가 무엇을 하나

- **PM:** 설계서·계획서를 `docs/…` 브랜치로 올려 PR을 열고, CI가 통과하면 직접 병합한다. 문서 PR에는 Codex 리뷰를 받지 않는다.
- **Developer:** `feat/…`·`fix/…` 브랜치에서 구현한다. PR, CI, Codex 리뷰, 병합, 릴리스(2장)를 맡고 결과를 PM에게 보낸다.
- **사용자 승인(2026-10-16):** 이 흐름 안에서 브랜치 push, PR, 병합, 태그, 릴리스를 할 때 매번 묻지 않는다. 기록 고쳐 쓰기, 강제 push, 규칙 세트 해제, 저장소 공개 범위 변경은 이 승인에 들어가지 않으므로 그때마다 사용자에게 묻는다.

### 1.2 작업 폴더

PM과 Developer는 지금 같은 작업 폴더를 쓴다. 브랜치를 바꾸면 서로의 작업이 꼬인다. 그래서 **PM은 별도 git worktree**(`C:\Users\iwtkm\workspace\slave-voca-pm`)에서 `docs/…` 브랜치를 만든다. 원래 폴더(`slave-voca`)는 Developer가 쓴다.

## 2. 버전

- **유의적 버전(SemVer)** `MAJOR.MINOR.PATCH`. 한 군데에서만 정한다: `package.json`의 `version`. 태그는 `v` + 버전(`v0.5.0`)이다.
- **1.0.0 전(지금)의 규칙:**
  - MINOR: 마일스톤 하나가 끝날 때(쓰는 사람이 알아챌 기능). 예: M5 → 0.5.0
  - PATCH: 마일스톤 사이의 고치기나 작은 개선. 예: 0.5.1
  - 0.x 동안에는 MINOR가 DB 마이그레이션이나 설정 변경을 포함할 수 있다. 그때는 변경 기록에 "업그레이드 시 주의"로 적는다.
- **1.0.0:** 처음 배포해서 로컬이 아닌 곳에서 쓰는 시점이다. 그 뒤로는 호환이 깨지는 변경(데이터를 옮겨야 하는 변경 등)이 MAJOR다.
- **변경 기록:** 저장소 루트의 `CHANGELOG.md`([Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식, 한국어)에 둔다. 구역은 `추가`, `바뀜`, `고침`, `없앰`, `업그레이드 시 주의`를 쓴다. 기능 PR은 `## [Unreleased]` 아래에 자기 항목을 적는다.
- **릴리스 순서:**
  1. 마일스톤 PR의 마지막 커밋을 `chore(release): vX.Y.Z`로 한다. 이 커밋에서 `package.json` 버전을 올리고, `[Unreleased]`를 `## [X.Y.Z] - 날짜`로 바꾼다.
  2. PR을 병합한 뒤 main의 병합 커밋에 주석 태그를 단다: `git tag -a vX.Y.Z -m "vX.Y.Z"` → `git push origin vX.Y.Z`
  3. GitHub 릴리스를 만든다: `gh release create vX.Y.Z --title vX.Y.Z --notes-file <변경 기록의 그 버전 구역>`
  4. 버전을 바꾸지 않는 PR(문서, 다음 마일스톤 도중 작업)은 `[Unreleased]`에만 적는다.
- **지금까지의 기록에 다는 태그:** 마일스톤 병합 커밋에 단다. `package.json`은 그동안 0.1.0이었지만 태그가 기준이다.

| 태그 | 커밋 | 내용 |
|---|---|---|
| v0.1.0 | `1c4524c` | M1 단어 추출, 검토 화면 |
| v0.2.0 | `2f85457` | M2 카드 저장, 문맥 뜻(Gemini), 발음기호 |
| v0.3.0 | `2f201e3` | M3 복습(FSRS) |
| v0.4.0 | 흐름 설정 PR의 병합 커밋 | UI 개편, 뜻 모델·지시 개선, M4-1~M4-4, 공개 준비 |

## 3. GitHub 설정

- **CI**(`.github/workflows/ci.yml`, 작업 이름 `ci`): `pull_request`와 main `push`에서 Ubuntu, Node 24로 `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`를 돌린다.
  - `data/awl.json`이 없으므로 AWL 테스트 2개는 건너뛴다(189 통과 + 2 건너뜀).
  - Gemini 키는 넣지 않는다. 테스트는 SDK를 목으로 쓴다.
- **main 규칙 세트(ruleset):**
  - PR로만 변경한다. 승인 수는 0이다(혼자 쓰는 저장소라 자기 PR을 승인할 수 없다).
  - 상태 검사 `ci` 통과가 필요하다.
  - 강제 push와 삭제를 막는다.
  - 병합 방식은 병합 커밋만 허용한다.
  - 관리자 우회는 두지 않는다. 같은 계정(iwtkmn0219)을 쓰는 PM·Developer에게도 적용된다.
- **저장소 설정:** squash·rebase 병합을 끄고 병합 커밋만 켠다. 병합한 브랜치는 자동으로 지운다.
- `CONTRIBUTING.md`에 이 문서의 1~2장을 짧게 옮기고, README에서 링크한다.

## 4. 범위 밖

- 배포 자동화(CD)와 배포 대상 선택: 배포 마일스톤에서 정한다.
- 자동 버전 도구(release-please, changesets): 릴리스가 마일스톤마다 한 번이라 손으로 한다. 릴리스가 잦아지면 다시 본다.
- 의존성 자동 갱신(Dependabot): 나중에 검토한다.
