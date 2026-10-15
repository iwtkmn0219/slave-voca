"use client";

import { useLayoutEffect } from "react";
import { isTheme, THEME_COOKIE } from "@/lib/settings";
import { applyTheme } from "@/lib/ui/theme";

// 개발 모드의 Strict Mode 재마운트가 <html>의 data-theme를 지우므로 쿠키에서 다시 적용한다.
// 배포 빌드에서는 인라인 스크립트가 이미 적용한 값을 한 번 더 쓸 뿐이다.
export function ThemeSync() {
  useLayoutEffect(() => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
    const theme = m?.[1];
    applyTheme(isTheme(theme) ? theme : "system");
  }, []);
  return null;
}
