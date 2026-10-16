import { Suspense } from "react";
import { formatJoinedAt } from "@/lib/auth/display";
import { requireAdmin } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { countUsersByStatus, listUsers } from "@/server/repo/users";
import { monthlySpendUsd, monthlyWordsByUser } from "@/server/repo/usage";
import { kstMonthRange, readUsageLimits } from "@/lib/usage/limits";
import { usd, UsageCost } from "./usage-cost";
import { UserTable } from "./user-table";

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-[880px] px-4 pt-8 pb-12">
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
  const limits = readUsageLimits();
  const words = monthlyWordsByUser(db, now);
  // 한국 시간 그 달 1일. 서버 시간대와 상관없이 "10월 1일"로 쓴다.
  const since = `${Number(kstMonthRange(now).key.slice(5))}월 1일`;
  const rows = listUsers(db).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    status: u.status,
    role: u.role,
    joined: formatJoinedAt(u.createdAt, now),
    monthWords: words.get(u.id) ?? 0,
  }));
  return (
    <>
      <p className="mt-1 mb-5 text-sm text-muted tabular-nums">{summaryLine(countUsersByStatus(db))}</p>
      <UsageCost spentUsd={monthlySpendUsd(db, now)} budgetUsd={limits.monthlyBudgetUsd} since={since} />
      <UserTable rows={rows} selfId={admin.id} wordLimit={limits.monthlyWords} />
      <p className="mt-3 text-[12.5px] text-muted">
        한도: 사용자당 월 {limits.monthlyWords.toLocaleString("ko-KR")}단어 · 전체 월 {usd(limits.monthlyBudgetUsd)}
      </p>
    </>
  );
}
