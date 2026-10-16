import type { Metadata } from "next";
import { Gentium_Book_Plus } from "next/font/google";
import localFont from "next/font/local";
import { ThemeSync } from "@/components/theme-sync";
import { THEME_SCRIPT } from "@/lib/ui/theme";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme는 <head>의 인라인 스크립트가 붙인다(쿠키). React가 모르는 속성이라 경고를 끈다.
    <html lang="ko" className={`${pretendard.variable} ${gentium.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
