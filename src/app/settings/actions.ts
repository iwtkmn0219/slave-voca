"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { parseSettingsInput, THEME_COOKIE, type SettingsErrors } from "@/lib/settings";
import { getDb } from "@/server/db/client";
import { saveSettings } from "@/server/repo/settings";

export type SaveSettingsResult =
  | { status: "saved" }
  | { status: "invalid"; errors: SettingsErrors }
  | { status: "error"; message: string };

const ONE_YEAR = 60 * 60 * 24 * 365;

// 네 항목을 함께 저장한다. 하나라도 범위 밖이면 아무것도 저장하지 않는다.
// 테마는 쿠키에 둔다: 레이아웃의 인라인 스크립트가 첫 화면을 그리기 전에 읽는다(정적 셸을 유지).
export async function saveSettingsAction(input: unknown): Promise<SaveSettingsResult> {
  const parsed = parseSettingsInput(input);
  if (parsed === null) return { status: "error", message: "잘못된 요청입니다." };
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };
  const { theme, ...rest } = parsed.value;
  saveSettings(getDb(), rest);
  const jar = await cookies();
  if (theme === "system") jar.delete(THEME_COOKIE);
  else jar.set(THEME_COOKIE, theme, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  // 하루 새 카드 수가 바뀌면 메뉴 배지·홈·복습 큐가 달라진다.
  revalidatePath("/", "layout");
  return { status: "saved" };
}
