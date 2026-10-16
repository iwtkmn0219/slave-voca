import { redirect } from "next/navigation";
import { accessRedirect } from "@/lib/auth/policy";
import { getSessionUser } from "@/server/auth/current-user";
import type { UserStatus } from "@/server/db/auth-schema";
import { SignOutButton } from "@/components/nav/sign-out-button";

// 승인 대기·차단 화면의 본문. 지금 상태가 이 화면과 다르면 맞는 곳으로 보낸다(승인되면 홈으로).
export async function AccountStatus({ expected, children }: { expected: UserStatus; children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== expected) redirect(accessRedirect(user) ?? "/");
  return (
    <>
      {children}
      <p className="mt-5 text-sm">
        <span className="font-semibold">{user.name}</span>
        <span className="ml-2 text-muted">{user.email}</span>
      </p>
      <div className="mt-4">
        <SignOutButton />
      </div>
    </>
  );
}
