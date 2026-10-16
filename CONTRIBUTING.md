# 개발 흐름

자세한 근거는 `docs/superpowers/specs/2026-10-16-github-flow-versioning-design.md`에 있다.

## 브랜치

| 브랜치 | 용도 |
|---|---|
| `main` | 배포용(기본 브랜치). 릴리스된 상태만 있고, 릴리스 태그는 여기에만 단다 |
| `development` | 개발 통합. 다음 릴리스에 들어갈 기능이 모인다 |
| `feat/…`, `fix/…`, `docs/…`, `chore/…` | 작업 브랜치. `development`에서 따서 `development`로 PR |
| `hotfix/…` | 배포된 버전의 급한 고치기. `main`에서 따서 `main`으로 PR |

`main`과 `development`는 직접 커밋할 수 없고 PR로만 바뀐다(규칙 세트). 기본 브랜치가 `main`이므로 작업 PR은 반드시 `--base development`로 연다.

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
