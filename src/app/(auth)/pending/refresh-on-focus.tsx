"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// 탭이 다시 보일 때 한 번 다시 그려 승인됐는지 확인한다(화면 규칙 3.3). 주기적으로 묻지는 않는다.
// 승인됐으면 서버의 AccountStatus가 홈으로 보낸다.
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [router]);
  return null;
}
