import { Suspense } from "react";
import { requireAdmin } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { listUsers } from "@/server/repo/users";
import { UserRowActions } from "./user-row-actions";

const STATUS_LABEL = { pending: "승인 대기", approved: "승인됨", blocked: "차단됨" } as const;

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-[1000px] px-10 py-8 max-[900px]:px-4">
      <h1 className="text-[26px] font-bold">사용자</h1>
      <Suspense fallback={<p className="mt-6 text-muted">불러오는 중…</p>}>
        <UserTable />
      </Suspense>
    </main>
  );
}

async function UserTable() {
  const admin = await requireAdmin();
  const rows = listUsers(getDb());
  return (
    <table className="mt-6 w-full text-sm">
      <thead className="text-left text-muted">
        <tr>
          <th className="py-2 font-semibold">이름</th>
          <th className="py-2 font-semibold">이메일</th>
          <th className="py-2 font-semibold">상태</th>
          <th className="py-2 font-semibold">가입</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {rows.map((u) => (
          <tr key={u.id} className="border-t border-line">
            <td className="py-2.5">{u.name}</td>
            <td className="py-2.5 text-muted">{u.email}</td>
            <td className="py-2.5">{STATUS_LABEL[u.status]}</td>
            <td className="py-2.5 text-muted tabular-nums">{u.createdAt.toLocaleString("ko-KR")}</td>
            <td className="py-2.5 text-right">
              <UserRowActions userId={u.id} status={u.status} isSelf={u.id === admin.id} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
