import { redirect } from "next/navigation";
import { accessRedirect } from "@/lib/auth/policy";
import { getSessionUser } from "@/server/auth/current-user";
import type { UserStatus } from "@/server/db/auth-schema";
import { AccountCard } from "@/components/auth/account-card";

// 승인 대기·사용 중지 화면의 계정 칸. 지금 상태가 이 화면과 다르면 맞는 곳으로 보낸다(승인되면 홈으로).
export async function AccountStatus({ expected, children }: { expected: UserStatus; children?: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== expected) redirect(accessRedirect(user) ?? "/");
  return (
    <>
      <div className="mt-6">
        <AccountCard name={user.name} email={user.email} />
      </div>
      {children}
    </>
  );
}

// 계정 칸을 기다리는 동안 같은 높이를 잡아 둔다.
export function AccountStatusFallback() {
  return <div className="mt-6 h-[58px] rounded-lg border border-line bg-surface" />;
}
