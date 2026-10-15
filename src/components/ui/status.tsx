// 상태 표시: 점(또는 회전 고리) + 글자. 넓은 면을 칠하지 않는다(제안서 7장).
export type StatusTone = "ok" | "wait" | "busy" | "err" | "idle";

const DOT: Record<Exclude<StatusTone, "busy">, string> = {
  ok: "bg-good",
  wait: "bg-accent",
  err: "bg-again",
  idle: "bg-faint",
};

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-[9px] animate-[spin_1s_linear_infinite] rounded-full border-[1.5px] border-accent border-r-transparent ${className}`}
    />
  );
}

export function Status({
  tone,
  children,
  className = "",
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-2 ${className}`}>
      {tone === "busy" ? (
        <Spinner />
      ) : (
        <span aria-hidden className={`size-[7px] rounded-full ${DOT[tone]}`} />
      )}
      <span>{children}</span>
    </span>
  );
}

// 뜻 생성 실패 같은 흔한 실패: 짧은 점선 + 회색 글자.
// 글자는 span 하나로 감싼다. 그러지 않으면 flex gap이 숫자 앞뒤에 끼어 "뜻  206  개"처럼 벌어진다.
export function Failed({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      <span aria-hidden className="w-2.5 border-t-[1.5px] border-dashed border-again" />
      <span>{children}</span>
    </span>
  );
}
