import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { highlight } from "@/lib/text/highlight";
import { getDb } from "@/server/db/client";
import { listOccurrencesByDocument } from "@/server/repo/cards";
import { getDocument } from "@/server/repo/documents";

// 문서 단어 목록(읽기 전용). 뜻 수정·재시도·카드 삭제는 마일스톤 4에서 붙인다.
export default function DocumentWordsPage({ params }: PageProps<"/documents/[id]">) {
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <DocumentWords params={params} />
    </Suspense>
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
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">{doc.title} · 단어 {rows.length}개</h1>
      {doc.status === "reviewing" && (
        <p>
          아직 검토하지 않은 문서입니다.{" "}
          <Link href={`/documents/${doc.id}/review`} className="underline">
            검토하러 가기
          </Link>
        </p>
      )}
      {failed > 0 && (
        <p role="alert" className="rounded bg-yellow-50 p-3 text-sm">
          {missingKey
            ? `GEMINI_API_KEY가 설정되지 않아 뜻 ${failed}개를 만들지 못했습니다. .env.local에 키를 넣고 서버를 다시 시작하세요.`
            : `뜻 ${failed}개를 만들지 못했습니다.`}
        </p>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">단어</th>
            <th>발음기호</th>
            <th>문맥 뜻</th>
            <th>원문 문장</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b align-top">
              <td className="py-2 font-medium">{r.lemma}</td>
              <td className="py-2 text-gray-600">{r.phonetic ?? "—"}</td>
              <td className="py-2">
                {r.meaningStatus === "done"
                  ? r.meaningKo
                  : r.meaningStatus === "failed"
                    ? <span className="text-red-600">실패</span>
                    : <span className="text-gray-500">생성 중</span>}
              </td>
              <td className="py-2">
                {highlight(r.sentence, r.surface).map((seg, i) =>
                  seg.match ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
