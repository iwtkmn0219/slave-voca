import { THEME_COOKIE, type Theme } from "@/lib/settings";

// 화면 테마를 <html data-theme>로 적용한다. system이면 속성을 지워 OS 설정(prefers-color-scheme)을 따른다.
export function applyTheme(theme: Theme): void {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

// 레이아웃 <head>의 인라인 스크립트. HTML을 읽는 중에 실행돼 첫 화면을 그리기 전에 쿠키의 테마를 적용한다.
// 레이아웃이 쿠키를 서버에서 읽으면 앱 전체가 정적 셸을 잃는다(Next 문서 "Preventing flash before hydration").
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)/);if(m)document.documentElement.setAttribute("data-theme",m[1])}catch(e){}})()`;
