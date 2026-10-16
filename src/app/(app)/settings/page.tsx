import { cookies } from "next/headers";
import { Suspense } from "react";
import { isTheme, THEME_COOKIE } from "@/lib/settings";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/repo/settings";
import { SettingsForm } from "./settings-form";
import { requireUser } from "@/server/auth/current-user";

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-8 pb-12">
      <h1 className="text-[26px] font-bold">설정</h1>
      <Suspense fallback={<p className="mt-6 text-muted">불러오는 중…</p>}>
        <CurrentSettings />
      </Suspense>
    </main>
  );
}

async function CurrentSettings() {
  const user = await requireUser();
  const settings = getSettings(getDb(), user.id);
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  return <SettingsForm initial={{ ...settings, theme: isTheme(stored) ? stored : "system" }} />;
}
