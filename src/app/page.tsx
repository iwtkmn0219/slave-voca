import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DocumentStatusLabel, documentHref, KIND_LABEL } from "@/components/document-status";
import { StartStudyButton } from "@/components/start-study-button";
import { Notice } from "@/components/ui/notice";
import { getDb } from "@/server/db/client";
import { countFailedMeaningsByDocument, countOccurrencesByDocument } from "@/server/repo/cards";
import { countCandidatesByDocument } from "@/server/repo/candidates";
import { listDocuments } from "@/server/repo/documents";
import { getSettings } from "@/server/repo/settings";
import { countStudyToday } from "@/server/repo/study";

const RECENT_DOCUMENTS = 5;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-10 py-8 max-[900px]:px-4">
      <h1 className="sr-only">홈</h1>
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <TodaySummary />
      </Suspense>
    </main>
  );
}

async function TodaySummary() {
  await connection();
  const db = getDb();
  const now = new Date();
  const settings = getSettings(db);
  const { review, fresh } = countStudyToday(db, now, settings.dailyNewLimit);
  const docs = listDocuments(db);
  const recent = docs.slice(0, RECENT_DOCUMENTS);
  const wordCounts = countOccurrencesByDocument(db);
  const candidateCounts = countCandidatesByDocument(db);
  const failedCounts = countFailedMeaningsByDocument(db);
  const totalFailed = [...failedCounts.values()].reduce((a, b) => a + b, 0);
  const missingKey = !process.env.GEMINI_API_KEY;

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-6 max-[900px]:grid-cols-1">
        <section className="rounded-lg border border-line bg-surface p-7 shadow-1">
          <p className="text-[13px] font-semibold text-muted">
            오늘의 복습 · {now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
          </p>
          {review + fresh > 0 ? (
            <>
              <div className="mt-3.5 mb-6 flex gap-9">
                <div className="grid">
                  <b className="text-[40px] leading-[1.1] font-bold tracking-[-0.02em] tabular-nums">{review}</b>
                  <span className="text-[13px] text-muted">복습할 카드</span>
                </div>
                <div className="grid">
                  <b className="text-[40px] leading-[1.1] font-bold tracking-[-0.02em] tabular-nums">{fresh}</b>
                  <span className="text-[13px] text-muted">새 카드 (하루 상한 {settings.dailyNewLimit})</span>
                </div>
              </div>
              <StartStudyButton />
            </>
          ) : (
            <p className="mt-4 text-ink-2">오늘 복습할 카드가 없습니다.</p>
          )}
        </section>

        <section className="rounded-lg border border-line bg-surface py-2 shadow-1">
          <h2 className="mx-5 mt-2 mb-1 flex justify-between text-[13px] font-semibold text-muted">
            <span>최근 문서</span>
            <Link href="/documents" className="text-accent">
              PDF 올리기
            </Link>
          </h2>
          {recent.length === 0 ? (
            <p className="px-5 py-3 text-sm text-muted">아직 올린 문서가 없습니다.</p>
          ) : (
            recent.map((doc) => {
              const words = wordCounts.get(doc.id) ?? 0;
              const failed = failedCounts.get(doc.id) ?? 0;
              const href = documentHref(doc, words);
              const meta = [
                KIND_LABEL[doc.kind],
                doc.status === "reviewing" ? `후보 ${candidateCounts.get(doc.id) ?? 0}개` : `단어 ${words}개`,
                failed > 0 ? `뜻 ${failed}개 생성 실패` : null,
                doc.createdAt.toLocaleDateString("ko-KR", { month: "long", day: "numeric" }),
              ].filter(Boolean);
              const body = (
                <>
                  <span className="font-en text-base font-bold">{doc.title}</span>
                  <DocumentStatusLabel status={doc.status} />
                  <span className="col-start-1 text-[12.5px] text-muted">{meta.join(" · ")}</span>
                </>
              );
              const rowClass = "grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-line px-5 py-3";
              return href ? (
                <Link key={doc.id} href={href} className={`${rowClass} hover:bg-sunken/60`}>
                  {body}
                </Link>
              ) : (
                <div key={doc.id} className={rowClass}>
                  {body}
                </div>
              );
            })
          )}
        </section>
      </div>

      {totalFailed > 0 && (
        <Notice className="mt-5">
          {missingKey
            ? "GEMINI_API_KEY가 설정되지 않아 문맥 뜻을 만들지 못하고 있습니다."
            : `문맥 뜻 ${totalFailed}개를 만들지 못했습니다.`}{" "}
          단어와 원문 문장은 그대로 복습할 수 있습니다.
        </Notice>
      )}
    </>
  );
}
