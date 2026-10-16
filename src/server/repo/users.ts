import { count, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { sessions, users, type UserStatus } from '../db/schema';

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  role: 'user' | 'admin';
  createdAt: Date;
}

// 관리자 화면 목록(화면 규칙 6.3): 승인 대기를 가입이 오래된 순으로 먼저, 나머지는 가입 최신 순.
export function listUsers(db: Db): UserListItem[] {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(
      sql`case ${users.status} when 'pending' then 0 else 1 end`,
      sql`case ${users.status} when 'pending' then ${users.createdAt} else -${users.createdAt} end`,
    )
    .all();
}

// 요약 줄 "대기 n · 승인 n · 사용 중지 n"(화면 규칙 6.1). 없는 상태는 0.
export function countUsersByStatus(db: Db): Record<UserStatus, number> {
  const counts: Record<UserStatus, number> = { pending: 0, approved: 0, blocked: 0 };
  for (const row of db.select({ status: users.status, n: count() }).from(users).groupBy(users.status).all()) {
    counts[row.status] = row.n;
  }
  return counts;
}

export function countPendingUsers(db: Db): number {
  return db.select({ n: count() }).from(users).where(eq(users.status, 'pending')).get()?.n ?? 0;
}

export function getUserForAdmin(db: Db, id: string): { id: string; status: UserStatus } | undefined {
  return db.select({ id: users.id, status: users.status }).from(users).where(eq(users.id, id)).get();
}

// 상태를 바꾼다. 차단하면 그 사용자의 세션을 모두 지워 바로 로그아웃시킨다.
export function setUserStatus(db: Db, id: string, status: Exclude<UserStatus, 'pending'>): boolean {
  return db.transaction((tx) => {
    const changed = tx.update(users).set({ status }).where(eq(users.id, id)).run().changes > 0;
    if (changed && status === 'blocked') tx.delete(sessions).where(eq(sessions.userId, id)).run();
    return changed;
  });
}
