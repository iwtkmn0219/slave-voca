import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DocumentStatusLabel, documentHref, KIND_LABEL } from "@/components/document-status";
import { Failed } from "@/components/ui/status";
import { getDb } from "@/server/db/client";
import { countFailedMeaningsByDocument, countOccurrencesByDocument } from "@/server/repo/cards";
import { countCandidatesByDocument } from "@/server/repo/candidates";
import { listDocuments } from "@/server/repo/documents";
import { UploadForm } from "./upload-form";

export default function DocumentsPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-10 py-8 max-[900px]:px-4">
      <h1 className="mb-4 text-2xl leading-[1.3] font-bold tracking-[-0.015em]">문서</h1>
      <UploadForm />
      <Suspense fallback={<p className="mt-5 text-muted">불러오는 중…</p>}>
        <DocumentList />
      </Suspense>
    </main>
  );
}

async function DocumentList() {
  await connection();
  const db = getDb();
  const docs = listDocuments(db);
  const candidateCounts = countCandidatesByDocument(db);
  const wordCounts = countOccurrencesByDocument(db);
  const failedCounts = countFailedMeaningsByDocument(db);

  if (docs.length === 0) return <p className="mt-5 text-muted">아직 올린 문서가 없습니다.</p>;

  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line-strong text-left text-xs font-semibold whitespace-nowrap text-muted">
            <th className="px-3 py-2">제목</th>
            <th className="w-20 px-3 py-2">종류</th>
            <th className="w-[130px] px-3 py-2">상태</th>
            <th className="w-[110px] px-3 py-2 text-right">단어</th>
            <th className="w-[120px] px-3 py-2 text-right">올린 날</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => {
            const words = wordCounts.get(doc.id) ?? 0;
            const failed = failedCounts.get(doc.id) ?? 0;
            const href = documentHref(doc, words);
            return (
              <tr key={doc.id} className="relative border-b border-line align-top hover:bg-sunken/60">
                <td className="px-3 py-2.5">
                  {href ? (
                    // 행 전체를 누를 수 있게 링크 영역을 행 크기로 늘린다.
                    <Link href={href} className="font-en text-[17px] font-bold text-ink after:absolute after:inset-0">
                      {doc.title}
                    </Link>
                  ) : (
                    <span className="font-en text-[17px] font-bold text-muted">{doc.title}</span>
                  )}
                  {doc.status === "error" && doc.errorMessage && (
                    <div className="mt-0.5 text-[13px] text-muted">{doc.errorMessage}</div>
                  )}
                  {failed > 0 && (
                    <div className="mt-0.5">
                      <Failed>
                        뜻 <span className="tabular-nums">{failed}</span>개 생성 실패
                      </Failed>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm">{KIND_LABEL[doc.kind]}</td>
                <td className="px-3 py-2.5">
                  <DocumentStatusLabel status={doc.status} />
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                  {doc.status === "reviewing" ? `후보 ${candidateCounts.get(doc.id) ?? 0}` : words || "—"}
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-muted tabular-nums">
                  {doc.createdAt.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
