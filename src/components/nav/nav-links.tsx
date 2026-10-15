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
