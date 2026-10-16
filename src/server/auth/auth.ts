import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { devLoginEnabled, initialAccess, parseAdminEmails } from '@/lib/auth/policy';
import { getDb, type Db } from '../db/client';
import * as schema from '../db/schema';

// 읽는 환경변수: BETTER_AUTH_URL, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ADMIN_EMAILS,
// AUTH_DEV_LOGIN. 테스트는 같은 모양의 객체를 넘긴다.
export type AuthEnv = Readonly<Record<string, string | undefined>>;

// Better Auth 서버. Google 로그인만 쓰고, 개발 전용 로그인이 켜졌을 때만 이메일·비밀번호를 연다.
// 새 계정의 status·role은 사용자가 정할 수 없고(input: false) 가입 직전에 관리자 이메일로 정한다.
export function createAuth(db: Db, env: AuthEnv = process.env) {
  const admins = parseAdminEmails(env.ADMIN_EMAILS);
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: 'select_account' as const } }
      : {};
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'sqlite', schema, usePlural: true }),
    socialProviders: google,
    emailAndPassword: { enabled: devLoginEnabled(env) },
    user: {
      additionalFields: {
        status: { type: 'string', required: false, defaultValue: 'pending', input: false },
        role: { type: 'string', required: false, defaultValue: 'user', input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({ data: { ...user, ...initialAccess(user.email, admins) } }),
        },
      },
    },
    plugins: [nextCookies()], // 마지막 플러그인이어야 한다(Better Auth 안내)
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as { slaveVocaAuth?: Auth };

// 앱이 쓰는 인증 인스턴스. DB처럼 처음 쓸 때 만든다(빌드 중에 DB를 열지 않도록).
export function getAuth(): Auth {
  globalForAuth.slaveVocaAuth ??= createAuth(getDb());
  return globalForAuth.slaveVocaAuth;
}
