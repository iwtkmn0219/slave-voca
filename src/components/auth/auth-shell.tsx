// 로그인 · 승인 대기 · 사용 중지가 같이 쓰는 틀(화면 규칙 1장): 상단 바 없이 가운데 한 열.
// 세로 가운데 정렬은 하지 않는다(휴대폰 키보드나 주소창 때문에 위치가 흔들린다).
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 justify-center px-4 pt-[clamp(48px,12vh,120px)] pb-16">
      <div className="w-full max-w-[400px]">
        <p className="mb-7 text-[13px] font-semibold tracking-[0.02em] text-muted">slave-voca</p>
        {children}
      </div>
    </main>
  );
}
