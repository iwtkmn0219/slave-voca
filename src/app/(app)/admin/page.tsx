import { Suspense } from "react";
import { formatJoinedAt } from "@/lib/auth/display";
import { requireAdmin } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { countUsersByStatus, listUsers } from "@/server/repo/users";
import { UserTable } from "./user-table";

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-8 pb-12">
      <h1 className="text-[26px] font-bold">사용자</h1>
      <Suspense fallback={<p className="mt-4 text-muted">불러오는 중…</p>}>
        <Users />
      </Suspense>
    </main>
  );
}

// 요약 줄: "대기 2 · 승인 7 · 사용 중지 1". 0인 항목은 뺀다(화면 규칙 6.1).
function summaryLine(counts: { pending: number; approved: number; blocked: number }): string {
  const parts: string[] = [];
  if (counts.pending > 0) parts.push(`대기 ${counts.pending}`);
  if (counts.approved > 0) parts.push(`승인 ${counts.approved}`);
  if (counts.blocked > 0) parts.push(`사용 중지 ${counts.blocked}`);
  return parts.join(" · ");
}

async function Users() {
  const admin = await requireAdmin();
  const db = getDb();
  const now = new Date();
  const rows = listUsers(db).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    status: u.status,
    role: u.role,
    joined: formatJoinedAt(u.createdAt, now),
  }));
  return (
    <>
      <p className="mt-1 mb-5 text-sm text-muted tabular-nums">{summaryLine(countUsersByStatus(db))}</p>
      <UserTable rows={rows} selfId={admin.id} />
    </>
  );
}
