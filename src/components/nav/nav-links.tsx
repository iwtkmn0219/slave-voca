"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// admin: 관리자에게만 "관리" 링크를 그린다. badge는 승인 대기 수(서버에서 받은 배지).
export interface AdminLink {
  badge: React.ReactNode;
}

const LINKS = [
  { href: "/", label: "홈", match: (p: string) => p === "/" },
  { href: "/study", label: "복습", match: (p: string) => p.startsWith("/study") },
  { href: "/documents", label: "문서", match: (p: string) => p.startsWith("/documents") },
  // 오른쪽 끝 묶음(화면 규칙 5.1): [관리] · 설정. ml-auto는 맨 앞 링크가 가진다(관리자면 관리, 아니면 설정).
  { href: "/admin", label: "관리", match: (p: string) => p.startsWith("/admin"), adminOnly: true },
  { href: "/settings", label: "설정", match: (p: string) => p.startsWith("/settings") },
];

function Links({
  pathname,
  studyBadge,
  admin,
}: {
  pathname: string | null;
  studyBadge: React.ReactNode;
  admin: AdminLink | null;
}) {
  const links = LINKS.filter((link) => !link.adminOnly || admin !== null);
  const firstOfEnd = links.find((link) => link.href === "/admin" || link.href === "/settings")?.href;
  return (
    <>
      {links.map((link) => {
        const active = pathname !== null && link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
              link.href === firstOfEnd ? "ml-auto" : ""
            } ${active ? "bg-sunken font-semibold text-ink" : "text-ink-2 hover:bg-sunken"}`}
          >
            {link.label}
            {link.href === "/study" && studyBadge}
            {link.href === "/admin" && admin?.badge}
          </Link>
        );
      })}
    </>
  );
}

// 현재 위치는 sunken 바탕 + 굵은 글씨. 복습 옆에는 오늘 남은 카드 수(서버에서 받은 배지)를 둔다.
export function NavLinks({ studyBadge, admin = null }: { studyBadge: React.ReactNode; admin?: AdminLink | null }) {
  return <Links pathname={usePathname()} studyBadge={studyBadge} admin={admin} />;
}

// usePathname은 요청 시점 값이라 <Suspense> 안에서만 쓸 수 있다(cacheComponents). 그 전까지 보여 줄 같은 모양.
export function NavLinksFallback() {
  return <Links pathname={null} studyBadge={null} admin={null} />;
}
