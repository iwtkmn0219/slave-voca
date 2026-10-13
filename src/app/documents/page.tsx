import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/server/db/client";
import type { DocumentStatus } from "@/server/db/schema";
import { countCandidatesByDocument } from "@/server/repo/candidates";
import { listDocuments } from "@/server/repo/documents";
import { UploadForm } from "./upload-form";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  extracting: "추출 중",
  reviewing: "검토 대기",
  processing: "처리 중",
  done: "완료",
  error: "오류",
};

export default function DocumentsPage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">문서</h1>
      <UploadForm />
      <Suspense fallback={<p>불러오는 중…</p>}>
        <DocumentList />
      </Suspense>
    </main>
  );
}

async function DocumentList() {
  await connection();
  const db = getDb();
  const docs = listDocuments(db);
  const counts = countCandidatesByDocument(db);

  if (docs.length === 0) return <p className="text-gray-500">아직 올린 문서가 없습니다.</p>;

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b">
          <th className="py-2">제목</th>
          <th>종류</th>
          <th>상태</th>
          <th>후보 단어</th>
          <th>올린 날짜</th>
        </tr>
      </thead>
      <tbody>
        {docs.map((doc) => (
          <tr key={doc.id} className="border-b">
            <td className="py-2">
              {doc.status === "reviewing" ? (
                <Link href={`/documents/${doc.id}/review`} className="underline">
                  {doc.title}
                </Link>
              ) : (
                doc.title
              )}
            </td>
            <td>{doc.kind === "paper" ? "논문" : "발표"}</td>
            <td>
              {STATUS_LABEL[doc.status]}
              {doc.errorMessage && (
                <span className="block text-xs text-red-600">{doc.errorMessage}</span>
              )}
            </td>
            <td>{counts.get(doc.id) ?? 0}</td>
            <td>{doc.createdAt.toLocaleDateString("ko-KR")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
