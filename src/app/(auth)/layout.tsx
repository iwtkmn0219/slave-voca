// 로그인·승인 대기·차단 화면의 틀. 메뉴 없이 가운데 카드 하나. 좁은 폭에서도 깨지지 않게 한다.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] rounded-lg border border-line bg-surface p-8 shadow-1">{children}</div>
    </main>
  );
}
