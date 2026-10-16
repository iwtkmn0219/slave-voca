import { AuthShell } from "@/components/auth/auth-shell";

// 로그인·승인 대기·사용 중지 화면의 틀. 상단 바가 없다(앱 안으로 들어가는 길이 없는 상태).
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <AuthShell>{children}</AuthShell>;
}
