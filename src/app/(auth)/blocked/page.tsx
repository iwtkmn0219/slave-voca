import type { Metadata } from "next";
import { Suspense } from "react";
import { Status } from "@/components/ui/status";
import { AccountStatus, AccountStatusFallback } from "../account-status";

export const metadata: Metadata = { title: "사용할 수 없음 · slave-voca" };

// 사용 중지는 경고가 아니라 상태를 알리는 화면이라 빨간 점을 쓰지 않는다(idle).
export default function BlockedPage() {
  return (
    <>
      <p className="mb-2.5">
        <Status tone="idle">사용 중지됨</Status>
      </p>
      <h1 className="text-2xl leading-[1.35] font-bold tracking-[-0.01em]">이 계정으로는 쓸 수 없습니다</h1>
      <p className="mt-2.5 text-[15px] leading-[1.6] text-ink-2">
        관리자가 이 계정의 사용을 멈췄습니다. 잘못된 것 같다면 초대해 준 분께 알려 주세요.
      </p>
      <Suspense fallback={<AccountStatusFallback />}>
        <AccountStatus expected="blocked" />
      </Suspense>
    </>
  );
}
