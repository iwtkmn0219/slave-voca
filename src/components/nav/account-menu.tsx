import Link from "next/link";
import { getSessionUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { countPendingUsers } from "@/server/repo/users";
import { SignOutButton } from "./sign-out-button";

// 상단 바 오른쪽: 로그인한 사람, 관리자 화면(관리자만, 승인 대기 수 배지), 로그아웃.
// 세션을 읽으므로 레이아웃의 <Suspense> 안에서 그린다. 화면 규칙은 Designer 안을 따른다(M6-1 설계 4장).
export async function AccountMenu() {
  const user = await getSessionUser();
  if (user?.status !== "approved") return null;
  const pending = user.role === "admin" ? countPendingUsers(getDb()) : 0;
  return (
    <div className="ml-3 flex items-center gap-2 text-sm">
      {user.role === "admin" && (
        <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-ink-2 hover:bg-sunken">
          관리
          {pending > 0 && <span className="text-xs font-semibold text-accent tabular-nums">{pending}</span>}
        </Link>
      )}
      <span className="max-w-[16ch] truncate text-muted" title={user.email}>
        {user.name || user.email}
      </span>
      <SignOutButton />
    </div>
  );
}
