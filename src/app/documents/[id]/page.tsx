import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { KIND_LABEL } from "@/components/document-status";
import { Highlighted } from "@/components/ui/highlighted";
import { Notice } from "@/components/ui/notice";
import { Failed, Spinner } from "@/components/ui/status";
import { getDb } from "@/server/db/client";
import { listOccurrencesByDocument, type OccurrenceView } from "@/server/repo/cards";
import { getDocument } from "@/server/repo/documents";

// 문서 단어 목록(읽기 전용). 뜻 수정·재시도·카드 삭제는 마일스톤 4에서 붙인다.
export default function DocumentWordsPage({ params }: PageProps<"/documents/[id]">) {
  return (
    <Suspense fallback={<p className="px-10 py-8 text-muted">불러오는 중…</p>}>
      <DocumentWords params={params} />
    </Suspense>
  );
}

function MeaningCell({ row }: { row: OccurrenceView }) {
  if (row.meaningStatus === "done") return <span className="text-[15px] font-semibold text-ink">{row.meaningKo}</span>;
  if (row.meaningStatus === "failed") return <Failed>생성 실패</Failed>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      <Spinner /> 뜻 만드는 중
    </span>
  );
}

async function DocumentWords({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const db = getDb();
  const doc = getDocument(db, id);
  if (!doc) notFound();
  const rows = listOccurrencesByDocument(db, id);
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
      {failed > 0 && (
        <Notice className="mt-4">
          뜻 <span className="tabular-nums">{failed}</span>개를 만들지 못했습니다
          {missingKey && (
            <>
              {" "}
              · GEMINI_API_KEY 없음.{" "}
              <span className="text-muted">.env.local에 키를 넣고 서버를 다시 시작하세요.</span>
            </>
          )}
        </Notice>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line-strong text-left text-xs font-semibold whitespace-nowrap text-muted">
              <th className="w-[200px] px-3 py-2">단어</th>
              <th className="w-[260px] px-3 py-2">문맥 뜻</th>
              <th className="px-3 py-2">원문 문장</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line align-top hover:bg-sunken/60">
                <td className="px-3 py-2.5">
                  <div className="font-en text-[17px] font-bold">{r.lemma}</div>
                  <div className={`font-en text-sm ${r.phonetic ? "text-muted" : "text-faint"}`}>
                    {r.phonetic ?? "발음기호 없음"}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <MeaningCell row={r} />
                </td>
                <td className="px-3 py-2.5 font-en text-[15.5px] leading-[1.55] text-ink-2">
                  <Highlighted sentence={r.sentence} word={r.surface} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
