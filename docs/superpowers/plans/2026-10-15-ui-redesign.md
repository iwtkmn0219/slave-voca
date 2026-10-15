# UI 개편 (A안 「지면」) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 UI 개편안(A안 「지면」)을 모든 화면에 적용한다. 범위는 디자인 토큰, 글꼴(한글 Pretendard, 영어·IPA Gentium), 다크 모드, 공통 부품, 키보드 조작이다. 함께 승인된 기능도 넣는다: 검토 필터 칩과 Shift 범위 선택, 답 버튼의 다음 복습 간격, 문서별 단어 수·뜻 실패 수, 메뉴의 오늘 남은 수, 완료 화면 통계와 곧 다시 볼 카드 안내.

**Architecture:** 색은 `globals.css`의 CSS 변수(라이트·다크 값)와 Tailwind 4 `@theme inline`으로만 정의하고, 컴포넌트는 `bg-surface text-ink` 같은 토큰 클래스만 쓴다(`dark:` 변형 없음). 공통 부품은 `src/components/ui/`에 직접 만든다(컴포넌트 라이브러리 없음). 키보드 판단, 선택·필터, 간격 미리보기처럼 판단이 들어가는 로직은 `src/lib/`의 순수 함수로 빼서 테스트한다. 화면 구조·데이터·흐름은 그대로다.

**Tech Stack:** 기존 스택 + `pretendard` 1.3.9(OFL, `next/font/local`), Gentium Book Plus(`next/font/google`, `latin`·`latin-ext`·`greek` 하위 집합)

**Spec:** `docs/superpowers/specs/2026-10-15-ui-redesign.md`(승인됨, 3장 토큰, 4장 부품, 5장 화면, 6장 단축키, 7장 상태 표시, 9장 결정 표). 목업은 `docs/superpowers/mockups/a-paper.html`이다.

## Global Constraints

- 작업 브랜치: `feat/ui-redesign` (main에서 분기). 각 태스크 끝에 커밋한다.
- 색은 토큰만 쓴다. `bg-white`, `bg-black`, `text-gray-*`, `bg-blue-*`, `bg-yellow-*`, `text-red-*` 같은 Tailwind 기본 색과 `dark:` 변형을 쓰지 않는다(Task 8에서 grep으로 확인).
- 글꼴: UI·한글은 `font-sans`(Pretendard), 영어 단어·원문 문장·IPA·문서 제목은 `font-en`(Gentium). Gentium은 400·700뿐이라 영어에 600을 쓰지 않는다.
- 빨강·노랑(again·hard)은 점, 선, 글자에만 쓰고 넓은 면을 칠하지 않는다. 예외는 복습 답 버튼의 옅은 바탕이다.
- 한 글자 단축키는 입력칸(텍스트 입력, textarea, select)에서는 끈다. 포커스된 버튼·체크박스 위의 Space·Enter는 브라우저 기본 동작에 맡긴다(`src/lib/ui/keys.ts`).
- Next.js 16 `cacheComponents`: `usePathname()` 같은 요청 시점 훅을 쓰는 클라이언트 컴포넌트도 `<Suspense>` 안에 둔다. 안 그러면 `next build`가 실패한다(작성 중 실제로 겪음).
- `next/font/google`은 빌드할 때 글꼴을 내려받는다. 첫 빌드에는 네트워크가 필요하다.

## Review Focus

1. 다크 모드 누락: 개편 전에는 시스템이 다크면 배지·안내 상자·주 버튼이 안 보였다. 토큰 밖의 색이 하나라도 남으면 다시 생긴다(Task 8 grep + 다크 스크린샷).
2. 숫자 앞뒤가 벌어지는 문제: `inline-flex gap-*` 안에 글자와 `{숫자}`를 바로 넣으면 각 조각이 flex 항목이 되어 "뜻  206  개"처럼 벌어진다. `Status`·`Failed`는 글자를 `<span>` 하나로 감싸고, `Notice`는 flex가 아닌 문단이다(작성 중 실제로 겪음, Task 1 부품 코드에 반영됨).
3. 키보드 이중 처리: 포커스된 버튼이나 체크박스 위에서 Space를 누르면 브라우저 클릭과 단축키가 함께 실행될 수 있다(Task 2 `isNativeSpaceTarget` 테스트, Task 8 확인).
4. "모름"으로 큐 뒤에 다시 넣은 카드의 답 버튼 간격: 처음 받은 미리보기가 아니라 응답 뒤 상태의 미리보기를 보여야 한다(Task 3 `recordAnswer`가 돌려주는 intervals, Task 4에서 교체).
5. θ 같은 그리스 문자 IPA: Gentium을 `greek` 하위 집합 없이 불러오면 θ만 다른 글꼴로 나온다(Task 1 layout, Task 8 화면 확인).

---

## 파일 구조

| 파일 | 책임 | 태스크 |
|---|---|---|
| `src/app/globals.css` | 토큰(라이트·다크·`data-theme`), `@theme`, 형광펜, 포커스 링, 애니메이션 | 1 |
| `src/components/ui/{button.ts,kbd,tag,status,notice,highlighted}.tsx` | 공통 부품 | 1 |
| `src/components/nav/nav-links.tsx`, `src/app/layout.tsx` | 글꼴, 상단 바, 현재 위치, 오늘 남은 수 배지 | 1 |
| `src/lib/srs/interval.ts` | 응답별 다음 복습 간격 미리보기, 간격 글자 | 2 |
| `src/lib/review/selection.ts` | 검토 필터, 개수, Shift 범위 선택 | 2 |
| `src/lib/ui/keys.ts` | 단축키를 끌 대상 판단 | 2 |
| `src/server/repo/study.ts`, `src/server/repo/cards.ts` | 카드별 간격, 응답 뒤 간격, 문서별 뜻 실패 수 | 3 |
| `src/app/study/*` | 복습 화면 | 4 |
| `src/app/documents/[id]/review/*` | 검토 화면 | 5 |
| `src/components/document-status.tsx`, `src/app/documents/*`, `src/app/documents/[id]/page.tsx` | 문서 목록, 업로드, 문서 단어 목록 | 6 |
| `src/app/page.tsx`, `src/components/start-study-button.tsx` | 홈 | 7 |

테스트 수: 시작 123 → Task 2 후 134 → Task 3 후 135. UI 태스크(1, 4~7)는 typecheck·lint·build와 Task 8의 브라우저 확인으로 검증한다(이 프로젝트에는 컴포넌트 테스트 환경이 없다).

---

### Task 1: 토큰, 글꼴, 공통 부품, 레이아웃

**Files:**
- Modify: `src/app/globals.css`(전체 교체), `src/app/layout.tsx`(전체 교체), `package.json`
- Create: `src/components/ui/button.ts`, `src/components/ui/kbd.tsx`, `src/components/ui/tag.tsx`, `src/components/ui/status.tsx`, `src/components/ui/notice.tsx`, `src/components/ui/highlighted.tsx`, `src/components/nav/nav-links.tsx`

**Interfaces:**
- Produces: `buttonClass({ variant?, size? }, extra?)`, `<Kbd onAccent?>`, `<Tag kind="learning"|"nodict"|"new">`, `<Status tone="ok"|"wait"|"busy"|"err"|"idle">`, `<Spinner>`, `<Failed>`, `<Notice>`, `<Highlighted sentence word>`, `<NavLinks studyBadge>`, `<NavLinksFallback>`
- Tailwind 토큰 클래스: `bg|text|border-{bg,surface,sunken,line,line-strong,ink,ink-2,muted,faint,accent,accent-hover,accent-soft,on-accent,mark,again,again-soft,hard,hard-soft,good,good-soft}`, `shadow-1`, `shadow-2`, `rounded-sm|md|lg`, `font-sans`, `font-en`

- [ ] **Step 1: 브랜치와 글꼴 패키지**

```bash
git checkout main
git checkout -b feat/ui-redesign
npm i --save-exact pretendard@1.3.9
```

- [ ] **Step 2: 토큰** — `src/app/globals.css` 전체

```css
@import "tailwindcss";

/* 디자인 토큰: docs/superpowers/specs/2026-10-15-ui-redesign.md 3장 (A안 「지면」).
   컴포넌트는 dark: 변형을 쓰지 않고 이 변수만 쓴다. 테마는 변수 값만 바꾼다. */
:root {
  --bg: #f4f1ea;
  --surface: #fbfaf7;
  --sunken: #eeeae1;
  --line: #e2ddd2;
  --line-strong: #cec7b8;
  --ink: #22201c;
  --ink-2: #4a463f;
  --muted: #6e685e;
  --faint: #857e72;
  --accent: #2f5d8c;
  --accent-hover: #264d75;
  --accent-soft: #e6edf5;
  --on-accent: #ffffff;
  --mark: #f0db8c;
  --again: #a6463b;
  --again-soft: #f5e3df;
  --hard: #7f5a0c;
  --hard-soft: #f3e9d0;
  --good: #3b7150;
  --good-soft: #e0eee4;
  --shadow-1: 0 1px 2px rgb(34 32 28 / 0.06), 0 1px 1px rgb(34 32 28 / 0.04);
  --shadow-2: 0 4px 16px rgb(34 32 28 / 0.08), 0 1px 3px rgb(34 32 28 / 0.06);
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #171614;
    --surface: #1f1e1b;
    --sunken: #141311;
    --line: #2f2d29;
    --line-strong: #403d37;
    --ink: #ece7dd;
    --ink-2: #cfc9bd;
    --muted: #a29b8e;
    --faint: #807a70;
    --accent: #8db4de;
    --accent-hover: #a7c6e8;
    --accent-soft: #223041;
    --on-accent: #10161e;
    --mark: rgb(222 178 64 / 0.32);
    --again: #e08a7e;
    --again-soft: #3a2421;
    --hard: #d9b45e;
    --hard-soft: #352b16;
    --good: #8cc79c;
    --good-soft: #1e3225;
    --shadow-1: 0 1px 2px rgb(0 0 0 / 0.4);
    --shadow-2: 0 6px 20px rgb(0 0 0 / 0.45);
    color-scheme: dark;
  }
}

/* M4 설정 화면의 테마 선택용. 위 다크 값과 같다. */
:root[data-theme="dark"] {
  --bg: #171614;
  --surface: #1f1e1b;
  --sunken: #141311;
  --line: #2f2d29;
  --line-strong: #403d37;
  --ink: #ece7dd;
  --ink-2: #cfc9bd;
  --muted: #a29b8e;
  --faint: #807a70;
  --accent: #8db4de;
  --accent-hover: #a7c6e8;
  --accent-soft: #223041;
  --on-accent: #10161e;
  --mark: rgb(222 178 64 / 0.32);
  --again: #e08a7e;
  --again-soft: #3a2421;
  --hard: #d9b45e;
  --hard-soft: #352b16;
  --good: #8cc79c;
  --good-soft: #1e3225;
  --shadow-1: 0 1px 2px rgb(0 0 0 / 0.4);
  --shadow-2: 0 6px 20px rgb(0 0 0 / 0.45);
  color-scheme: dark;
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-sunken: var(--sunken);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-muted: var(--muted);
  --color-faint: var(--faint);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-soft: var(--accent-soft);
  --color-on-accent: var(--on-accent);
  --color-mark: var(--mark);
  --color-again: var(--again);
  --color-again-soft: var(--again-soft);
  --color-hard: var(--hard);
  --color-hard-soft: var(--hard-soft);
  --color-good: var(--good);
  --color-good-soft: var(--good-soft);
  --shadow-1: var(--shadow-1);
  --shadow-2: var(--shadow-2);
  --radius-sm: 4px;
  --radius-md: 7px;
  --radius-lg: 10px;
  /* 한글·UI는 Pretendard, 영어 단어·원문·IPA는 Gentium(제안서 1장: IPA 18자 검증). ᵻ 같은 드문 기호는 Noto로 넘긴다 */
  --font-sans: var(--font-pretendard), system-ui, sans-serif;
  --font-en: var(--font-gentium), "Noto Serif", Georgia, serif;
}

body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.6;
  word-break: keep-all;
  -webkit-font-smoothing: antialiased;
}

/* 원문 속 단어: 글자 아래 45%만 칠하는 형광펜 */
mark {
  background: linear-gradient(transparent 55%, var(--mark) 55%);
  color: inherit;
  padding: 0 1px;
  font-weight: 700;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 실제 진행률이 없는 처리 중 막대: 왕복 */
@keyframes indeterminate {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(250%);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 3: 공통 부품**

`src/components/ui/button.ts`:

```ts
// 버튼과 버튼처럼 보이는 링크가 같은 모양을 쓰도록 클래스만 만든다.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-accent bg-accent text-on-accent hover:bg-accent-hover hover:border-accent-hover",
  secondary: "border-line-strong bg-surface text-ink hover:bg-sunken",
  ghost: "border-transparent bg-transparent text-ink-2 hover:bg-sunken",
  danger: "border-again bg-again text-on-accent",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-[13px]",
  md: "px-3.5 py-2 text-sm",
};

export function buttonClass(
  { variant = "secondary", size = "md" }: { variant?: ButtonVariant; size?: ButtonSize } = {},
  extra = "",
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim();
}
```

`src/components/ui/kbd.tsx`:

```tsx
// 단축키 표시. onAccent면 주 버튼 안에서 버튼 글자색을 따른다.
export function Kbd({ children, onAccent = false }: { children: React.ReactNode; onAccent?: boolean }) {
  const tone = onAccent
    ? "border-on-accent/45 bg-transparent text-on-accent"
    : "border-line-strong bg-surface text-muted";
  return (
    <kbd
      className={`rounded-sm border border-b-2 px-[5px] py-[2px] font-sans text-[11px] leading-none font-medium ${tone}`}
    >
      {children}
    </kbd>
  );
}
```

`src/components/ui/tag.tsx`:

```tsx
// 배지. "이미 학습 중"(정보)과 "새 카드"는 칠하고, "사전에 없음"(의심)은 점선 테두리만 둔다.
export type TagKind = "learning" | "nodict" | "new";

const STYLES: Record<TagKind, string> = {
  learning: "border-transparent bg-accent-soft text-accent",
  nodict: "border-dashed border-line-strong text-muted",
  new: "border-transparent bg-good-soft text-good",
};

const LABELS: Record<TagKind, string> = {
  learning: "이미 학습 중",
  nodict: "사전에 없음",
  new: "새 카드",
};

export function Tag({ kind }: { kind: TagKind }) {
  return (
    <span
      className={`rounded-sm border px-1.5 py-px font-sans text-[11.5px] font-semibold whitespace-nowrap ${STYLES[kind]}`}
    >
      {LABELS[kind]}
    </span>
  );
}
```

`src/components/ui/status.tsx`:

```tsx
// 상태 표시: 점(또는 회전 고리) + 글자. 넓은 면을 칠하지 않는다(제안서 7장).
export type StatusTone = "ok" | "wait" | "busy" | "err" | "idle";

const DOT: Record<Exclude<StatusTone, "busy">, string> = {
  ok: "bg-good",
  wait: "bg-accent",
  err: "bg-again",
  idle: "bg-faint",
};

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-[9px] animate-[spin_1s_linear_infinite] rounded-full border-[1.5px] border-accent border-r-transparent ${className}`}
    />
  );
}

export function Status({
  tone,
  children,
  className = "",
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-2 ${className}`}>
      {tone === "busy" ? (
        <Spinner />
      ) : (
        <span aria-hidden className={`size-[7px] rounded-full ${DOT[tone]}`} />
      )}
      <span>{children}</span>
    </span>
  );
}

// 뜻 생성 실패 같은 흔한 실패: 짧은 점선 + 회색 글자.
// 글자는 span 하나로 감싼다. 그러지 않으면 flex gap이 숫자 앞뒤에 끼어 "뜻  206  개"처럼 벌어진다.
export function Failed({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      <span aria-hidden className="w-2.5 border-t-[1.5px] border-dashed border-again" />
      <span>{children}</span>
    </span>
  );
}
```

`src/components/ui/notice.tsx`:

```tsx
// 화면 단위 안내 한 줄: 왼쪽 색 줄 + 면 색 바탕. 화면 전체를 경고색으로 칠하지 않는다.
// 글자와 숫자·링크가 한 문장으로 이어지도록 flex가 아닌 일반 문단으로 둔다.
export function Notice({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      role="status"
      className={`rounded-r-md border-l-[3px] border-hard bg-surface px-3.5 py-2.5 text-[13px] text-ink-2 [&_a]:ml-1.5 ${className}`}
    >
      {children}
    </p>
  );
}
```

`src/components/ui/highlighted.tsx`:

```tsx
import { highlight } from "@/lib/text/highlight";

// 원문 문장에서 단어를 형광펜(<mark>)으로 표시한다. 글꼴은 부모(font-en)를 따른다.
export function Highlighted({ sentence, word }: { sentence: string; word: string }) {
  return (
    <>
      {highlight(sentence, word).map((seg, i) =>
        seg.match ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>,
      )}
    </>
  );
}
```

- [ ] **Step 4: 내비게이션과 레이아웃**

`src/components/nav/nav-links.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "홈", match: (p: string) => p === "/" },
  { href: "/study", label: "복습", match: (p: string) => p.startsWith("/study") },
  { href: "/documents", label: "문서", match: (p: string) => p.startsWith("/documents") },
];

function Links({ pathname, studyBadge }: { pathname: string | null; studyBadge: React.ReactNode }) {
  return (
    <>
      {LINKS.map((link) => {
        const active = pathname !== null && link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
              active ? "bg-sunken font-semibold text-ink" : "text-ink-2 hover:bg-sunken"
            }`}
          >
            {link.label}
            {link.href === "/study" && studyBadge}
          </Link>
        );
      })}
    </>
  );
}

// 현재 위치는 sunken 바탕 + 굵은 글씨. 복습 옆에는 오늘 남은 카드 수(서버에서 받은 배지)를 둔다.
export function NavLinks({ studyBadge }: { studyBadge: React.ReactNode }) {
  return <Links pathname={usePathname()} studyBadge={studyBadge} />;
}

// usePathname은 요청 시점 값이라 <Suspense> 안에서만 쓸 수 있다(cacheComponents). 그 전까지 보여 줄 같은 모양.
export function NavLinksFallback() {
  return <Links pathname={null} studyBadge={null} />;
}
```

`src/app/layout.tsx` 전체. 페이지 폭 래퍼(`max-w-5xl`)는 빼고, 페이지마다 정한다.

```tsx
import type { Metadata } from "next";
import { Gentium_Book_Plus } from "next/font/google";
import localFont from "next/font/local";
import { connection } from "next/server";
import { Suspense } from "react";
import { NavLinks, NavLinksFallback } from "@/components/nav/nav-links";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/repo/settings";
import { countStudyToday } from "@/server/repo/study";
import "./globals.css";

// 한글·UI. Google Fonts에 없어 npm 패키지의 가변 글꼴을 직접 올린다(약 2MB, 배포 시 subset 검토).
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

// 영어 단어·원문·IPA. θ(그리스 문자) 때문에 greek 하위 집합이 꼭 필요하다(제안서 1장).
const gentium = Gentium_Book_Plus({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin", "latin-ext", "greek"],
  variable: "--font-gentium",
  display: "swap",
});

export const metadata: Metadata = {
  title: "slave-voca",
  description: "논문·발표 자료 단어장",
};

async function TodayBadge() {
  await connection();
  const db = getDb();
  const { review, fresh } = countStudyToday(db, new Date(), getSettings(db).dailyNewLimit);
  const total = review + fresh;
  if (total === 0) return null;
  return <span className="text-xs font-semibold text-accent tabular-nums">{total}</span>;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${gentium.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <nav className="flex h-[52px] items-center gap-1 border-b border-line bg-surface px-6">
          <span className="mr-5 text-[13px] font-semibold tracking-[0.02em] text-muted">slave-voca</span>
          <Suspense fallback={<NavLinksFallback />}>
            <NavLinks
              studyBadge={
                <Suspense fallback={null}>
                  <TodayBadge />
                </Suspense>
              }
            />
          </Suspense>
        </nav>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: 확인과 커밋**

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: 모두 통과. 이 시점에는 페이지들이 아직 옛 클래스를 쓰고 있어서 화면이 섞여 보이는 것이 정상이다. 테스트는 그대로 123개다.

```bash
git add -A
git commit -m "feat: add design tokens, fonts, shared UI parts and navigation"
```

---

### Task 2: 간격 미리보기, 검토 선택, 단축키 판단 (순수 함수)

**Files:**
- Create: `src/lib/srs/interval.ts`, `src/lib/review/selection.ts`, `src/lib/ui/keys.ts`
- Test: `tests/lib/srs/interval.test.ts`, `tests/lib/review/selection.test.ts`, `tests/lib/ui/keys.test.ts`

**Interfaces:**
- Produces:

```ts
type Intervals = Record<Answer, number>  // ms
previewIntervals(state: SrsState, now: Date): Intervals
formatInterval(ms: number): string        // "10분", "3시간", "2일", "2개월", "1년"
type ReviewFilter = 'all' | 'learning' | 'nodict' | 'off'
interface SelectableCandidate { id: number; isExisting: boolean; inDictionary: boolean }
matchesFilter(c, filter, selected): boolean
filterCounts(list, selected): Record<ReviewFilter, number>
selectRange(selected, visibleIds, anchorId, targetId): Set<number>
toggleOne(selected, id): Set<number>
isTypingTarget(target): boolean           // 텍스트 입력류만 true (체크박스·버튼은 false)
isNativeSpaceTarget(target): boolean      // Space·Enter가 이미 누르는 버튼·체크박스
```

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/lib/srs/interval.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatInterval, previewIntervals } from '@/lib/srs/interval';
import { applyAnswer, type SrsState } from '@/lib/srs/scheduler';

const now = new Date('2026-10-15T10:00:00Z');
const fresh: SrsState = {
  due: new Date(0),
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  learningSteps: 0,
  reps: 0,
  lapses: 0,
  state: 0,
  lastReview: null,
};

describe('previewIntervals', () => {
  it('matches what applyAnswer would schedule for each answer', () => {
    const preview = previewIntervals(fresh, now);
    for (const answer of ['again', 'hard', 'good'] as const) {
      expect(preview[answer]).toBe(applyAnswer(fresh, answer, now).due.getTime() - now.getTime());
    }
    expect(preview.again).toBeLessThanOrEqual(preview.hard);
    expect(preview.hard).toBeLessThanOrEqual(preview.good);
  });

  it('does not change the card it previews', () => {
    const copy = { ...fresh };
    previewIntervals(fresh, now);
    expect(fresh).toEqual(copy);
  });
});

describe('formatInterval', () => {
  it('uses the largest whole unit', () => {
    expect(formatInterval(0)).toBe('1분');
    expect(formatInterval(10 * 60_000)).toBe('10분');
    expect(formatInterval(3 * 3_600_000)).toBe('3시간');
    expect(formatInterval(86_400_000)).toBe('1일');
    expect(formatInterval(45 * 86_400_000)).toBe('2개월');
    expect(formatInterval(800 * 86_400_000)).toBe('2년');
  });
});
```

`tests/lib/review/selection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  filterCounts,
  matchesFilter,
  selectRange,
  toggleOne,
  type SelectableCandidate,
} from '@/lib/review/selection';

const list: SelectableCandidate[] = [
  { id: 1, isExisting: false, inDictionary: true },
  { id: 2, isExisting: true, inDictionary: true },
  { id: 3, isExisting: false, inDictionary: false },
  { id: 4, isExisting: false, inDictionary: true },
];

describe('matchesFilter and filterCounts', () => {
  it('filters by learning, not-in-dictionary and unselected', () => {
    const selected = new Set([1, 2, 4]);
    const ids = (f: Parameters<typeof matchesFilter>[1]) =>
      list.filter((c) => matchesFilter(c, f, selected)).map((c) => c.id);
    expect(ids('all')).toEqual([1, 2, 3, 4]);
    expect(ids('learning')).toEqual([2]);
    expect(ids('nodict')).toEqual([3]);
    expect(ids('off')).toEqual([3]);
    expect(filterCounts(list, selected)).toEqual({ all: 4, learning: 1, nodict: 1, off: 1 });
  });
});

describe('selectRange', () => {
  it('sets every row between anchor and target to the target new state', () => {
    const selected = new Set([1, 2, 4]);
    expect([...selectRange(selected, [1, 2, 3, 4], 1, 3)].sort()).toEqual([1, 2, 3, 4]);
    // 2는 이미 선택돼 있으므로 2~4 전체를 해제한다
    expect([...selectRange(selected, [1, 2, 3, 4], 4, 2)].sort()).toEqual([1]);
  });

  it('only uses rows that are visible, in visible order', () => {
    const selected = new Set<number>();
    expect([...selectRange(selected, [4, 2], 4, 2)].sort()).toEqual([2, 4]);
  });

  it('falls back to toggling the target when the anchor is not visible', () => {
    expect([...selectRange(new Set([1]), [2, 3], 1, 3)].sort()).toEqual([1, 3]);
  });
});

describe('toggleOne', () => {
  it('flips one id without mutating the input', () => {
    const selected = new Set([1]);
    expect([...toggleOne(selected, 1)]).toEqual([]);
    expect([...toggleOne(selected, 2)].sort()).toEqual([1, 2]);
    expect([...selected]).toEqual([1]);
  });
});
```

`tests/lib/ui/keys.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isNativeSpaceTarget, isTypingTarget } from '@/lib/ui/keys';

describe('isTypingTarget', () => {
  it('detects text fields and editable content', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'number' })).toBe(true);
    expect(isTypingTarget({ tagName: 'textarea' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('lets shortcuts through elsewhere, including checkboxes', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget({ tagName: 'BODY' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('isNativeSpaceTarget', () => {
  it('is true where Space already clicks something', () => {
    expect(isNativeSpaceTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(true);
    expect(isNativeSpaceTarget({ tagName: 'BUTTON' })).toBe(true);
    expect(isNativeSpaceTarget({ tagName: 'BODY' })).toBe(false);
    expect(isNativeSpaceTarget({ tagName: 'INPUT', type: 'text' })).toBe(false);
    expect(isNativeSpaceTarget(null)).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/lib/srs/interval.test.ts tests/lib/review tests/lib/ui`
Expected: FAIL — 세 모듈을 찾지 못함

- [ ] **Step 3: 구현**

`src/lib/srs/interval.ts`:

```ts
import { ANSWERS, applyAnswer, type Answer, type SrsState } from './scheduler';

export type Intervals = Record<Answer, number>; // 응답별로 다음 복습까지 남는 시간(ms)

// 답 버튼에 보여 줄 "다음 복습까지" 미리보기. 실제 응답과 같은 계산(applyAnswer)을 쓴다.
export function previewIntervals(state: SrsState, now: Date): Intervals {
  const result = {} as Intervals;
  for (const answer of ANSWERS) {
    result[answer] = Math.max(0, applyAnswer(state, answer, now).due.getTime() - now.getTime());
  }
  return result;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// 1분 미만은 "1분", 이후 분·시간·일·개월·년 중 가장 큰 단위 하나로 반올림한다.
export function formatInterval(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))}분`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}시간`;
  if (ms < 30 * DAY) return `${Math.round(ms / DAY)}일`;
  if (ms < 365 * DAY) return `${Math.round(ms / (30 * DAY))}개월`;
  return `${Math.round(ms / (365 * DAY))}년`;
}
```

`src/lib/review/selection.ts`:

```ts
// 검토 화면의 선택·필터 규칙. 화면 상태와 떨어진 순수 함수라 테스트할 수 있다.
export type ReviewFilter = 'all' | 'learning' | 'nodict' | 'off';

export interface SelectableCandidate {
  id: number;
  isExisting: boolean;
  inDictionary: boolean;
}

export function matchesFilter(
  c: SelectableCandidate,
  filter: ReviewFilter,
  selected: ReadonlySet<number>,
): boolean {
  if (filter === 'learning') return c.isExisting;
  if (filter === 'nodict') return !c.inDictionary;
  if (filter === 'off') return !selected.has(c.id);
  return true;
}

export function filterCounts(
  list: readonly SelectableCandidate[],
  selected: ReadonlySet<number>,
): Record<ReviewFilter, number> {
  return {
    all: list.length,
    learning: list.filter((c) => c.isExisting).length,
    nodict: list.filter((c) => !c.inDictionary).length,
    off: list.filter((c) => !selected.has(c.id)).length,
  };
}

// Shift+클릭: 화면에 보이는 순서(visibleIds)에서 anchor부터 target까지를 target의 새 상태로 맞춘다.
export function selectRange(
  selected: ReadonlySet<number>,
  visibleIds: readonly number[],
  anchorId: number,
  targetId: number,
): Set<number> {
  const next = new Set(selected);
  const value = !selected.has(targetId);
  const a = visibleIds.indexOf(anchorId);
  const b = visibleIds.indexOf(targetId);
  const ids = a === -1 || b === -1 ? [targetId] : visibleIds.slice(Math.min(a, b), Math.max(a, b) + 1);
  for (const id of ids) {
    if (value) next.add(id);
    else next.delete(id);
  }
  return next;
}

export function toggleOne(selected: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
```

`src/lib/ui/keys.ts`:

```ts
// 입력칸에 글을 쓰는 중이면 한 글자 단축키를 끈다(제안서 6장).
// 체크박스·라디오·버튼은 글을 쓰는 곳이 아니므로 단축키를 막지 않는다.
export interface KeyTarget {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
}

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset']);

export function isTypingTarget(target: KeyTarget | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((target.type ?? 'text').toLowerCase());
  return tag === 'TEXTAREA' || tag === 'SELECT';
}

// Space로 체크박스·버튼을 누르는 브라우저 기본 동작과 겹치지 않게, 그 위에서는 Space 단축키를 쓰지 않는다.
export function isNativeSpaceTarget(target: KeyTarget | null): boolean {
  const tag = target?.tagName?.toUpperCase();
  if (tag === 'BUTTON') return true;
  return tag === 'INPUT' && NON_TEXT_INPUTS.has((target?.type ?? '').toLowerCase());
}
```

- [ ] **Step 4: 통과 확인과 커밋**

Run: `npm test`
Expected: PASS (134 tests)

```bash
git add -A
git commit -m "feat: add interval preview, review selection rules and shortcut guards"
```

---

### Task 3: 저장소: 카드별 간격과 문서별 뜻 실패 수

**Files:**
- Modify: `src/server/repo/study.ts`, `src/server/repo/cards.ts`
- Test: `tests/server/study.test.ts`, `tests/server/cards.test.ts`

**Interfaces:**
- Consumes: `previewIntervals`, `Intervals` (Task 2)
- Produces: `StudyCard.intervals: Intervals`, `recordAnswer(...): { due: Date; intervals: Intervals }`, `countFailedMeaningsByDocument(db): Map<number, number>`

- [ ] **Step 1: 실패하는 테스트로 바꾸기**

`tests/server/study.test.ts`의 첫 테스트 `serves new cards in creation order up to the daily limit`에서 `expect(queue.every((c) => c.isNew)).toBe(true);` 다음에 추가:

```ts
    expect(queue[0].intervals.again).toBeLessThanOrEqual(queue[0].intervals.good);
    expect(queue[0].intervals.good).toBeGreaterThan(0);
```

같은 파일 `updates the schedule, stamps introduction once and logs the review`에서 `const first = recordAnswer(db, id, 'good', now);` 다음에 추가:

```ts
    expect(first.intervals.good).toBeGreaterThan(0);
```

`tests/server/cards.test.ts`: import 목록에 `countFailedMeaningsByDocument,`를 넣고(`countOccurrencesByDocument,` 위), `returns empty lists for empty id lists` 테스트 바로 앞에 추가:

```ts
  it('counts failed meanings per document', () => {
    const { doc, ids } = reviewingDocument([candidate('robust'), candidate('paradigm')]);
    const saved = saveReviewSelection(db, doc.id, [...ids.values()]);
    markMeaningsFailed(db, saved.occurrenceIds.slice(0, 1));
    expect(countFailedMeaningsByDocument(db).get(doc.id)).toBe(1);
    expect(countFailedMeaningsByDocument(db).get(doc.id + 1)).toBeUndefined();
  });
```

Run: `npm test`
Expected: FAIL — `intervals`가 undefined, `countFailedMeaningsByDocument`를 찾지 못함

- [ ] **Step 2: 구현** — `src/server/repo/study.ts` 전체

```ts
import { and, asc, count, desc, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { previewIntervals, type Intervals } from '@/lib/srs/interval';
import {
  ANSWER_GRADE,
  applyAnswer,
  newCardSlots,
  startOfLocalDay,
  type Answer,
} from '@/lib/srs/scheduler';
import type { Db } from '../db/client';
import { documents, occurrences, reviewLogs, words, type MeaningStatus, type WordRow } from '../db/schema';

const NEW_STATE = 0;
const USAGES_PER_CARD = 2;

export class StudyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudyError';
  }
}

export interface Usage {
  surface: string;
  sentence: string;
  meaningKo: string | null;
  meaningStatus: MeaningStatus;
  documentTitle: string;
}

export interface StudyCard {
  wordId: number;
  lemma: string;
  phonetic: string | null;
  isNew: boolean;
  usages: Usage[]; // 최신 용례부터 최대 2개
  intervals: Intervals; // 응답별 다음 복습까지(ms). 답 버튼에 보여 준다
}

function countIntroducedToday(db: Db, now: Date): number {
  const row = db
    .select({ total: count() })
    .from(words)
    .where(gte(words.introducedAt, startOfLocalDay(now)))
    .get();
  return row?.total ?? 0;
}

function dueReviews(db: Db, now: Date): WordRow[] {
  return db
    .select()
    .from(words)
    .where(and(ne(words.state, NEW_STATE), lte(words.due, now)))
    .orderBy(asc(words.due), asc(words.id))
    .all();
}

function newCards(db: Db, limit: number): WordRow[] {
  if (limit <= 0) return [];
  return db
    .select()
    .from(words)
    .where(eq(words.state, NEW_STATE))
    .orderBy(asc(words.createdAt), asc(words.id))
    .limit(limit)
    .all();
}

function usagesByWord(db: Db, wordIds: number[]): Map<number, Usage[]> {
  const byWord = new Map<number, Usage[]>();
  if (wordIds.length === 0) return byWord;
  const rows = db
    .select({
      wordId: occurrences.wordId,
      surface: occurrences.surface,
      sentence: occurrences.sentence,
      meaningKo: occurrences.meaningKo,
      meaningStatus: occurrences.meaningStatus,
      documentTitle: documents.title,
    })
    .from(occurrences)
    .innerJoin(documents, eq(documents.id, occurrences.documentId))
    .where(inArray(occurrences.wordId, wordIds))
    .orderBy(desc(occurrences.createdAt), desc(occurrences.id))
    .all();
  for (const { wordId, ...usage } of rows) {
    const list = byWord.get(wordId) ?? [];
    if (list.length < USAGES_PER_CARD) list.push(usage);
    byWord.set(wordId, list);
  }
  return byWord;
}

// 오늘의 큐: 복습할 때가 된 카드(due 순) + 새 카드(만든 순, 하루 상한까지). 스펙 8.6.
export function getStudyQueue(db: Db, now: Date, dailyNewLimit: number): StudyCard[] {
  const slots = newCardSlots(dailyNewLimit, countIntroducedToday(db, now));
  const picked = [...dueReviews(db, now), ...newCards(db, slots)];
  const usages = usagesByWord(db, picked.map((w) => w.id));
  return picked.map((w) => ({
    wordId: w.id,
    lemma: w.lemma,
    phonetic: w.phonetic,
    isNew: w.state === NEW_STATE,
    usages: usages.get(w.id) ?? [],
    intervals: previewIntervals(w, now),
  }));
}

export function countStudyToday(
  db: Db,
  now: Date,
  dailyNewLimit: number,
): { review: number; fresh: number } {
  const review =
    db
      .select({ total: count() })
      .from(words)
      .where(and(ne(words.state, NEW_STATE), lte(words.due, now)))
      .get()?.total ?? 0;
  const waiting =
    db.select({ total: count() }).from(words).where(eq(words.state, NEW_STATE)).get()?.total ?? 0;
  const slots = newCardSlots(dailyNewLimit, countIntroducedToday(db, now));
  return { review, fresh: Math.min(waiting, slots) };
}

// 응답을 기록하고 다음 복습 일정을 저장한다. 새 카드는 처음 응답한 시각을 introducedAt으로 남긴다.
// 돌려주는 intervals는 응답 뒤 상태 기준 미리보기다. "모름"으로 세션 뒤에 다시 넣는 카드의 답 버튼을 갱신할 때 쓴다.
export function recordAnswer(
  db: Db,
  wordId: number,
  answer: Answer,
  now: Date,
): { due: Date; intervals: Intervals } {
  return db.transaction((tx) => {
    const word = tx.select().from(words).where(eq(words.id, wordId)).get();
    if (!word) throw new StudyError('카드를 찾을 수 없습니다.');
    const next = applyAnswer(word, answer, now);
    tx.update(words)
      .set({ ...next, introducedAt: word.introducedAt ?? now })
      .where(eq(words.id, wordId))
      .run();
    tx.insert(reviewLogs).values({ wordId, rating: ANSWER_GRADE[answer], reviewedAt: now }).run();
    return { due: next.due, intervals: previewIntervals(next, now) };
  });
}
```

`src/server/repo/cards.ts` 맨 끝에 추가:

```ts
// 문서별 뜻 생성 실패 수. 홈·문서 목록에서 안내할 때 쓴다.
export function countFailedMeaningsByDocument(db: Db): Map<number, number> {
  const rows = db
    .select({ documentId: occurrences.documentId, total: count() })
    .from(occurrences)
    .where(eq(occurrences.meaningStatus, 'failed'))
    .groupBy(occurrences.documentId)
    .all();
  return new Map(rows.map((r) => [r.documentId, r.total]));
}
```

- [ ] **Step 3: 통과 확인과 커밋**

Run: `npm test` 그리고 `npm run typecheck`
Expected: PASS (135 tests). typecheck는 `src/app/study/actions.ts`가 아직 `recordAnswer`의 옛 반환값을 쓰지만 호환되므로 통과한다.

```bash
git add -A
git commit -m "feat: expose next-review intervals and failed meaning counts"
```

---

### Task 4: 복습 화면

**Files:**
- Modify: `src/app/study/speak-button.tsx`, `src/app/study/actions.ts`, `src/app/study/study-session.tsx`, `src/app/study/page.tsx` (모두 전체 교체)

**Interfaces:**
- Produces: `speak(text)`, `useCanSpeak()`, `type AnswerResult = { error: string } | { error: null; due: number; intervals: Intervals }`

화면 규칙(제안서 5.5): 진행 줄("응답 / 전체", 막대, 남은 수), 760px 카드, 앞면 52px 단어 → 뒷면 40px, IPA, 용례(문맥 뜻 22px 고딕 → 원문 18px 세리프 → 출처 기울임), 답 버튼 세 칸에 "N분 뒤"와 `1` `2` `3`. 단축키는 `Space`/`Enter` 뒷면, `1` `2` `3` 응답, `P` 발음, 완료 화면 `Enter` 홈. 완료 화면은 카드 수·응답 수·모름 수와, 1시간 안에 다시 나올 카드 안내 + "다시 확인"(전체 새로고침 링크)이다.

- [ ] **Step 1: 발음 버튼** — `src/app/study/speak-button.tsx`

```tsx
"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function useCanSpeak(): boolean {
  return useSyncExternalStore(subscribe, canSpeak, () => false);
}

// 브라우저 내장 음성 합성(Web Speech API)으로 읽는다. 단축키(P)도 이 함수를 쓴다.
export function speak(text: string) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

// 지원하지 않으면 버튼을 숨긴다. 서버 렌더에서는 숨김으로 시작한다.
export function SpeakButton({ text }: { text: string }) {
  const supported = useCanSpeak();
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() => speak(text)}
      aria-label={`${text} 발음 듣기`}
      className="grid size-9 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink-2 hover:bg-sunken"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: 응답 Action** — `src/app/study/actions.ts`

```ts
"use server";

import type { Intervals } from "@/lib/srs/interval";
import { ANSWERS, type Answer } from "@/lib/srs/scheduler";
import { getDb } from "@/server/db/client";
import { recordAnswer, StudyError } from "@/server/repo/study";

export type AnswerResult =
  | { error: string }
  | { error: null; due: number; intervals: Intervals }; // due는 ms(epoch)

// 복습 응답 하나를 저장한다. 성공하면 다음 복습 시각과 응답 뒤 상태의 간격 미리보기를 돌려준다.
export async function answerCard(wordId: number, answer: Answer): Promise<AnswerResult> {
  if (!Number.isInteger(wordId) || !ANSWERS.includes(answer)) {
    return { error: "잘못된 요청입니다." };
  }
  try {
    const { due, intervals } = recordAnswer(getDb(), wordId, answer, new Date());
    return { error: null, due: due.getTime(), intervals };
  } catch (err) {
    if (err instanceof StudyError) return { error: err.message };
    throw err;
  }
}
```

- [ ] **Step 3: 복습 세션** — `src/app/study/study-session.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { Highlighted } from "@/components/ui/highlighted";
import { Kbd } from "@/components/ui/kbd";
import { Failed, Spinner } from "@/components/ui/status";
import { Tag } from "@/components/ui/tag";
import { formatInterval } from "@/lib/srs/interval";
import type { Answer } from "@/lib/srs/scheduler";
import { advanceQueue } from "@/lib/srs/session";
import { isNativeSpaceTarget, isTypingTarget } from "@/lib/ui/keys";
import type { StudyCard, Usage } from "@/server/repo/study";
import { answerCard } from "./actions";
import { SpeakButton, speak } from "./speak-button";

const ANSWER_BUTTONS: { answer: Answer; label: string; key: string; tone: string }[] = [
  { answer: "again", label: "모름", key: "1", tone: "bg-again-soft text-again" },
  { answer: "hard", label: "애매", key: "2", tone: "bg-hard-soft text-hard" },
  { answer: "good", label: "앎", key: "3", tone: "bg-good-soft text-good" },
];

// 세션을 마친 뒤 이 시간 안에 다시 나오는 카드(학습 단계)를 따로 알려 준다.
const SOON_WINDOW_MS = 60 * 60_000;

interface Soon {
  count: number;
  minutes: number;
}

function UsageBlock({ usage, primary }: { usage: Usage; primary: boolean }) {
  return (
    <div className={primary ? "mt-6 border-t border-line pt-5" : "mt-4 border-t border-dashed border-line pt-4"}>
      <div className={primary ? "text-[22px] leading-[1.45] font-bold" : "text-[17px] font-bold"}>
        {usage.meaningStatus === "done" ? (
          usage.meaningKo
        ) : usage.meaningStatus === "failed" ? (
          <Failed>문맥 뜻을 만들지 못했습니다</Failed>
        ) : (
          <span className="inline-flex items-center gap-2 text-[15px] font-normal text-muted">
            <Spinner /> 뜻 만드는 중
          </span>
        )}
      </div>
      <p className={`mt-2.5 font-en text-ink-2 ${primary ? "text-lg leading-[1.6]" : "text-base leading-[1.6]"}`}>
        <Highlighted sentence={usage.sentence} word={usage.surface} />
      </p>
      <p className="mt-2 text-[12.5px] text-muted">
        — <span className="font-en text-[13.5px] italic">{usage.documentTitle}</span>
      </p>
    </div>
  );
}

export function StudySession({ cards }: { cards: StudyCard[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [lastDue, setLastDue] = useState<Map<number, number>>(new Map());
  const [soon, setSoon] = useState<Soon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const locked = useRef(false);

  const card = queue[0];

  const answer = (choice: Answer) => {
    // saving(isPending)은 다음 렌더에야 버튼을 막으므로, 같은 순간의 두 번째 입력은 ref로 즉시 막는다.
    if (!card || locked.current) return;
    locked.current = true;
    startSaving(async () => {
      try {
        const result = await answerCard(card.wordId, choice);
        if (result.error !== null) {
          setError(result.error);
          return;
        }
        setError(null);
        setAnswered((n) => n + 1);
        if (choice === "again") setAgainCount((n) => n + 1);
        const dues = new Map(lastDue).set(card.wordId, result.due);
        setLastDue(dues);
        const next = advanceQueue(queue, choice).map((c) =>
          c.wordId === card.wordId ? { ...c, isNew: false, intervals: result.intervals } : c,
        );
        if (next.length === 0) {
          const now = Date.now();
          const pending = [...dues.values()].filter((due) => due > now && due - now <= SOON_WINDOW_MS);
          setSoon(
            pending.length > 0
              ? { count: pending.length, minutes: Math.max(1, Math.ceil((Math.min(...pending) - now) / 60_000)) }
              : null,
          );
        }
        setQueue(next);
        setRevealed(false);
      } finally {
        locked.current = false; // 실패해도 다시 누를 수 있게 푼다
      }
    });
  };

  // 키보드: Space/Enter 뒷면, 1·2·3 응답, P 발음, 완료 화면에서 Enter 홈. 입력칸에서는 끈다.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKey.current = (e) => {
      const target = e.target as HTMLInputElement | null;
      if (isTypingTarget(target) || e.ctrlKey || e.metaKey || e.altKey) return;
      // 포커스된 버튼 위의 Space·Enter는 브라우저가 그 버튼을 누르므로 여기서 또 처리하지 않는다.
      if ((e.key === " " || e.key === "Enter") && isNativeSpaceTarget(target)) return;
      if (!card) {
        if (e.key === "Enter") router.push("/");
        return;
      }
      if (e.key === "p" || e.key === "P") {
        speak(card.lemma);
      } else if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed) {
        const hit = ANSWER_BUTTONS.find((b) => b.key === e.key);
        if (hit) {
          e.preventDefault();
          answer(hit.answer);
        }
      }
    };
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  if (!card) {
    return (
      <div className="py-16 text-center">
        <p className="text-[22px] font-bold">오늘 복습을 마쳤습니다</p>
        {answered > 0 && (
          <p className="mt-4 inline-flex gap-5 text-sm text-ink-2">
            <span>
              카드 <b className="tabular-nums">{lastDue.size}</b>장
            </span>
            <span>
              응답 <b className="tabular-nums">{answered}</b>번
            </span>
            <span>
              모름 <b className="text-again tabular-nums">{againCount}</b>
            </span>
          </p>
        )}
        {soon && (
          <p className="mt-3 text-sm text-muted">
            {soon.count}장은 약 {soon.minutes}분 뒤 다시 나옵니다 ·{" "}
            <a href="/study" className="font-semibold text-accent">
              다시 확인
            </a>
          </p>
        )}
        <div className="mt-6">
          <button type="button" onClick={() => router.push("/")} className={buttonClass({ variant: "primary" })}>
            홈으로 <Kbd onAccent>Enter</Kbd>
          </button>
        </div>
      </div>
    );
  }

  const total = answered + queue.length;
  const [first, second] = card.usages;

  return (
    <div>
      <div className="flex items-center gap-3.5 text-[13px] text-muted">
        <span className="tabular-nums">
          {answered} / {total}
        </span>
        <span className="h-1 flex-1 overflow-hidden rounded-sm bg-sunken">
          <span className="block h-full bg-accent" style={{ width: `${(answered / total) * 100}%` }} />
        </span>
        <span>
          남은 <b className="text-ink tabular-nums">{queue.length}</b>
        </span>
      </div>

      <section className="mt-5 flex min-h-[380px] flex-col rounded-lg border border-line bg-surface px-12 pt-10 pb-8 shadow-1 max-[900px]:px-5 max-[900px]:pt-7">
        {card.isNew && (
          <div>
            <Tag kind="new" />
          </div>
        )}
        <div className={`flex items-center gap-3 ${card.isNew ? "mt-4" : ""}`}>
          <h2
            className={`font-en leading-[1.1] font-bold tracking-[-0.01em] ${
              revealed ? "text-[40px]" : "text-[52px] max-[900px]:text-[38px]"
            }`}
          >
            {card.lemma}
          </h2>
          <SpeakButton text={card.lemma} />
        </div>

        {revealed ? (
          <>
            <p className={`mt-1 font-en text-[19px] ${card.phonetic ? "text-muted" : "text-[15px] text-faint"}`}>
              {card.phonetic ?? "발음기호 없음"}
            </p>
            {first && <UsageBlock usage={first} primary />}
            {second && <UsageBlock usage={second} primary={false} />}
          </>
        ) : (
          <p className="mt-auto pt-12 text-center text-sm text-faint">이 문서에서 어떤 뜻이었는지 떠올려 보세요</p>
        )}
      </section>

      {revealed ? (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {ANSWER_BUTTONS.map((b) => (
            <button
              key={b.answer}
              type="button"
              disabled={saving}
              onClick={() => answer(b.answer)}
              className={`grid justify-items-center gap-0.5 rounded-lg px-3.5 py-3.5 disabled:opacity-55 ${b.tone}`}
            >
              <b className="text-base">{b.label}</b>
              <span className="text-xs opacity-80">{formatInterval(card.intervals[b.answer])} 뒤</span>
              <span className="mt-1">
                <Kbd>{b.key}</Kbd>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface p-3.5 text-[15px] font-semibold text-ink hover:bg-sunken"
        >
          뒷면 보기 <Kbd>Space</Kbd>
        </button>
      )}
      <p className="mt-2.5 text-center text-[13px] text-muted">
        <Kbd>P</Kbd> 발음 듣기
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-again">
          {error}
        </p>
      )}
    </div>
  );
}
```

키보드 처리기는 `onKey` ref에 매 렌더 최신 상태로 다시 넣고, `window` 리스너는 한 번만 단다. 리스너를 렌더마다 다시 달지 않으면서도 최신 `card`·`revealed`를 쓰기 위해서다.

- [ ] **Step 4: 페이지** — `src/app/study/page.tsx`

```tsx
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/repo/settings";
import { getStudyQueue } from "@/server/repo/study";
import { StudySession } from "./study-session";

export default function StudyPage() {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-7 pb-10">
      <h1 className="sr-only">오늘의 복습</h1>
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <TodayQueue />
      </Suspense>
    </main>
  );
}

async function TodayQueue() {
  await connection();
  const db = getDb();
  const cards = getStudyQueue(db, new Date(), getSettings(db).dailyNewLimit);
  return <StudySession cards={cards} />;
}
```

- [ ] **Step 5: 확인과 커밋**

Run: `npm run typecheck`, `npm run lint`
Expected: 오류 0

```bash
git add -A
git commit -m "feat: redesign the study screen with keyboard flow and interval previews"
```

---

### Task 5: 검토 화면

**Files:**
- Modify: `src/app/documents/[id]/review/candidate-table.tsx`, `src/app/documents/[id]/review/page.tsx` (모두 전체 교체)

화면 규칙(제안서 5.3): 고정 도구줄(개수 문장, 필터 칩 4개와 개수, "보이는 행 모두 선택/해제", 저장 `Ctrl Enter`). 저장 중에는 도구줄이 회전 표시 + 왕복 진행 막대 + 안내로 바뀌고 표는 잠긴다. 행은 체크박스 / 단어(세리프, 해제하면 흐리게) + 배지 / 횟수 / 원문. 포커스 행은 `accent-soft` 바탕 + 왼쪽 3px 막대. `J` `K`(`↓` `↑`) 이동, `Space`/`X` 체크, Shift+클릭과 Shift+Space 범위 선택, `Ctrl+Enter` 저장. 아래에 단축키 안내 줄.

- [ ] **Step 1: 후보 표** — `src/app/documents/[id]/review/candidate-table.tsx`

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { Highlighted } from "@/components/ui/highlighted";
import { Kbd } from "@/components/ui/kbd";
import { Status } from "@/components/ui/status";
import { Tag } from "@/components/ui/tag";
import {
  filterCounts,
  matchesFilter,
  selectRange,
  toggleOne,
  type ReviewFilter,
} from "@/lib/review/selection";
import { isNativeSpaceTarget, isTypingTarget } from "@/lib/ui/keys";
import { saveReview } from "./actions";

export interface CandidateView {
  id: number;
  lemma: string;
  surface: string;
  sentence: string;
  count: number;
  isExisting: boolean;
  inDictionary: boolean;
}

const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "learning", label: "이미 학습 중" },
  { value: "nodict", label: "사전에 없음" },
  { value: "off", label: "해제함" },
];

export function CandidateTable({
  documentId,
  candidates,
}: {
  documentId: number;
  candidates: CandidateView[];
}) {
  // 사전에 없는 단어(약칭·기호일 가능성이 큼)는 기본으로 체크 해제한다.
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(candidates.filter((c) => c.inDictionary).map((c) => c.id)),
  );
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [focus, setFocus] = useState(0);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());

  const visible = candidates.filter((c) => matchesFilter(c, filter, selected));
  const counts = filterCounts(candidates, selected);
  const focusedId = visible[Math.min(focus, visible.length - 1)]?.id;
  const allVisibleOn = visible.length > 0 && visible.every((c) => selected.has(c.id));

  const check = (id: number, shift: boolean) => {
    setSelected((prev) =>
      shift && anchor !== null ? selectRange(prev, visible.map((c) => c.id), anchor, id) : toggleOne(prev, id),
    );
    setAnchor(id);
  };

  const toggleVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of visible) {
        if (allVisibleOn) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });

  const save = () => {
    if (saving) return;
    startSaving(async () => {
      const result = await saveReview(documentId, [...selected]);
      if (result?.error) setError(result.error);
    });
  };

  // 키보드: J/K(↓/↑) 이동, Space/X 체크, Ctrl+Enter 저장(제안서 5.3)
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKey.current = (e) => {
      const target = e.target as HTMLInputElement | null;
      if (saving || isTypingTarget(target)) return;
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        save();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocus((f) => Math.min(f + 1, visible.length - 1));
      } else if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocus((f) => Math.max(f - 1, 0));
      } else if ((e.key === " " && !isNativeSpaceTarget(target)) || e.key === "x" || e.key === "X") {
        if (focusedId === undefined) return;
        e.preventDefault();
        check(focusedId, e.shiftKey);
      }
    };
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    if (focusedId !== undefined) rowRefs.current.get(focusedId)?.scrollIntoView({ block: "nearest" });
  }, [focusedId]);

  const savedCount = selected.size;
  const offCount = candidates.length - savedCount;

  return (
    <div>
      <div
        aria-live="polite"
        className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-bg/92 px-10 py-2.5 backdrop-blur max-[900px]:px-4"
      >
        {saving ? (
          <>
            <Status tone="busy" className="text-sm text-ink">
              뜻과 발음을 채우는 중 · {savedCount}개
            </Status>
            <span className="relative h-[3px] w-40 overflow-hidden rounded-sm bg-sunken">
              <span className="absolute inset-y-0 w-2/5 animate-[indeterminate_1.2s_ease-in-out_infinite_alternate] bg-accent" />
            </span>
            <span className="text-[13px] text-muted">보통 10초 안팎 걸립니다. 끝나면 단어 목록으로 이동합니다.</span>
          </>
        ) : (
          <>
            <span className="text-sm">
              <b className="tabular-nums">{candidates.length}</b>개 중{" "}
              <b className="text-accent tabular-nums">{savedCount}</b>개 저장 · 해제한{" "}
              <span className="tabular-nums">{offCount}</span>개는 아는 단어로
            </span>
            <span className="inline-flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filter === f.value}
                  onClick={() => {
                    setFilter(f.value);
                    setFocus(0);
                  }}
                  className={`rounded-full border bg-surface px-2.5 py-1 text-[12.5px] ${
                    filter === f.value ? "border-ink font-semibold text-ink" : "border-line-strong text-ink-2"
                  }`}
                >
                  {f.label}
                  <i className="ml-1 text-muted not-italic tabular-nums">{counts[f.value]}</i>
                </button>
              ))}
            </span>
          </>
        )}
        <span className="flex-1" />
        {!saving && (
          <button type="button" onClick={toggleVisible} className={buttonClass({ variant: "ghost", size: "sm" })}>
            {allVisibleOn ? "보이는 행 모두 해제" : "보이는 행 모두 선택"}
          </button>
        )}
        <button type="button" onClick={save} disabled={saving} className={buttonClass({ variant: "primary" })}>
          {saving ? "저장 중…" : "저장"} {!saving && <Kbd onAccent>Ctrl Enter</Kbd>}
        </button>
      </div>

      {error && (
        <p role="alert" className="px-10 pt-3 text-sm text-again">
          {error}
        </p>
      )}

      <div className={`overflow-x-auto px-7 max-[900px]:px-2 ${saving ? "pointer-events-none opacity-45" : ""}`} aria-busy={saving}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line-strong text-left text-xs font-semibold whitespace-nowrap text-muted">
              <th className="w-11 px-3 py-2" />
              <th className="w-[300px] px-3 py-2">단어</th>
              <th className="w-14 px-3 py-2 text-right">횟수</th>
              <th className="px-3 py-2">원문 문장</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const on = selected.has(c.id);
              const focused = c.id === focusedId;
              return (
                <tr
                  key={c.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(c.id, el);
                    else rowRefs.current.delete(c.id);
                  }}
                  className={`border-b border-line align-top ${focused ? "bg-accent-soft" : "hover:bg-sunken/60"}`}
                >
                  <td className={`px-3 py-[7px] ${focused ? "shadow-[inset_3px_0_0_var(--accent)]" : ""}`}>
                    <input
                      type="checkbox"
                      aria-label={`${c.lemma} 선택`}
                      checked={on}
                      onChange={(e) => check(c.id, (e.nativeEvent as MouseEvent).shiftKey === true)}
                      onFocus={() => setFocus(visible.indexOf(c))}
                      className="mt-1 size-[18px] accent-accent"
                    />
                  </td>
                  <td className="px-3 py-[7px]">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className={`font-en text-base ${on ? "font-bold text-ink" : "text-faint"}`}>{c.lemma}</span>
                      {c.isExisting && <Tag kind="learning" />}
                      {!c.inDictionary && <Tag kind="nodict" />}
                    </div>
                  </td>
                  <td className="px-3 py-[7px] text-right text-sm text-muted tabular-nums">{c.count}</td>
                  <td
                    className={`px-3 py-[7px] font-en text-[15px] leading-[1.55] ${
                      on ? "text-ink-2" : "text-faint [&_mark]:font-normal [&_mark]:opacity-55"
                    }`}
                  >
                    <Highlighted sentence={c.sentence} word={c.surface} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="px-3 py-6 text-sm text-muted">이 조건에 맞는 단어가 없습니다.</p>}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-[18px] gap-y-1 border-t border-line bg-surface px-10 py-3 text-[12.5px] text-muted max-[900px]:px-4">
        <span>
          <Kbd>J</Kbd> <Kbd>K</Kbd> 아래·위
        </span>
        <span>
          <Kbd>Space</Kbd> 체크 바꾸기
        </span>
        <span>
          <Kbd>Shift</Kbd>+클릭 범위 선택
        </span>
        <span>
          <Kbd>Ctrl Enter</Kbd> 저장
        </span>
        <span>체크 해제 = 아는 단어(다음 문서부터 제외)</span>
      </div>
    </div>
  );
}
```

체크박스의 Shift 여부는 `onChange`의 `e.nativeEvent`(체크박스에서는 click 이벤트)에서 읽는다. `onClick`에서 `preventDefault`로 막는 방식은 제어 체크박스와 화면이 어긋날 수 있어 쓰지 않았다.

- [ ] **Step 2: 페이지** — `src/app/documents/[id]/review/page.tsx`

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/server/db/client";
import { listCandidates } from "@/server/repo/candidates";
import { getDocument } from "@/server/repo/documents";
import { CandidateTable } from "./candidate-table";

export default function ReviewPage({ params }: PageProps<"/documents/[id]/review">) {
  return (
    <Suspense fallback={<p className="px-10 py-8 text-muted">불러오는 중…</p>}>
      <Review params={params} />
    </Suspense>
  );
}

async function Review({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const db = getDb();
  const doc = getDocument(db, id);
  if (!doc) notFound();
  const candidates = listCandidates(db, id);

  return (
    <main className="mx-auto w-full max-w-[1200px] pb-10">
      <div className="px-10 pt-6 pb-3 max-[900px]:px-4">
        <p className="text-[13px] text-muted">
          <Link href="/documents" className="hover:text-ink">
            문서
          </Link>{" "}
          › 단어 검토
        </p>
        <h1 className="mt-1 font-en text-[26px] leading-[1.3] font-bold">{doc.title}</h1>
      </div>
      {candidates.length === 0 ? (
        <p className="px-10 py-6 text-ink-2">
          외울 단어가 없습니다.{" "}
          <Link href="/documents" className="font-semibold text-accent">
            문서 목록으로
          </Link>
        </p>
      ) : (
        <CandidateTable
          documentId={doc.id}
          candidates={candidates.map((c) => ({
            id: c.id,
            lemma: c.lemma,
            surface: c.surface,
            sentence: c.sentence,
            count: c.count,
            isExisting: c.isExisting,
            inDictionary: c.inDictionary,
          }))}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 3: 확인과 커밋**

Run: `npm run typecheck`, `npm run lint`
Expected: 오류 0

```bash
git add -A
git commit -m "feat: redesign the review screen with filters, range select and keyboard"
```

---

### Task 6: 문서 목록, 업로드, 문서 단어 목록

**Files:**
- Create: `src/components/document-status.tsx`
- Modify: `src/app/documents/page.tsx`, `src/app/documents/upload-form.tsx`, `src/app/documents/[id]/page.tsx` (모두 전체 교체)

**Interfaces:**
- Produces: `<DocumentStatusLabel status>`, `documentHref(doc, wordCount): string | null`, `KIND_LABEL`
- `documentHref`는 카드가 있는 오류 문서도 단어 목록으로 연결한다(M2 리뷰 Minor "오류 문서에 링크 없음" 해결).

- [ ] **Step 1: 문서 상태 부품** — `src/components/document-status.tsx`

```tsx
import { Status, type StatusTone } from "@/components/ui/status";
import type { DocumentRow, DocumentStatus } from "@/server/db/schema";

const STATUS: Record<DocumentStatus, { tone: StatusTone; label: string }> = {
  extracting: { tone: "busy", label: "추출 중" },
  reviewing: { tone: "wait", label: "검토 대기" },
  processing: { tone: "busy", label: "뜻 채우는 중" },
  done: { tone: "ok", label: "완료" },
  error: { tone: "err", label: "오류" },
};

export function DocumentStatusLabel({ status }: { status: DocumentStatus }) {
  const s = STATUS[status];
  return <Status tone={s.tone}>{s.label}</Status>;
}

// 문서를 누르면 갈 곳. 검토 대기는 검토 화면, 카드가 있는 문서(오류 포함)는 단어 목록, 나머지는 없음.
export function documentHref(doc: Pick<DocumentRow, "id" | "status">, wordCount: number): string | null {
  if (doc.status === "reviewing") return `/documents/${doc.id}/review`;
  if (doc.status === "done" || doc.status === "processing" || wordCount > 0) return `/documents/${doc.id}`;
  return null;
}

export const KIND_LABEL = { paper: "논문", presentation: "발표" } as const;
```

- [ ] **Step 2: 업로드 폼** — `src/app/documents/upload-form.tsx`

```tsx
"use client";

import { useActionState, useRef, useState, type DragEvent, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import { Spinner } from "@/components/ui/status";
import { pdfSizeError } from "@/lib/upload/limits";
import { uploadDocument, type UploadState } from "./actions";

const initialState: UploadState = { error: null };

const KINDS = [
  { value: "paper", label: "논문" },
  { value: "presentation", label: "발표" },
] as const;

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadDocument, initialState);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // 51MB를 넘는 본문은 Next가 서버 액션 전에 거부하므로, 크기는 제출 전에 여기서 알린다.
  const checkSize = (event: FormEvent<HTMLFormElement>) => {
    const file = new FormData(event.currentTarget).get("file");
    const error = file instanceof File ? pdfSizeError(file.size) : null;
    setSizeError(error);
    if (error) event.preventDefault();
  };

  // 끌어다 놓은 파일을 같은 <input type=file>에 넣어 기존 제출 흐름을 그대로 쓴다.
  const onDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = event.dataTransfer.files;
    if (files.length === 0 || !fileInput.current) return;
    fileInput.current.files = files;
    setFileName(files[0].name);
  };

  const error = sizeError ?? state.error;

  return (
    <form
      action={formAction}
      onSubmit={checkSize}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`rounded-lg border-[1.5px] border-dashed bg-surface p-3.5 ${
        dragging ? "border-accent" : "border-line-strong"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-[260px] flex-1 cursor-pointer items-center gap-2.5 text-sm text-ink-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" />
          </svg>
          {fileName ? (
            <span className="truncate font-semibold text-ink">{fileName}</span>
          ) : (
            <span>
              PDF를 끌어다 놓거나 <span className="font-semibold text-accent">파일 선택</span>
              <span className="text-[13px] text-muted"> · 50MB까지</span>
            </span>
          )}
          <input
            ref={fileInput}
            type="file"
            name="file"
            accept="application/pdf,.pdf"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="sr-only"
          />
        </label>
        <fieldset className="inline-flex overflow-hidden rounded-md border border-line-strong">
          <legend className="sr-only">종류</legend>
          {KINDS.map((k) => (
            <label
              key={k.value}
              className="cursor-pointer px-3 py-1.5 text-[13px] text-ink-2 has-checked:bg-ink has-checked:font-semibold has-checked:text-surface has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input type="radio" name="kind" value={k.value} defaultChecked={k.value === "paper"} className="sr-only" />
              {k.label}
            </label>
          ))}
        </fieldset>
        <input
          type="text"
          name="title"
          placeholder="제목 (비우면 파일 이름)"
          className="min-w-0 flex-[1_1_240px] rounded-md border border-line-strong bg-surface px-2.5 py-[7px] text-sm text-ink placeholder:text-faint"
        />
        <button type="submit" disabled={pending} className={buttonClass({ variant: "primary" })}>
          {pending && <Spinner className="border-on-accent border-r-transparent" />}
          {pending ? "단어 추출 중…" : "올리기"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2.5 text-sm text-again">
          {error}
        </p>
      )}
    </form>
  );
}
```

끌어다 놓은 파일은 같은 `<input type=file name=file>`에 넣는다. 그래서 Server Action과 크기 검사 흐름은 그대로다. 종류 선택은 `has-checked:` 변형을 쓴 라디오 두 개다(`name=kind` 값은 그대로).

- [ ] **Step 3: 문서 목록** — `src/app/documents/page.tsx`

```tsx
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DocumentStatusLabel, documentHref, KIND_LABEL } from "@/components/document-status";
import { Failed } from "@/components/ui/status";
import { getDb } from "@/server/db/client";
import { countFailedMeaningsByDocument, countOccurrencesByDocument } from "@/server/repo/cards";
import { countCandidatesByDocument } from "@/server/repo/candidates";
import { listDocuments } from "@/server/repo/documents";
import { UploadForm } from "./upload-form";

export default function DocumentsPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-10 py-8 max-[900px]:px-4">
      <h1 className="mb-4 text-2xl leading-[1.3] font-bold tracking-[-0.015em]">문서</h1>
      <UploadForm />
      <Suspense fallback={<p className="mt-5 text-muted">불러오는 중…</p>}>
        <DocumentList />
      </Suspense>
    </main>
  );
}

async function DocumentList() {
  await connection();
  const db = getDb();
  const docs = listDocuments(db);
  const candidateCounts = countCandidatesByDocument(db);
  const wordCounts = countOccurrencesByDocument(db);
  const failedCounts = countFailedMeaningsByDocument(db);

  if (docs.length === 0) return <p className="mt-5 text-muted">아직 올린 문서가 없습니다.</p>;

  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line-strong text-left text-xs font-semibold whitespace-nowrap text-muted">
            <th className="px-3 py-2">제목</th>
            <th className="w-20 px-3 py-2">종류</th>
            <th className="w-[130px] px-3 py-2">상태</th>
            <th className="w-[110px] px-3 py-2 text-right">단어</th>
            <th className="w-[120px] px-3 py-2 text-right">올린 날</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => {
            const words = wordCounts.get(doc.id) ?? 0;
            const failed = failedCounts.get(doc.id) ?? 0;
            const href = documentHref(doc, words);
            return (
              <tr key={doc.id} className="relative border-b border-line align-top hover:bg-sunken/60">
                <td className="px-3 py-2.5">
                  {href ? (
                    // 행 전체를 누를 수 있게 링크 영역을 행 크기로 늘린다.
                    <Link href={href} className="font-en text-[17px] font-bold text-ink after:absolute after:inset-0">
                      {doc.title}
                    </Link>
                  ) : (
                    <span className="font-en text-[17px] font-bold text-muted">{doc.title}</span>
                  )}
                  {doc.status === "error" && doc.errorMessage && (
                    <div className="mt-0.5 text-[13px] text-muted">{doc.errorMessage}</div>
                  )}
                  {failed > 0 && (
                    <div className="mt-0.5">
                      <Failed>
                        뜻 <span className="tabular-nums">{failed}</span>개 생성 실패
                      </Failed>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm">{KIND_LABEL[doc.kind]}</td>
                <td className="px-3 py-2.5">
                  <DocumentStatusLabel status={doc.status} />
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                  {doc.status === "reviewing" ? `후보 ${candidateCounts.get(doc.id) ?? 0}` : words || "—"}
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-muted tabular-nums">
                  {doc.createdAt.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: 문서 단어 목록** — `src/app/documents/[id]/page.tsx`

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { KIND_LABEL } from "@/components/document-status";
import { Highlighted } from "@/components/ui/highlighted";
import { Notice } from "@/components/ui/notice";
import { Failed, Spinner } from "@/components/ui/status";
import { getDb } from "@/server/db/client";
import { listOccurrencesByDocument, type OccurrenceView } from "@/server/repo/cards";
import { getDocument } from "@/server/repo/documents";

// 문서 단어 목록(읽기 전용). 뜻 수정·재시도·카드 삭제는 마일스톤 4에서 붙인다.
export default function DocumentWordsPage({ params }: PageProps<"/documents/[id]">) {
  return (
    <Suspense fallback={<p className="px-10 py-8 text-muted">불러오는 중…</p>}>
      <DocumentWords params={params} />
    </Suspense>
  );
}

function MeaningCell({ row }: { row: OccurrenceView }) {
  if (row.meaningStatus === "done") return <span className="text-[15px] font-semibold text-ink">{row.meaningKo}</span>;
  if (row.meaningStatus === "failed") return <Failed>생성 실패</Failed>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      <Spinner /> 뜻 만드는 중
    </span>
  );
}

async function DocumentWords({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const db = getDb();
  const doc = getDocument(db, id);
  if (!doc) notFound();
  const rows = listOccurrencesByDocument(db, id);
  const failed = rows.filter((r) => r.meaningStatus === "failed").length;
  const missingKey = !process.env.GEMINI_API_KEY;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-10 py-8 max-[900px]:px-4">
      <p className="text-[13px] text-muted">
        <Link href="/documents" className="hover:text-ink">
          문서
        </Link>
      </p>
      <h1 className="mt-1 font-en text-[26px] leading-[1.3] font-bold">{doc.title}</h1>
      <p className="mt-1 text-[13px] text-muted">
        {KIND_LABEL[doc.kind]} · 단어 <span className="tabular-nums">{rows.length}</span>개 ·{" "}
        {doc.createdAt.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 올림
      </p>

      {doc.status === "reviewing" && (
        <Notice className="mt-4">
          아직 검토하지 않은 문서입니다.
          <Link href={`/documents/${doc.id}/review`} className="font-semibold text-accent">
            검토하러 가기
          </Link>
        </Notice>
      )}
      {doc.status === "error" && doc.errorMessage && <Notice className="mt-4">{doc.errorMessage}</Notice>}
      {failed > 0 && (
        <Notice className="mt-4">
          뜻 <span className="tabular-nums">{failed}</span>개를 만들지 못했습니다
          {missingKey && (
            <>
              {" "}
              · GEMINI_API_KEY 없음.{" "}
              <span className="text-muted">.env.local에 키를 넣고 서버를 다시 시작하세요.</span>
            </>
          )}
        </Notice>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line-strong text-left text-xs font-semibold whitespace-nowrap text-muted">
              <th className="w-[200px] px-3 py-2">단어</th>
              <th className="w-[260px] px-3 py-2">문맥 뜻</th>
              <th className="px-3 py-2">원문 문장</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line align-top hover:bg-sunken/60">
                <td className="px-3 py-2.5">
                  <div className="font-en text-[17px] font-bold">{r.lemma}</div>
                  <div className={`font-en text-sm ${r.phonetic ? "text-muted" : "text-faint"}`}>
                    {r.phonetic ?? "발음기호 없음"}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <MeaningCell row={r} />
                </td>
                <td className="px-3 py-2.5 font-en text-[15.5px] leading-[1.55] text-ink-2">
                  <Highlighted sentence={r.sentence} word={r.surface} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: 확인과 커밋**

Run: `npm run typecheck`, `npm run lint`
Expected: 오류 0

```bash
git add -A
git commit -m "feat: redesign documents list, upload form and document word list"
```

---

### Task 7: 홈

**Files:**
- Create: `src/components/start-study-button.tsx`
- Modify: `src/app/page.tsx` (전체 교체)

- [ ] **Step 1: 복습 시작 버튼** — `src/components/start-study-button.tsx`

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { isNativeSpaceTarget, isTypingTarget } from "@/lib/ui/keys";

// 홈의 "복습 시작". 화면 어디서나 Enter로도 시작한다(입력칸·버튼 위에서는 그 요소가 Enter를 받는다).
export function StartStudyButton() {
  const router = useRouter();
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLInputElement | null;
      if (e.key !== "Enter" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(target) || isNativeSpaceTarget(target) || target?.tagName === "A") return;
      router.push("/study");
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [router]);

  return (
    <Link href="/study" className={buttonClass({ variant: "primary" })}>
      복습 시작 <Kbd onAccent>Enter</Kbd>
    </Link>
  );
}
```

- [ ] **Step 2: 홈** — `src/app/page.tsx`

```tsx
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DocumentStatusLabel, documentHref, KIND_LABEL } from "@/components/document-status";
import { StartStudyButton } from "@/components/start-study-button";
import { Notice } from "@/components/ui/notice";
import { getDb } from "@/server/db/client";
import { countFailedMeaningsByDocument, countOccurrencesByDocument } from "@/server/repo/cards";
import { countCandidatesByDocument } from "@/server/repo/candidates";
import { listDocuments } from "@/server/repo/documents";
import { getSettings } from "@/server/repo/settings";
import { countStudyToday } from "@/server/repo/study";

const RECENT_DOCUMENTS = 5;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-10 py-8 max-[900px]:px-4">
      <h1 className="sr-only">홈</h1>
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <TodaySummary />
      </Suspense>
    </main>
  );
}

async function TodaySummary() {
  await connection();
  const db = getDb();
  const now = new Date();
  const settings = getSettings(db);
  const { review, fresh } = countStudyToday(db, now, settings.dailyNewLimit);
  const docs = listDocuments(db);
  const recent = docs.slice(0, RECENT_DOCUMENTS);
  const wordCounts = countOccurrencesByDocument(db);
  const candidateCounts = countCandidatesByDocument(db);
  const failedCounts = countFailedMeaningsByDocument(db);
  const totalFailed = [...failedCounts.values()].reduce((a, b) => a + b, 0);
  const missingKey = !process.env.GEMINI_API_KEY;

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-6 max-[900px]:grid-cols-1">
        <section className="rounded-lg border border-line bg-surface p-7 shadow-1">
          <p className="text-[13px] font-semibold text-muted">
            오늘의 복습 · {now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
          </p>
          {review + fresh > 0 ? (
            <>
              <div className="mt-3.5 mb-6 flex gap-9">
                <div className="grid">
                  <b className="text-[40px] leading-[1.1] font-bold tracking-[-0.02em] tabular-nums">{review}</b>
                  <span className="text-[13px] text-muted">복습할 카드</span>
                </div>
                <div className="grid">
                  <b className="text-[40px] leading-[1.1] font-bold tracking-[-0.02em] tabular-nums">{fresh}</b>
                  <span className="text-[13px] text-muted">새 카드 (하루 상한 {settings.dailyNewLimit})</span>
                </div>
              </div>
              <StartStudyButton />
            </>
          ) : (
            <p className="mt-4 text-ink-2">오늘 복습할 카드가 없습니다.</p>
          )}
        </section>

        <section className="rounded-lg border border-line bg-surface py-2 shadow-1">
          <h2 className="mx-5 mt-2 mb-1 flex justify-between text-[13px] font-semibold text-muted">
            <span>최근 문서</span>
            <Link href="/documents" className="text-accent">
              PDF 올리기
            </Link>
          </h2>
          {recent.length === 0 ? (
            <p className="px-5 py-3 text-sm text-muted">아직 올린 문서가 없습니다.</p>
          ) : (
            recent.map((doc) => {
              const words = wordCounts.get(doc.id) ?? 0;
              const failed = failedCounts.get(doc.id) ?? 0;
              const href = documentHref(doc, words);
              const meta = [
                KIND_LABEL[doc.kind],
                doc.status === "reviewing" ? `후보 ${candidateCounts.get(doc.id) ?? 0}개` : `단어 ${words}개`,
                failed > 0 ? `뜻 ${failed}개 생성 실패` : null,
                doc.createdAt.toLocaleDateString("ko-KR", { month: "long", day: "numeric" }),
              ].filter(Boolean);
              const body = (
                <>
                  <span className="font-en text-base font-bold">{doc.title}</span>
                  <DocumentStatusLabel status={doc.status} />
                  <span className="col-start-1 text-[12.5px] text-muted">{meta.join(" · ")}</span>
                </>
              );
              const rowClass = "grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-line px-5 py-3";
              return href ? (
                <Link key={doc.id} href={href} className={`${rowClass} hover:bg-sunken/60`}>
                  {body}
                </Link>
              ) : (
                <div key={doc.id} className={rowClass}>
                  {body}
                </div>
              );
            })
          )}
        </section>
      </div>

      {totalFailed > 0 && (
        <Notice className="mt-5">
          {missingKey
            ? "GEMINI_API_KEY가 설정되지 않아 문맥 뜻을 만들지 못하고 있습니다."
            : `문맥 뜻 ${totalFailed}개를 만들지 못했습니다.`}{" "}
          단어와 원문 문장은 그대로 복습할 수 있습니다.
        </Notice>
      )}
    </>
  );
}
```

- [ ] **Step 3: 전체 확인과 커밋**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 135 tests PASS, 오류 0, 빌드 성공. 라우트 표에서 `/`, `/documents`, `/documents/[id]`, `/documents/[id]/review`, `/study`가 모두 `◐`여야 한다.

```bash
git add -A
git commit -m "feat: redesign the home screen with today's summary and recent documents"
```

---

### Task 8: 화면 확인, Designer 검수, 병합

- [ ] **Step 1: 토큰 밖 색 검사** — 출력이 없어야 한다

```bash
grep -rnE --include=*.ts --include=*.tsx "(bg|text|border)-(white|black|gray|red|yellow|blue|green)(-[0-9]+)?\b|dark:" src/app src/components
```

- [ ] **Step 2: 화면 확인 (라이트·다크)**

데모 DB 사본으로 `npm run build && SLAVE_VOCA_DB=<사본 경로> npx next start -p 3200`을 실행한다. 3000번은 다른 프로젝트가 쓴다. 검토 대기 문서가 없으면 PDF를 하나 올린다. 헤드리스 Edge(playwright-core, `colorScheme: 'light' | 'dark'`)로 아래 화면을 찍어 `docs/superpowers/notes/ui-redesign-shots/`에 둔다. 스크린샷은 커밋하지 않고 결과 문서에만 적는다.
- `/`, `/documents`, `/documents/[완료 문서]`, `/documents/[검토 대기]/review`, `/study` 앞면·뒷면
- 확인할 것: 다크에서 배지·버튼·안내 줄이 다 보이는지. 숫자 앞뒤가 벌어지지 않는지("뜻 206개"). IPA `/ˌæktəˈveɪʃən/`과 θ가 든 단어(예: `method` /ˈmɛθəd/)가 한 글꼴로 나오는지. 문서 단어 목록의 "문맥 뜻" 열이 눌리지 않는지(260px).

- [ ] **Step 3: 키보드 흐름 확인**

PM이 계획을 쓰며 같은 방식으로 확인한 결과다. 같은 값이 나와야 한다.
- 검토: 첫 행 체크박스 클릭 → 다섯째 행 Shift+클릭 → "해제한 5개", "해제함" 필터 행 수 5. `J` `X`로 한 행이 바뀐다. 체크박스에 포커스가 있을 때 Space는 한 번만 바뀐다.
- 복습: 뒷면의 답 버튼에 "1분 뒤 / 6분 뒤 / 10분 뒤"(새 카드 기준). `Space`, `1`/`3`만으로 20장을 마치면 완료 화면에 "카드 20장 · 응답 N번 · 모름 M"과 "20장은 약 10분 뒤 다시 나옵니다 · 다시 확인"이 나온다. 완료 화면에서 `Enter`를 누르면 홈으로 간다.
- 홈: `Enter`로 복습이 시작된다. 상단 메뉴의 현재 위치가 표시되고, 복습 옆 배지가 오늘 남은 수다.

- [ ] **Step 4: Designer 검수**

Designer 세션에 브랜치 이름과 실행 방법, 스크린샷 경로를 보내 목업(`a-paper.html`)과 비교 검수를 받는다. 지적 사항 중 토큰·간격·글꼴 같은 시각 수정은 반영하고, 기능이 바뀌는 지적은 PM에게 먼저 묻는다.

- [ ] **Step 5: 결과 문서, 리뷰, 병합**

`docs/superpowers/notes/2026-10-15-ui-redesign-check.md`에 Step 1~4 결과를 적고 커밋한다. CodeReviewer 최종 리뷰 후 main에 로컬 병합(`--no-ff`)한다. main에서 test·typecheck·lint·build 결과, 병합 커밋 해시, Designer 검수 요약을 PM에게 보낸다.
