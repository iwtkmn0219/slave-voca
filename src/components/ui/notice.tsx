// 화면 단위 안내 한 줄: 왼쪽 색 줄 + 면 색 바탕. 화면 전체를 경고색으로 칠하지 않는다.
// 글자와 숫자·링크가 한 문장으로 이어지도록 flex가 아닌 일반 문단으로 둔다.
// tone: 기본(hard, 주의) / neutral(경고가 아닌 안내) / error(실패). error는 화면 읽기 프로그램에 바로 알린다.
export type NoticeTone = "default" | "neutral" | "error";

const BAR: Record<NoticeTone, string> = {
  default: "border-hard",
  neutral: "border-line-strong",
  error: "border-again",
};

// alert: 사용자가 누른 동작의 결과처럼 바로 알려야 하는 안내(예: 이번 달 한도). 색은 tone대로 둔다.
export function Notice({
  children,
  className = "",
  tone = "default",
  alert = false,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: NoticeTone;
  alert?: boolean;
}) {
  return (
    <p
      role={alert || tone === "error" ? "alert" : "status"}
      className={`rounded-r-md border-l-[3px] ${BAR[tone]} bg-surface px-3.5 py-2.5 text-[13px] text-ink-2 [&_a]:ml-1.5 ${className}`}
    >
      {children}
    </p>
  );
}
