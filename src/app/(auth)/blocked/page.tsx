import { Suspense } from "react";
import { AccountStatus } from "../account-status";

export default function BlockedPage() {
  return (
    <>
      <h1 className="text-[22px] font-bold">사용할 수 없는 계정입니다</h1>
      <Suspense fallback={<p className="mt-4 text-muted">불러오는 중…</p>}>
        <AccountStatus expected="blocked">
          <p className="mt-2 text-sm text-muted">관리자에게 문의해 주세요.</p>
        </AccountStatus>
      </Suspense>
    </>
  );
}
