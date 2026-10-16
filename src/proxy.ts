import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// 세션 쿠키가 아예 없으면 화면을 그리기 전에 로그인으로 보낸다(빠른 1차 확인).
// 쿠키가 있어도 가짜·만료일 수 있으므로, 진짜 확인은 화면·Action의 requireUser()가 한다.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  // 로그인한 뒤 원래 가려던 곳으로 돌려보낸다(화면 규칙 2.4). 홈이면 붙이지 않는다.
  const login = new URL("/login", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  // API(자체 확인), Next 정적 파일, 로그인·승인 대기·차단 화면은 제외한다.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|pending|blocked).*)"],
};
