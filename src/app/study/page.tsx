import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/repo/settings";
import { getStudyQueue } from "@/server/repo/study";
import { StudySession } from "./study-session";

export default function StudyPage() {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-7 pb-10">
      <h1 className="sr-only">오늘의 복습</h1>
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <TodayQueue />
      </Suspense>
    </main>
  );
}

async function TodayQueue() {
  await connection();
  const db = getDb();
  const cards = getStudyQueue(db, new Date(), getSettings(db).dailyNewLimit);
  return <StudySession cards={cards} />;
}
