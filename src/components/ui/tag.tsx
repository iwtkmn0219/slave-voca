// 배지. "이미 학습 중"(정보)과 "새 카드"는 칠하고, "사전에 없음"(의심)은 점선 테두리만 둔다.
export type TagKind = "learning" | "nodict" | "new";

const STYLES: Record<TagKind, string> = {
  learning: "border-transparent bg-accent-soft text-accent",
  nodict: "border-dashed border-line-strong text-muted",
  new: "border-transparent bg-good-soft text-good",
};

const LABELS: Record<TagKind, string> = {
  learning: "이미 학습 중",
  nodict: "사전에 없음",
  new: "새 카드",
};

export function Tag({ kind }: { kind: TagKind }) {
  return (
    <span
      className={`rounded-sm border px-1.5 py-px font-sans text-[11.5px] font-semibold whitespace-nowrap ${STYLES[kind]}`}
    >
      {LABELS[kind]}
    </span>
  );
}
