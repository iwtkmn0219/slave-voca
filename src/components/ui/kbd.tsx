// 단축키 표시. onAccent면 주 버튼 안에서 버튼 글자색을 따른다.
export function Kbd({ children, onAccent = false }: { children: React.ReactNode; onAccent?: boolean }) {
  const tone = onAccent
    ? "border-on-accent/45 bg-transparent text-on-accent"
    : "border-line-strong bg-surface text-muted";
  return (
    <kbd
      className={`rounded-sm border border-b-2 px-[5px] py-[2px] font-sans text-[11px] leading-none font-medium ${tone}`}
    >
      {children}
    </kbd>
  );
}
