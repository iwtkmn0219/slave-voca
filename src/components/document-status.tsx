import { Status, type StatusTone } from "@/components/ui/status";
import type { DocumentRow, DocumentStatus } from "@/server/db/schema";

const STATUS: Record<DocumentStatus, { tone: StatusTone; label: string }> = {
  extracting: { tone: "busy", label: "추출 중" },
  reviewing: { tone: "wait", label: "검토 대기" },
  processing: { tone: "busy", label: "뜻 채우는 중" },
  done: { tone: "ok", label: "완료" },
  error: { tone: "err", label: "오류" },
};

export function DocumentStatusLabel({ status }: { status: DocumentStatus }) {
  const s = STATUS[status];
  return <Status tone={s.tone}>{s.label}</Status>;
}

// 문서를 누르면 갈 곳. 검토 대기는 검토 화면, 카드가 있는 문서(오류 포함)는 단어 목록, 나머지는 없음.
export function documentHref(doc: Pick<DocumentRow, "id" | "status">, wordCount: number): string | null {
  if (doc.status === "reviewing") return `/documents/${doc.id}/review`;
  if (doc.status === "done" || doc.status === "processing" || wordCount > 0) return `/documents/${doc.id}`;
  return null;
}

export const KIND_LABEL = { paper: "논문", presentation: "발표" } as const;
