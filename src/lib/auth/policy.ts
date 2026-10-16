import type { UserRole, UserStatus } from '@/server/db/auth-schema';

// 가입 승인 규칙(M6-1 설계 2장). 서버·테스트가 함께 쓰는 순수 함수만 둔다.

export interface AccessUser {
  status: UserStatus;
  role: UserRole;
}

// ADMIN_EMAILS: 쉼표로 나눈 이메일 목록. 대소문자와 앞뒤 공백은 무시한다.
export function parseAdminEmails(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

// 새 계정의 처음 상태. 관리자 이메일은 바로 승인된 관리자, 나머지는 승인 대기다.
export function initialAccess(email: string, admins: ReadonlySet<string>): AccessUser {
  return admins.has(email.trim().toLowerCase())
    ? { status: 'approved', role: 'admin' }
    : { status: 'pending', role: 'user' };
}

// 화면을 열 수 없을 때 보낼 곳. null이면 들어갈 수 있다.
export function accessRedirect(user: AccessUser | null): '/login' | '/pending' | '/blocked' | null {
  if (!user) return '/login';
  if (user.status === 'blocked') return '/blocked';
  if (user.status === 'pending') return '/pending';
  return null;
}

// 개발 전용 로그인(이메일·비밀번호)은 AUTH_DEV_LOGIN=1이고 앱 주소가 이 컴퓨터일 때만 켠다.
// 배포 주소에서는 켤 수 없다. next start는 NODE_ENV=production이라 그것으로는 나누지 않는다.
export function devLoginEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  if (env.AUTH_DEV_LOGIN !== '1') return false;
  try {
    const host = new URL(env.BETTER_AUTH_URL ?? '').hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

// 관리자가 바꿀 수 있는 상태 변화. 자기 자신은 차단할 수 없다.
export function canSetStatus(
  actor: { id: string; role: UserRole },
  target: { id: string },
  next: UserStatus,
): boolean {
  if (actor.role !== 'admin') return false;
  if (next === 'pending') return false;
  return !(actor.id === target.id && next === 'blocked');
}

// 로그인 뒤 돌아갈 곳(?next=). 같은 사이트 안의 경로만 받는다: /로 시작하고 //나 /\로 시작하지 않으며,
// 인증 화면·API가 아니다. 아니면 홈.
export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (/^\/(login|pending|blocked|api)(\/|\?|$)/.test(value)) return '/';
  return value;
}
