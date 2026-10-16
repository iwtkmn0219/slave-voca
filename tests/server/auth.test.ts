import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { createAuth } from '@/server/auth/auth';

// 실제 Better Auth를 메모리 DB에 붙여 가입 규칙을 확인한다. Google 대신 개발 전용 로그인(이메일)을 쓴다.
const env = {
  BETTER_AUTH_URL: 'http://localhost:3300',
  BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-32',
  ADMIN_EMAILS: 'owner@example.com',
  AUTH_DEV_LOGIN: '1',
};

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

const signUp = (auth: ReturnType<typeof createAuth>, email: string, extra: Record<string, unknown> = {}) =>
  auth.api.signUpEmail({ body: { email, password: 'password-1234', name: email.split('@')[0], ...extra } });

describe('createAuth', () => {
  it('makes admin emails approved admins and everyone else pending users', async () => {
    const auth = createAuth(db, env);
    await signUp(auth, 'Owner@Example.com');
    await signUp(auth, 'friend@example.com');
    const rows = db.select({ email: users.email, status: users.status, role: users.role }).from(users).all();
    expect(rows).toEqual(
      expect.arrayContaining([
        { email: 'owner@example.com', status: 'approved', role: 'admin' },
        { email: 'friend@example.com', status: 'pending', role: 'user' },
      ]),
    );
  });

  it('ignores status and role sent by the client', async () => {
    const auth = createAuth(db, env);
    await signUp(auth, 'sneaky@example.com', { status: 'approved', role: 'admin' });
    const row = db.select().from(users).where(eq(users.email, 'sneaky@example.com')).get();
    expect(row && { status: row.status, role: row.role }).toEqual({ status: 'pending', role: 'user' });
  });

  it('turns off email sign-up when the dev login is off', async () => {
    const auth = createAuth(db, { ...env, AUTH_DEV_LOGIN: undefined });
    await expect(signUp(auth, 'friend@example.com')).rejects.toThrow();
    expect(db.select().from(users).all()).toEqual([]);
  });
});
