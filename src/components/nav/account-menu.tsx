import { displayName } from "@/lib/auth/display";
import { getSessionUser } from "@/server/auth/current-user";
import { AccountMenuButton } from "./account-menu-button";

// 상단 바 오른쪽 끝: 구분선 + 계정 버튼(화면 규칙 5.2). 세션을 읽으므로 레이아웃의 <Suspense> 안에서 그린다.
export async function AccountMenu() {
  const user = await getSessionUser();
  if (user?.status !== "approved") return null;
  return <AccountMenuButton name={displayName(user.name, user.email)} fullName={user.name} email={user.email} />;
}
