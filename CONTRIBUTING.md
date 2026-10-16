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
