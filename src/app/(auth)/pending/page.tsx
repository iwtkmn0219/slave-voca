import type { Metadata } from "next";
import { Suspense } from "react";
import { Status } from "@/components/ui/status";
import { AccountStatus, AccountStatusFallback } from "../account-status";
import { RefreshOnFocus } from "./refresh-on-focus";

export const metadata: Metadata = { title: "승인 대기 · slave-voca" };

export default function PendingPage() {
  return (
    <>
      <RefreshOnFocus />
      <p className="mb-2.5">
        <Status tone="wait">승인 대기</Status>
      </p>
      <h1 className="text-2xl leading-[1.35] font-bold tracking-[-0.01em]">승인을 기다리고 있습니다</h1>
      <p className="mt-2.5 text-[15px] leading-[1.6] text-ink-2">
        관리자가 확인하면 바로 쓸 수 있습니다. 승인이 끝나면 이 화면이 저절로 넘어가니, 나중에 이 주소로 다시 들어오면
        됩니다.
      </p>
      <Suspense fallback={<AccountStatusFallback />}>
        <AccountStatus expected="pending">
          <p className="mt-3.5 text-[13px] text-muted">다른 계정으로 들어가려면 로그아웃한 뒤 다시 로그인하세요.</p>
        </AccountStatus>
      </Suspense>
    </>
  );
}
