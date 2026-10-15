// 화면 단위 안내 한 줄: 왼쪽 색 줄 + 면 색 바탕. 화면 전체를 경고색으로 칠하지 않는다.
// 글자와 숫자·링크가 한 문장으로 이어지도록 flex가 아닌 일반 문단으로 둔다.
export function Notice({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      role="status"
      className={`rounded-r-md border-l-[3px] border-hard bg-surface px-3.5 py-2.5 text-[13px] text-ink-2 [&_a]:ml-1.5 ${className}`}
    >
      {children}
    </p>
  );
}
