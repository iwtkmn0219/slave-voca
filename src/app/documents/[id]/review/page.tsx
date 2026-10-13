import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/server/db/client";
import { listCandidates } from "@/server/repo/candidates";
import { getDocument } from "@/server/repo/documents";
import { CandidateTable } from "./candidate-table";

export default function ReviewPage({ params }: PageProps<"/documents/[id]/review">) {
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <Review params={params} />
    </Suspense>
  );
}

async function Review({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const db = getDb();
  const doc = getDocument(db, id);
  if (!doc) notFound();
  const candidates = listCandidates(db, id);

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">{doc.title} · 단어 검토</h1>
      {candidates.length === 0 ? (
        <p>외울 단어가 없습니다.</p>
      ) : (
        <CandidateTable
          candidates={candidates.map((c) => ({
            id: c.id,
            lemma: c.lemma,
            surface: c.surface,
            sentence: c.sentence,
            count: c.count,
            isExisting: c.isExisting,
          }))}
        />
      )}
    </main>
  );
}
