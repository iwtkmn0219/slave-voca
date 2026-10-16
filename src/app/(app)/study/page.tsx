import { Suspense } from "react";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/repo/settings";
import { getStudyQueue } from "@/server/repo/study";
import { StudySession } from "./study-session";
import { requireUser } from "@/server/auth/current-user";

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
  const user = await requireUser();
  const db = getDb();
  const settings = getSettings(db, user.id);
  const cards = getStudyQueue(db, user.id, new Date(), settings.dailyNewLimit);
  return <StudySession cards={cards} autoSpeak={settings.autoSpeak} />;
}
