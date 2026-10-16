"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

// 로그아웃하면 세션 쿠키를 지우고 로그인 화면으로 간다.
export function SignOutButton() {
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
      className="rounded-md px-3 py-1.5 text-ink-2 hover:bg-sunken disabled:opacity-60"
    >
      로그아웃
    </button>
  );
}
