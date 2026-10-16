import { Initial } from "@/components/ui/initial";
import { SignOutButton } from "@/components/nav/sign-out-button";

// 승인 대기·사용 중지 화면의 계정 칸(화면 규칙 3.2): [머리글자] [이름 / 이메일] [로그아웃].
// 이름이 없으면 이메일 한 줄만 쓴다.
export function AccountCard({ name, email }: { name: string; email: string }) {
  const hasName = name.trim() !== "";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface py-3 pr-3 pl-3.5">
      <Initial name={name} email={email} size="md" />
      <div className="min-w-0 flex-1 leading-[1.4]">
        {hasName && <b className="block truncate text-sm font-semibold">{name}</b>}
        <span className={`block truncate ${hasName ? "text-[13px] text-muted" : "text-sm font-semibold"}`}>{email}</span>
      </div>
      <SignOutButton />
    </div>
  );
}
