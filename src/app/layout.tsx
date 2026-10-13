import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "slave-voca",
  description: "논문·발표 자료 단어장",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <nav className="flex gap-6 border-b px-8 py-4 text-sm">
          <Link href="/" className="font-semibold">
            slave-voca
          </Link>
          <Link href="/documents">문서</Link>
        </nav>
        <div className="mx-auto w-full max-w-5xl flex-1 px-8 py-8">{children}</div>
      </body>
    </html>
  );
}
