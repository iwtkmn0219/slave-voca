"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

// 로그아웃하면 세션 쿠키를 지우고 로그인 화면으로 간다. 확인 대화상자는 띄우지 않는다.
// variant: 계정 칸의 ghost 버튼(button) 또는 계정 팝오버의 항목(menu-item).
export function SignOutButton({ variant = "button" }: { variant?: "button" | "menu-item" }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await authClient.signOut();
        // 이 사용자의 화면이 브라우저 라우터 캐시에 남지 않도록 화면을 통째로 다시 연다.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login");
      }}
      className={
        variant === "button"
          ? buttonClass({ variant: "ghost", size: "sm" })
          : "flex w-full items-center rounded-md px-2.5 py-[7px] text-left text-sm text-ink hover:bg-sunken disabled:opacity-60"
      }
    >
      로그아웃
    </button>
  );
}
