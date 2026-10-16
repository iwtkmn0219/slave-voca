import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/server/db/client";
import { listCandidates } from "@/server/repo/candidates";
import { getDocument } from "@/server/repo/documents";
import { CandidateTable } from "./candidate-table";
import { requireUser } from "@/server/auth/current-user";

export default function ReviewPage({ params }: PageProps<"/documents/[id]/review">) {
  return (
    <Suspense fallback={<p className="px-10 py-8 text-muted">불러오는 중…</p>}>
      <Review params={params} />
    </Suspense>
  );
}

async function Review({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const db = getDb();
  const doc = getDocument(db, user.id, id);
  if (!doc) notFound();
  const candidates = listCandidates(db, user.id, id);

  return (
    <main className="mx-auto w-full max-w-[1200px] pb-10">
      <div className="px-10 pt-6 pb-3 max-[900px]:px-4">
        <p className="text-[13px] text-muted">
          <Link href="/documents" className="hover:text-ink">
            문서
          </Link>{" "}
          › 단어 검토
        </p>
        <h1 className="mt-1 font-en text-[26px] leading-[1.3] font-bold">{doc.title}</h1>
      </div>
      {candidates.length === 0 ? (
        <p className="px-10 py-6 text-ink-2">
          외울 단어가 없습니다.{" "}
          <Link href="/documents" className="font-semibold text-accent">
            문서 목록으로
          </Link>
        </p>
      ) : (
        <CandidateTable
          documentId={doc.id}
          candidates={candidates.map((c) => ({
            id: c.id,
            lemma: c.lemma,
            surface: c.surface,
            sentence: c.sentence,
            count: c.count,
            isExisting: c.isExisting,
            inDictionary: c.inDictionary,
          }))}
        />
      )}
    </main>
  );
}
