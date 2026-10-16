# 브랜치·PR 흐름과 버전 관리 설정 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** main은 배포용, development는 개발 통합용으로 나누고, 브랜치 → PR → CI → 병합 커밋 → 릴리스 흐름을 세운다. 첫 릴리스 v0.4.0을 내고, 지난 마일스톤에 v0.1.0~v0.3.0 태그를 단다.

**Architecture:** 앱 코드는 바뀌지 않는다. 바뀌는 것은 세 가지다.
- PR #1(`chore/github-flow` → main, 이미 열려 있음)의 파일: CI, `CHANGELOG.md`, `CONTRIBUTING.md`, README 링크, 버전 0.4.0
- 저장소 설정과 두 브랜치의 규칙 세트(`gh api`)
- 태그와 릴리스

**Tech Stack:** GitHub Actions(`actions/checkout@v5`, `actions/setup-node@v5`), `gh` CLI(계정 iwtkmn0219)

**Spec:** `docs/superpowers/specs/2026-10-16-github-flow-versioning-design.md`(사용자 결정. 브랜치·흐름·버전 규칙·GitHub 설정의 근거)

## Global Constraints

- **강제 push, 기록 고쳐 쓰기, 저장소 공개 범위 변경은 하지 않는다.**
- **커밋에 넣지 않는 것:**
  - `data/awl.json`(공개 저장소, 라이선스)
  - DB(`data/*.db`)
  - 로그, 스크래치 파일
  - `ruleset.json`, `notes.md`

  `git add` 전에 `git status`로 확인한다.
- 실제 Gemini 호출은 없다. 3000번 포트는 쓰지 않는다.
- PM은 `C:\Users\iwtkm\workspace\slave-voca-pm` worktree에서 일한다. 원래 폴더의 브랜치는 Developer가 정한다.

## Review Focus

1. CI가 Linux에서 실제로 통과하는지. Windows에서만 돌려 봤으므로 아래를 본다.
   - 경로 대소문자, 줄바꿈
   - `better-sqlite3` 설치
   - `awl.json`이 없을 때 189 통과 + 2 건너뜀인지
2. 규칙 세트가 적용된 뒤 main·development 모두 직접 push가 거절되는지, PR 병합은 되는지.
3. 기본 브랜치가 development인지, `gh pr create`에서 `--base`를 빼면 development를 향하는지.
4. 태그가 설계서 3장 표대로 맞는 커밋에 달렸는지(`git show --no-patch v0.1.0` 등). 태그는 모두 main의 기록 안에 있다.
5. 릴리스 노트가 CHANGELOG의 0.4.0 구역과 같고, 어떤 파일에도 `data/awl.json` 내용이나 키가 없는지.

---

### Task 1: PR #1 마무리(새 흐름 반영) → main 병합

PR #1의 기존 커밋(CI, CHANGELOG, CONTRIBUTING, README, `chore(release): v0.4.0`)은 그대로 둔다. 그 위에 커밋 하나를 더해 development 흐름을 반영한다.

- [ ] **Step 1: CI가 development push에서도 돌게**

`.github/workflows/ci.yml`의 `push` 부분을 바꾼다.

```yaml
  push:
    branches: [main, development]
```

- [ ] **Step 2: CONTRIBUTING.md 교체**

`CONTRIBUTING.md` 전체를 아래로 바꾼다.

```markdown
# 개발 흐름

자세한 근거는 `docs/superpowers/specs/2026-10-16-github-flow-versioning-design.md`에 있다.

## 브랜치

| 브랜치 | 용도 |
|---|---|
| `main` | 배포용. 릴리스된 상태만 있고, 릴리스 태그는 여기에만 단다 |
| `development` | 개발 통합(기본 브랜치). 다음 릴리스에 들어갈 기능이 모인다 |
| `feat/…`, `fix/…`, `docs/…`, `chore/…` | 작업 브랜치. `development`에서 따서 `development`로 PR |
| `hotfix/…` | 배포된 버전의 급한 고치기. `main`에서 따서 `main`으로 PR |

`main`과 `development`는 직접 커밋할 수 없고 PR로만 바뀐다(규칙 세트).

## PR

- 커밋 메시지는 Conventional Commits(`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)로 쓴다.
- `gh pr create --base development`. 본문에 무엇을 왜 바꿨는지, 관련 설계서·계획서, 확인 결과를 적는다.
- 기능 PR은 `CHANGELOG.md`의 `[Unreleased]`에 항목을 적는다.
- 병합 조건: CI(`ci`) 통과, 리뷰에서 중요한 지적이 남지 않음.
- 병합은 병합 커밋으로만 한다(squash·rebase 꺼짐). 병합한 작업 브랜치는 지운다.
- 강제 push는 하지 않는다.

## 버전

- [유의적 버전](https://semver.org/lang/ko/). 버전은 `package.json` 한 곳에서 정하고, 태그는 `v0.5.0` 형식이다.
- 1.0.0 전: 새 기능이 있는 릴리스는 MINOR(0.5.0), 고치기만 있는 릴리스와 핫픽스는 PATCH(0.5.1). DB나 설정이 바뀌면 변경 기록의 "업그레이드 시 주의"에 적는다.
- 1.0.0은 처음 배포하는 시점이다.

## 릴리스(development → main)

1. `development`에서 `chore/release-vX.Y.Z`를 딴다.
   - `npm version X.Y.Z --no-git-tag-version`을 실행한다.
   - `CHANGELOG.md`의 `[Unreleased]`를 `## [X.Y.Z] - YYYY-MM-DD`로 바꾸고, 맨 아래 비교 링크를 고친다.
   - `chore(release): vX.Y.Z`로 커밋해 `development`에 PR·병합한다.
2. `gh pr create --base main --head development --title "release: vX.Y.Z"`로 PR을 연다. CI가 통과하면 저장소 주인의 검수를 받은 뒤 병합 커밋으로 병합한다(`--delete-branch` 없이).
3. main의 그 병합 커밋에 태그를 단다: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`
4. `gh release create vX.Y.Z --title vX.Y.Z --notes-file notes.md`. `notes.md`에는 변경 기록의 그 버전 구역을 넣고, 커밋하지 않는다.

## 핫픽스

1. `main`에서 `hotfix/…`를 딴다. 고치는 커밋과 `chore(release): vX.Y.Z`(PATCH) 커밋을 넣는다.
2. `--base main`으로 PR을 열어 병합하고, 태그·릴리스를 만든다(릴리스 3·4단계).
3. `gh pr create --base development --head main --title "chore: bring vX.Y.Z back to development"`로 고친 내용을 development에 들인다.

## 검사

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. CI도 같은 순서로 돌린다.
```

- [ ] **Step 3: 커밋, push, CI**

```bash
git add .github/workflows/ci.yml CONTRIBUTING.md
git commit -m "docs: describe the development branch flow"
git push
gh pr checks 1 --watch
```

PR #1 본문 끝에 한 줄을 덧붙인다(`gh pr edit 1 --body-file …`). 내용: "이 PR은 development를 만들기 전의 첫 릴리스(v0.4.0)라 예외로 main에 바로 병합한다."

CI가 실패하면 원인을 고친 새 커밋을 push한다. 앱 동작을 바꿔야 하는 실패면 멈추고 PM에게 알린다. 이 PR은 앱 코드를 바꾸지 않으므로 Codex 리뷰는 CI 설정과 Review Focus 1·5만 짧게 맡기고, 요약을 PR 댓글로 남긴다.

- [ ] **Step 4: 사용자 검수 후 병합**

main으로 가는 병합이므로 먼저 사용자에게 검수를 받는다(설계서 2.1). 사용자에게 보일 것:
- PR #1 링크
- CI 결과
- Codex 리뷰 요약
- 변경 기록의 0.4.0 구역

승인을 받은 다음에 병합한다.

```bash
gh pr merge 1 --merge --delete-branch
git checkout main
git pull --ff-only
```

---

### Task 2: development 브랜치와 저장소 설정

- [ ] **Step 1: development 만들기**

```bash
git fetch origin
git push origin origin/main:refs/heads/development
git checkout -b development --track origin/development
```

Expected: `git rev-parse origin/development`가 PR #1 병합 커밋과 같다.

- [ ] **Step 2: 기본 브랜치와 병합 방식**

```bash
gh api -X PATCH repos/iwtkmn0219/slave-voca -f default_branch=development -F allow_merge_commit=true -F allow_squash_merge=false -F allow_rebase_merge=false -F delete_branch_on_merge=true
git remote set-head origin --auto
```

---

### Task 3: 규칙 세트(main·development)

- [ ] **Step 1: 규칙 세트**

다음 내용을 저장소 밖 임시 파일(`ruleset.json`)에 쓴다.

```json
{
  "name": "main and development",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main", "refs/heads/development"], "exclude": [] } },
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

`bypass_actors`는 넣지 않는다(관리자도 우회하지 않음). API가 `allowed_merge_methods`를 거절하면 그 줄만 빼고 다시 보낸다. 병합 방식은 Task 2의 저장소 설정이 막는다.

- [ ] **Step 2: 확인**

```bash
gh api repos/iwtkmn0219/slave-voca/rules/branches/main --jq '.[].type'
gh api repos/iwtkmn0219/slave-voca/rules/branches/development --jq '.[].type'
gh api repos/iwtkmn0219/slave-voca --jq '{default_branch, allow_merge_commit, allow_squash_merge, allow_rebase_merge, delete_branch_on_merge}'
```

Expected:
- 두 브랜치 모두 규칙: `deletion`, `non_fast_forward`, `pull_request`, `required_status_checks`
- 설정: `default_branch` development, 병합 커밋만 true, `delete_branch_on_merge` true

직접 push가 막혔는지 두 브랜치에서 각각 확인한다(development 먼저, 그다음 main).
1. 그 브랜치를 체크아웃하고 빈 커밋을 만든다: `git commit --allow-empty -m "test: direct push should be rejected"`
2. push한다: `git push origin <브랜치>`. 규칙 위반으로 거절돼야 한다.
3. 확인한 즉시 `git reset --hard origin/<브랜치>`로 그 커밋을 지운다. 이 커밋은 push되지 않은 로컬 커밋 하나뿐이다.

---

### Task 4: 태그와 첫 릴리스

- [ ] **Step 1: 지난 마일스톤 태그**

태그를 달기 전에 `git show --no-patch --format='%h %s' <커밋>`으로 메시지를 확인한다.
- `1c4524c`: "Merge branch 'feat/m1-extraction'"
- `2f85457`: "Merge branch 'feat/gemini-meaning'"
- `2f201e3`: "Merge branch 'feat/m3-study'"
- PR #1 병합 커밋: "Merge pull request #1 …"

```bash
git tag -a v0.1.0 1c4524c -m "v0.1.0: M1 word extraction"
git tag -a v0.2.0 2f85457 -m "v0.2.0: M2 cards, contextual meanings, phonetics"
git tag -a v0.3.0 2f201e3 -m "v0.3.0: M3 study (FSRS)"
git tag -a v0.4.0 <PR #1 병합 커밋> -m "v0.4.0: UI redesign, meaning improvements, M4, public repo"
git push origin v0.1.0 v0.2.0 v0.3.0 v0.4.0
```

- [ ] **Step 2: 릴리스**

`CHANGELOG.md`의 `## [0.4.0]` 구역(제목 줄 아래부터 `## [0.3.0]` 앞까지)을 저장소 밖 임시 파일 `notes.md`에 담는다.

```bash
gh release create v0.4.0 --title v0.4.0 --notes-file notes.md --latest
```

v0.1.0~v0.3.0은 태그만 달고 릴리스는 만들지 않는다.

- [ ] **Step 3: 보고**

다음을 PM에게 보낸다.
- PR #1 링크와 CI 실행 링크
- 병합 커밋 해시
- development가 가리키는 커밋
- Task 3 Step 2 확인 결과(두 브랜치의 직접 push 거절 메시지 포함)
- 태그 4개가 가리키는 커밋
- 릴리스 링크

이후 PM이 이 설계서·계획서의 갱신본(`docs/development-branch` 브랜치)을 development로 PR·병합한다. 새 흐름의 첫 문서 PR이다.
