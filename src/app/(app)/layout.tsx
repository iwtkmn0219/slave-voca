import { Suspense } from "react";
import { AccountMenu } from "@/components/nav/account-menu";
import { NavLinks, NavLinksFallback } from "@/components/nav/nav-links";
import { getSessionUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/repo/settings";
import { countStudyToday } from "@/server/repo/study";
import { countPendingUsers } from "@/server/repo/users";

// 로그인한 사용자가 쓰는 화면들(홈, 복습, 문서, 설정, 관리자)의 공통 틀. 로그인·승인 대기·차단 화면은
// (auth) 그룹에 있어 이 메뉴가 없다.

async function TodayBadge() {
  const user = await getSessionUser();
  if (user?.status !== "approved") return null;
  const db = getDb();
  const { review, fresh } = countStudyToday(db, user.id, new Date(), getSettings(db, user.id).dailyNewLimit);
  const total = review + fresh;
  if (total === 0) return null;
  return <span className="text-xs font-semibold text-accent tabular-nums">{total}</span>;
}

// 관리자에게만: 승인 대기 수 배지(0이면 숨김). 승인·사용 중지 뒤 다시 그려진다.
async function PendingBadge() {
  const user = await getSessionUser();
  if (user?.status !== "approved" || user.role !== "admin") return null;
  const pending = countPendingUsers(getDb());
  if (pending === 0) return null;
  return <span className="text-xs font-semibold text-accent tabular-nums">{pending}</span>;
}

// 관리자인지에 따라 오른쪽 묶음의 "관리" 링크가 달라진다.
async function AppNavLinks() {
  const user = await getSessionUser();
  const isAdmin = user?.status === "approved" && user.role === "admin";
  return (
    <NavLinks
      studyBadge={
        <Suspense fallback={null}>
          <TodayBadge />
        </Suspense>
      }
      admin={
        isAdmin
          ? {
              badge: (
                <Suspense fallback={null}>
                  <PendingBadge />
                </Suspense>
              ),
            }
          : null
      }
    />
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <nav className="flex h-[52px] items-center gap-1 border-b border-line bg-surface px-6">
        <span className="mr-5 text-[13px] font-semibold tracking-[0.02em] text-muted">slave-voca</span>
        <Suspense fallback={<NavLinksFallback />}>
          <AppNavLinks />
        </Suspense>
        <Suspense fallback={null}>
          <AccountMenu />
        </Suspense>
      </nav>
      <div className="flex-1">{children}</div>
    </>
  );
}
