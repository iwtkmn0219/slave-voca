# GitHub Flow·버전 관리 설정 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이 PR부터 GitHub Flow로 일한다. 브랜치 → PR → CI → 병합 커밋 → 태그·릴리스. 첫 릴리스 v0.4.0을 내고, 지난 마일스톤에 v0.1.0~v0.3.0 태그를 단다.

**Architecture:** 앱 코드는 바뀌지 않는다. 바뀌거나 새로 생기는 것은 다음과 같다.
- 새 파일: `.github/workflows/ci.yml`, `CHANGELOG.md`, `CONTRIBUTING.md`
- 바뀌는 파일: README 링크 한 줄, `package.json`·`package-lock.json`의 버전
- GitHub 설정: 저장소 병합 설정과 main 규칙 세트(`gh api`)

**Tech Stack:** GitHub Actions(`actions/checkout@v5`, `actions/setup-node@v5`), `gh` CLI(계정 iwtkmn0219, 이미 로그인됨)

**Spec:** `docs/superpowers/specs/2026-10-16-github-flow-versioning-design.md`(사용자 결정. 흐름·버전 규칙·GitHub 설정의 근거)

## Global Constraints

- 이 작업부터 main에 직접 커밋·push하지 않는다. 브랜치는 `chore/github-flow`다.
- **강제 push, 기록 고쳐 쓰기, 저장소 공개 범위 변경은 하지 않는다.**
- **커밋에 넣지 않는 것:**
  - `data/awl.json`(공개 저장소, 라이선스)
  - DB(`data/*.db`)
  - 로그, 스크래치 파일

  `git add` 전에 `git status`로 확인한다.
- 실제 Gemini 호출은 없다. 3000번 포트는 쓰지 않는다.
- 사용자 승인 범위(설계서 1.1): 이 흐름 안의 브랜치 push, PR, 병합, 태그, 릴리스. 처음 push하기 전에 사용자에게 직접 확인하겠다고 했다면 그대로 한 번 확인한다.

## Review Focus

1. CI가 Linux에서 실제로 통과하는지. Windows에서만 돌려 봤으므로 아래를 본다.
   - 경로 대소문자, 줄바꿈
   - `better-sqlite3` 설치
   - `awl.json`이 없을 때 189 통과 + 2 건너뜀인지
2. 규칙 세트가 적용된 뒤 main에 직접 push하면 거절되는지, PR 병합은 되는지.
3. 태그가 설계서 2장의 표대로 맞는 커밋에 달렸는지(`git show --no-patch v0.1.0` 등).
4. 릴리스 노트가 CHANGELOG의 0.4.0 구역과 같은지.
5. `CHANGELOG.md`, `CONTRIBUTING.md`에 `data/awl.json` 내용이나 키가 들어가지 않았는지.

---

### Task 1: CI, 변경 기록, 기여 안내, v0.4.0 (PR #1)

**Files:**
- Create: `.github/workflows/ci.yml`, `CHANGELOG.md`, `CONTRIBUTING.md`
- Modify: `README.md`(링크 한 줄), `package.json`·`package-lock.json`(버전)

- [ ] **Step 1: 브랜치**

```bash
git checkout main
git pull --ff-only
git checkout -b chore/github-flow
```

- [ ] **Step 2: CI**

`.github/workflows/ci.yml`:

```yaml
name: ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    name: ci
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      # data/awl.json은 저장소에 없다(라이선스). AWL 테스트 2개는 건너뛴다.
      - run: npm test
      - run: npm run build
```

- [ ] **Step 3: 변경 기록**

`CHANGELOG.md`:

```markdown
# 변경 기록

이 프로젝트의 눈에 띄는 변경을 적는다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를, 버전은 [유의적 버전](https://semver.org/lang/ko/)을 따른다. 1.0.0 전의 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md)에 있다.

## [Unreleased]

## [0.4.0] - 2026-10-16

### 추가
- 뜻 다시 만들기: 단어 목록의 모든 행, 복습 카드 뒷면의 용례마다, 문서 단위 "모두 다시 시도". 실패하면 원래 뜻을 그대로 둔다.
- 카드 삭제(확인 대화상자).
- 설정 화면: 제외 기준 N, 하루 새 카드 수, 화면 테마(라이트·다크·시스템).
- 복습에서 직전 응답 되돌리기(`Z`), 뒷면을 열 때 발음 자동 재생(처음에는 꺼져 있음).
- UI 개편: 다크 모드, 키보드 조작, 검토 화면 필터·범위 선택, 다음 복습 간격 표시.
- 공개 저장소 준비: README, MIT 라이선스, `.env.example`, 이 변경 기록, CI.

### 바뀜
- 문맥 뜻 모델: Gemini 3.5 Flash-Lite. 학술 논문 문맥 지시를 쓰고, 사고 단계는 LOW다. 50개씩 묶어 최대 5개 묶음을 동시에 보낸다. 틀린 뜻이 줄고 논문 한 편이 약 3초에 채워진다.
- 발음기호는 CMUdict를 먼저 찾고, 없을 때만 사전 API를 쓴다.
- 단어 추출: 원형 처리기가 놓친 복수형(datasets, logits)을 단어마다 단수형으로 바꾼다. 발음 구별 기호 단어(naïve)도 후보로 받는다.
- 검토 화면의 긴 문장은 단어 주변만 짧게 보여 준다.
- 학술 핵심어 목록(AWL)은 저장소에 넣지 않는다. `data/awl.json`이 있을 때만 쓴다(README).

### 고침
- 짧은 단어의 복수형 오병합(lens가 len으로 합쳐짐).
- 뜻 요청의 일시적 실패(429·5xx·네트워크)와 낱자모로 깨진 응답을 다시 시도한다.
- 되돌리기 일시 실패 뒤의 "다시 시도" 버튼, 처리 중 뒷면 열기 잠금, 설정 저장 중 값 변경 처리.

### 업그레이드 시 주의
- DB 마이그레이션이 추가됐다(`drizzle/0004_review_prev_card.sql`). 앱을 실행하면 자동으로 적용된다.
- 이미 저장된 후보·카드·뜻은 바뀌지 않는다. 새 추출·뜻 규칙은 새로 올리는 문서부터 적용된다.

## [0.3.0] - 2026-10-13

### 추가
- 간격 반복 복습(FSRS): 앞면 단어와 발음, 뒷면 발음기호·문맥 뜻·원문 문장. 모름·애매·앎으로 답한다.
- 문서별 단어 목록.

## [0.2.0] - 2026-10-13

### 추가
- 고른 후보를 카드로 저장하고, 아는 단어를 기억한다.
- 원문 문장 기준의 한국어 문맥 뜻(Gemini), 발음기호와 발음 듣기.
- 추출 규칙 보강: 하이픈 합성어, 이메일·URL 제외, 복수형, 사전 확인, 학술 핵심어 예외, 단어 주변 문장 자르기.

## [0.1.0] - 2026-10-13

### 추가
- PDF 업로드, 빈도 기준 후보 단어 추출, 검토 화면.

[Unreleased]: https://github.com/iwtkmn0219/slave-voca/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/iwtkmn0219/slave-voca/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/iwtkmn0219/slave-voca/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/iwtkmn0219/slave-voca/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/iwtkmn0219/slave-voca/releases/tag/v0.1.0
```

- [ ] **Step 4: 기여 안내**

`CONTRIBUTING.md`:

```markdown
# 개발 흐름

[GitHub Flow](https://docs.github.com/ko/get-started/using-github/github-flow)를 따른다. 자세한 근거는 `docs/superpowers/specs/2026-10-16-github-flow-versioning-design.md`에 있다.

## 브랜치와 PR

- `main`은 늘 실행 가능한 상태다. 직접 커밋하지 않고 PR로만 바꾼다(규칙 세트로 막혀 있다).
- 최신 `main`에서 브랜치를 딴다: `feat/…`(기능), `fix/…`(고치기), `docs/…`(문서), `chore/…`(설정·릴리스).
- 커밋 메시지는 Conventional Commits(`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)로 쓴다.
- PR 본문에 무엇을 왜 바꿨는지, 관련 설계서·계획서, 확인 결과를 적는다.
- 병합 조건: CI(`ci`) 통과, 리뷰에서 중요한 지적이 남지 않음.
- 병합은 병합 커밋으로만 한다(squash·rebase 꺼짐). 병합한 브랜치는 자동으로 지워진다.
- 강제 push는 하지 않는다.

## 버전

- [유의적 버전](https://semver.org/lang/ko/). 버전은 `package.json` 한 곳에서 정하고, 태그는 `v0.5.0` 형식이다.
- 1.0.0 전: 마일스톤마다 MINOR(0.5.0), 그 사이 고치기는 PATCH(0.5.1). DB나 설정이 바뀌면 변경 기록의 "업그레이드 시 주의"에 적는다.
- 1.0.0은 처음 배포하는 시점이다.
- 기능 PR은 `CHANGELOG.md`의 `[Unreleased]`에 항목을 적는다.

## 릴리스

1. 마일스톤 PR의 마지막 커밋 `chore(release): vX.Y.Z`에서 `npm version X.Y.Z --no-git-tag-version`을 실행하고, `[Unreleased]`를 `## [X.Y.Z] - YYYY-MM-DD`로 바꾼다. 맨 아래 비교 링크도 고친다.
2. 병합 뒤 main의 병합 커밋에 태그를 단다: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`
3. `gh release create vX.Y.Z --title vX.Y.Z --notes-file notes.md`. `notes.md`에는 변경 기록의 그 버전 구역을 넣고, 커밋하지 않는다.

## 검사

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. CI도 같은 순서로 돌린다.
```

`README.md`의 "## 라이선스" 바로 위에 넣는다.

```markdown
## 개발 흐름과 버전

[CONTRIBUTING.md](CONTRIBUTING.md)와 [CHANGELOG.md](CHANGELOG.md)를 보세요.

```

- [ ] **Step 5: 로컬 검사**

Run:
```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: 오류 없음. 테스트는 30 files, 191 통과(로컬에는 `data/awl.json`이 있음). 빌드 표는 main과 같다.

`data/awl.json`을 잠시 저장소 밖으로 옮기고 `npm test`를 다시 돌린다.
Expected: 189 통과, 2 건너뜀(CI와 같은 상태).

확인한 뒤 파일을 제자리에 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add .github/workflows/ci.yml CHANGELOG.md CONTRIBUTING.md README.md
git commit -m "chore: add CI, changelog and contributing guide for GitHub Flow"
npm version 0.4.0 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore(release): v0.4.0"
```

- [ ] **Step 7: PR과 CI**

```bash
git push -u origin chore/github-flow
gh pr create --base main --title "chore: GitHub Flow, CI, v0.4.0" --body-file <본문 파일>
gh pr checks --watch
```

본문에는 다음을 적는다.
- 설계서·계획서 경로
- 무엇이 생기는지(CI, CHANGELOG, CONTRIBUTING, v0.4.0)
- Step 5의 결과

**CI가 실패하면** 원인을 고친 새 커밋을 같은 브랜치에 push한다. Linux에서만 나는 문제(경로 대소문자 등)면 테스트를 먼저 써서 고친다. 앱 동작을 바꿔야 하는 실패면 멈추고 PM에게 알린다.

이 PR은 앱 코드를 바꾸지 않으므로 Codex 리뷰는 CI 설정과 Review Focus 1·5만 짧게 맡긴다. 지적이 없으면 리뷰 요약을 PR 댓글로 남긴다.

- [ ] **Step 8: 병합**

```bash
gh pr merge --merge --delete-branch
git checkout main
git pull --ff-only
```

---

### Task 2: 저장소 설정과 main 규칙 세트

- [ ] **Step 1: 병합 방식**

```bash
gh api -X PATCH repos/iwtkmn0219/slave-voca -F allow_merge_commit=true -F allow_squash_merge=false -F allow_rebase_merge=false -F delete_branch_on_merge=true
```

- [ ] **Step 2: 규칙 세트**

다음 내용을 저장소 밖 임시 파일(`ruleset.json`)에 쓴다.

```json
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["merge"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "ci" }]
      }
    }
  ]
}
```

```bash
gh api -X POST repos/iwtkmn0219/slave-voca/rulesets --input ruleset.json
```

`bypass_actors`는 넣지 않는다(관리자도 우회하지 않음). API가 `allowed_merge_methods`를 거절하면 그 줄만 빼고 다시 보낸다. 병합 방식은 Step 1의 저장소 설정이 막는다.

- [ ] **Step 3: 확인**

```bash
gh api repos/iwtkmn0219/slave-voca/rules/branches/main --jq '.[].type'
gh api repos/iwtkmn0219/slave-voca --jq '{allow_merge_commit, allow_squash_merge, allow_rebase_merge, delete_branch_on_merge}'
```

Expected:
- 규칙: `deletion`, `non_fast_forward`, `pull_request`, `required_status_checks`
- 설정: 병합 커밋만 true, `delete_branch_on_merge` true

직접 push가 막혔는지 확인한다. 아래 순서를 지킨다.
1. 로컬 main에 빈 커밋을 만든다: `git commit --allow-empty -m "test: direct push should be rejected"`
2. push한다: `git push origin main`. 규칙 위반으로 거절돼야 한다.
3. 확인한 즉시 `git reset --hard origin/main`으로 그 커밋을 지운다. 이 커밋은 push되지 않은 로컬 커밋 하나뿐이다.

---

### Task 3: 태그와 첫 릴리스

- [ ] **Step 1: 지난 마일스톤 태그**

```bash
git tag -a v0.1.0 1c4524c -m "v0.1.0: M1 word extraction"
git tag -a v0.2.0 2f85457 -m "v0.2.0: M2 cards, contextual meanings, phonetics"
git tag -a v0.3.0 2f201e3 -m "v0.3.0: M3 study (FSRS)"
git tag -a v0.4.0 <Task 1 병합 커밋> -m "v0.4.0: UI redesign, meaning improvements, M4, public repo"
git push origin v0.1.0 v0.2.0 v0.3.0 v0.4.0
```

태그를 달기 전에 `git show --no-patch --format='%h %s' <커밋>`으로 메시지를 확인한다.
- `1c4524c`: "Merge branch 'feat/m1-extraction'"
- `2f85457`: "Merge branch 'feat/gemini-meaning'"
- `2f201e3`: "Merge branch 'feat/m3-study'"
- Task 1 병합 커밋: "Merge pull request #1 …"

- [ ] **Step 2: 릴리스**

`CHANGELOG.md`의 `## [0.4.0]` 구역(제목 줄 아래부터 `## [0.3.0]` 앞까지)을 저장소 밖 임시 파일 `notes.md`에 담는다.

```bash
gh release create v0.4.0 --title v0.4.0 --notes-file notes.md --latest
```

v0.1.0~v0.3.0은 태그만 달고 릴리스는 만들지 않는다.

- [ ] **Step 3: 보고**

다음을 PM에게 보낸다.
- PR 번호와 링크, CI 결과(통과한 실행 링크)
- 병합 커밋 해시
- Task 2 Step 3 확인 결과(직접 push 거절 메시지 포함)
- 태그 4개가 가리키는 커밋
- 릴리스 링크
