import { Suspense } from "react";
import { AccountStatus } from "../account-status";
import { RefreshOnFocus } from "./refresh-on-focus";

export default function PendingPage() {
  return (
    <>
      <RefreshOnFocus />
      <h1 className="text-[22px] font-bold">승인을 기다리고 있습니다</h1>
      <Suspense fallback={<p className="mt-4 text-muted">불러오는 중…</p>}>
        <AccountStatus expected="pending">
          <p className="mt-2 text-sm text-muted">관리자가 승인하면 바로 쓸 수 있습니다.</p>
        </AccountStatus>
      </Suspense>
    </>
  );
}
