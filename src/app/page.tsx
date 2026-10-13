import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/server/db/client";
import { listDocuments } from "@/server/repo/documents";
import { getSettings } from "@/server/repo/settings";
import { countStudyToday } from "@/server/repo/study";

const RECENT_DOCUMENTS = 5;

export default function Home() {
  return (
    <main className="space-y-8">
      <h1 className="text-2xl font-semibold">slave-voca</h1>
      <Suspense fallback={<p>불러오는 중…</p>}>
        <TodaySummary />
      </Suspense>
    </main>
  );
}

async function TodaySummary() {
  await connection();
  const db = getDb();
  const { review, fresh } = countStudyToday(db, new Date(), getSettings(db).dailyNewLimit);
  const recent = listDocuments(db).slice(0, RECENT_DOCUMENTS);

  return (
    <>
      <section className="space-y-3 rounded border p-6">
        <h2 className="text-lg font-semibold">오늘 복습</h2>
        <p>
          복습 {review}장 · 새 카드 {fresh}장
        </p>
        {review + fresh > 0 ? (
          <Link href="/study" className="inline-block rounded bg-black px-4 py-2 text-white">
            복습 시작
          </Link>
        ) : (
          <p className="text-gray-500">오늘 복습할 카드가 없습니다.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">최근 문서</h2>
          <Link href="/documents" className="text-sm underline">
            문서 올리기
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-gray-500">아직 올린 문서가 없습니다.</p>
        ) : (
          <ul className="space-y-1">
            {recent.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={doc.status === "reviewing" ? `/documents/${doc.id}/review` : `/documents/${doc.id}`}
                  className="underline"
                >
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
