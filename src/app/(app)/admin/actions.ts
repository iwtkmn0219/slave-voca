"use server";

import { revalidatePath } from "next/cache";
import { canSetStatus } from "@/lib/auth/policy";
import { requireAdmin } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { getUserForAdmin, setUserStatus } from "@/server/repo/users";

export type SetStatusResult = { error: string | null };

// 승인·차단·차단 해제. 관리자인지와 바꿀 수 있는 상태인지를 서버에서 다시 확인한다.
export async function setUserStatusAction(userId: unknown, status: unknown): Promise<SetStatusResult> {
  const admin = await requireAdmin();
  if (typeof userId !== "string" || (status !== "approved" && status !== "blocked")) {
    return { error: "잘못된 요청입니다." };
  }
  const db = getDb();
  const target = getUserForAdmin(db, userId);
  if (!target) return { error: "사용자를 찾을 수 없습니다." };
  if (!canSetStatus(admin, target, status)) return { error: "자기 자신은 차단할 수 없습니다." };
  setUserStatus(db, userId, status);
  revalidatePath("/", "layout"); // 메뉴의 승인 대기 배지
  return { error: null };
}
