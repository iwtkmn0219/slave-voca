import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { KIND_LABEL } from "@/components/document-status";
import { Notice } from "@/components/ui/notice";
import { getDb } from "@/server/db/client";
import { countOccurrencesByWord, listOccurrencesByDocument } from "@/server/repo/cards";
import { getDocument } from "@/server/repo/documents";
import { FailedMeaningsNotice } from "./retry-all-button";
import { WordTable } from "./word-table";
import { requireUser } from "@/server/auth/current-user";

// 문서 단어 목록. 뜻 고치기·다시 시도·카드 삭제는 표(WordTable)에서, 문서 전체 다시 시도는 안내 줄에서 한다.
export default function DocumentWordsPage({ params }: PageProps<"/documents/[id]">) {
  return (
    <Suspense fallback={<p className="px-10 py-8 text-muted">불러오는 중…</p>}>
      <DocumentWords params={params} />
    </Suspense>
  );
}

async function DocumentWords({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const db = getDb();
  const doc = getDocument(db, user.id, id);
  if (!doc) notFound();
  const rows = listOccurrencesByDocument(db, user.id, id);
  const usage = countOccurrencesByWord(db, user.id, rows.map((r) => r.wordId));
  const failed = rows.filter((r) => r.meaningStatus === "failed").length;
  const missingKey = !process.env.GEMINI_API_KEY;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-10 py-8 max-[900px]:px-4">
      <p className="text-[13px] text-muted">
        <Link href="/documents" className="hover:text-ink">
          문서
        </Link>
      </p>
      <h1 className="mt-1 font-en text-[26px] leading-[1.3] font-bold">{doc.title}</h1>
      <p className="mt-1 text-[13px] text-muted">
        {KIND_LABEL[doc.kind]} · 단어 <span className="tabular-nums">{rows.length}</span>개 ·{" "}
        {doc.createdAt.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 올림
      </p>

      {doc.status === "reviewing" && (
        <Notice className="mt-4">
          아직 검토하지 않은 문서입니다.
          <Link href={`/documents/${doc.id}/review`} className="font-semibold text-accent">
            검토하러 가기
          </Link>
        </Notice>
      )}
      {doc.status === "error" && doc.errorMessage && <Notice className="mt-4">{doc.errorMessage}</Notice>}
      {failed > 0 && <FailedMeaningsNotice documentId={doc.id} failed={failed} missingKey={missingKey} />}

      <WordTable documentId={doc.id} rows={rows.map((r) => ({ ...r, usageCount: usage.get(r.wordId) ?? 1 }))} />
    </main>
  );
}
