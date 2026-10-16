import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { accessRedirect } from '@/lib/auth/policy';
import type { UserRole, UserStatus } from '../db/auth-schema';
import { getAuth } from './auth';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  role: UserRole;
}

// 요청의 세션 쿠키로 사용자를 찾는다. 없거나 만료됐으면 null. 상태는 매번 DB에서 읽으므로
// 관리자가 차단하면 다음 요청부터 바로 막힌다(쿠키 캐시를 쓰지 않는다).
export async function getSessionUser(): Promise<CurrentUser | null> {
  // 요청 헤더를 먼저 읽는다. 그래야 빌드(프리렌더) 중에는 여기서 멈추고 인증 객체를 만들지 않는다.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { id, name, email, status, role } = session.user as typeof session.user & {
    status: UserStatus;
    role: UserRole;
  };
  return { id, name, email, status, role };
}

// 화면·Server Action의 입구. 승인된 사용자가 아니면 로그인·승인 대기·차단 화면으로 보낸다.
// 요청을 읽으므로 화면에서는 Suspense 안에서 부른다(Next 16 Cache Components).
export async function requireUser(): Promise<CurrentUser> {
  const user = await getSessionUser();
  const to = accessRedirect(user);
  if (to) redirect(to);
  return user!;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/');
  return user;
}
