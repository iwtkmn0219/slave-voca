# slave-voca 작업 규칙

이 파일은 모든 에이전트(Claude Code, Codex 등)가 함께 따르는 규칙의 원본이다. 답은 한국어로 한다.

- 루트 `CLAUDE.md`(→ `.agents/CLAUDE.md`)와 루트 `AGENTS.md`는 이 파일로 이어 주는 연결이다. 규칙은 여기에만 쓴다.
- Claude만 따로 지킬 것은 `.agents/CLAUDE.md`에 쓴다.

## Next.js

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

- 위 블록은 Next가 만든 안내를 옮겨 둔 것이다.
  - `next.config.ts`의 `agentRules: false` 때문에 `next dev`는 루트 `AGENTS.md`를 더 이상 만들거나 고치지 않는다.
  - 그래서 Next를 올려도 이 블록은 저절로 바뀌지 않는다. **Next를 올릴 때는** `node_modules/next/dist/server/lib/generate-agent-files.js`의 `buildAgentRulesBlock`과 비교해 손으로 맞춘다.
- 위 블록이 말하는 `node_modules/next/dist/docs/`는 저장소 루트 기준이다.

## 역할

- **ProjectManager(PM):** 사용자와 대화해 계획을 세운다. 설계서와 계획서를 쓰고 세션 사이를 조율한다. 제품 코드는 직접 구현하지 않는다.
- **Developer:** 계획서대로 구현한다. 테스트, PR, 리뷰 반영까지 맡는다.
- **Designer:** 화면 구성과 디자인을 모두 정한다.
- 세션끼리는 SendMessage로 이야기한다.

## 다른 역할에게 일을 넘길 때

- **무엇을 하는지만 넘긴다. 어떻게 할지는 맡은 사람이 정한다.**
  - 디자인 방향(톤, 색, 분위기)은 Designer가 정한다.
  - PM이 넘길 것은 "이 앱이 무엇을 하는가"다.
- **Designer에게는 화면에 필요한 '내용'만 넘긴다.** UI 구성은 오로지 Designer에게 맡긴다.
  - 넘기는 것: 화면에 보일 정보, 사용자가 할 수 있는 일, 상태(비었음, 진행 중, 실패 등), 쓰는 상황, 대상 기기 같은 기술 조건
  - 넘기지 않는 것: 버튼 배치·크기, 스크롤 방식, 무엇을 숨길지, 문구 배치 같은 화면 구성. 사용자와 함께 쓰는 설계서에도 쓰지 않는다.
- Developer에게는 설계서와 계획서를 넘긴다. 취향은 넘기지 않는다.

## 브랜치와 릴리스

- **브랜치:** `main`은 배포용이자 GitHub 기본 브랜치다. `development`는 기능 개발을 모으는 통합 브랜치다.
- **작업 PR:** 작업 브랜치(feat/fix/docs/chore)는 origin/development에서 딴다. PR은 **반드시 `--base development`로 연다.** 기본 브랜치가 main이라 이것을 빼먹으면 main으로 열린다.
- **병합:** CI를 통과하고 리뷰에서 중요한 문제가 없을 때 병합 커밋으로 병합한다. 강제 push는 하지 않는다.
- **main 병합 전 검수:** main에 병합하기 전에는 **항상 사용자에게 먼저 검수를 받는다.** 릴리스든 핫픽스든 예외가 없다.
- **버전:** SemVer로 관리하고 CHANGELOG를 쓴다. 자세한 규칙은 `CONTRIBUTING.md`에 있다.
- **묻지 않고 해도 되는 것:** 위 흐름 안의 push, PR, development 병합, 태그, 릴리스
- **그때마다 사용자에게 물을 것:** 기록 고쳐 쓰기, 강제 push, 규칙 세트 변경, 저장소 공개 범위 변경, 실제 배포

## 작업 공간

- `C:\Users\iwtkm\workspace\slave-voca`는 Developer가 쓰는 작업 트리다.
- PM은 별도 worktree `C:\Users\iwtkm\workspace\slave-voca-pm`에서 문서를 고친다.
- 포트 3000은 다른 프로젝트가 쓰므로 쓰지 않는다. 로컬 앱은 3300에서 띄운다. Google 로그인 리디렉션 주소도 3300이다.

## 리뷰

- 코드 리뷰는 Orca에 열려 있는 Codex 터미널("Reviewer | slave-voca")에 맡긴다.

## 공개 저장소와 비밀값

- 저장소는 공개(MIT)이고, 결국 수익화까지 간다.
  - 재배포할 수 없는 데이터는 저장소에 넣지 않는다. AWL은 이 이유로 지웠다.
  - 새 데이터나 라이브러리를 들일 때는 라이선스를 먼저 확인한다.
- `.env.local`의 값(Gemini 키, Google 클라이언트 비밀, `BETTER_AUTH_SECRET` 등)은 출력하지 않는다. 채팅, 커밋, 로그에도 남기지 않는다.
