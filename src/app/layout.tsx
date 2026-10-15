import type { Metadata } from "next";
import { Gentium_Book_Plus } from "next/font/google";
import localFont from "next/font/local";
import { connection } from "next/server";
import { Suspense } from "react";
import { NavLinks, NavLinksFallback } from "@/components/nav/nav-links";
import { ThemeSync } from "@/components/theme-sync";
import { THEME_SCRIPT } from "@/lib/ui/theme";
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
    // data-theme는 <head>의 인라인 스크립트가 붙인다(쿠키). React가 모르는 속성이라 경고를 끈다.
    <html lang="ko" className={`${pretendard.variable} ${gentium.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeSync />
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
