import { describe, expect, it } from 'vitest';
import { accessRedirect, canSetStatus, devLoginEnabled, initialAccess, parseAdminEmails, safeNextPath } from '@/lib/auth/policy';

describe('initialAccess', () => {
  const admins = parseAdminEmails(' Owner@Gmail.com , second@example.com,,');

  it('approves admin emails as admins regardless of case and spaces', () => {
    expect([...admins]).toEqual(['owner@gmail.com', 'second@example.com']);
    expect(initialAccess('OWNER@gmail.com', admins)).toEqual({ status: 'approved', role: 'admin' });
  });

  it('puts everyone else on the waiting list', () => {
    expect(initialAccess('friend@gmail.com', admins)).toEqual({ status: 'pending', role: 'user' });
    expect(initialAccess('friend@gmail.com', parseAdminEmails(undefined))).toEqual({ status: 'pending', role: 'user' });
  });
});

describe('accessRedirect', () => {
  it('sends each status to its screen', () => {
    expect(accessRedirect(null)).toBe('/login');
    expect(accessRedirect({ status: 'pending', role: 'user' })).toBe('/pending');
    expect(accessRedirect({ status: 'blocked', role: 'admin' })).toBe('/blocked');
    expect(accessRedirect({ status: 'approved', role: 'user' })).toBeNull();
  });
});

describe('devLoginEnabled', () => {
  it('turns on only with the flag and a local app URL', () => {
    expect(devLoginEnabled({ AUTH_DEV_LOGIN: '1', BETTER_AUTH_URL: 'http://localhost:3300' })).toBe(true);
    expect(devLoginEnabled({ AUTH_DEV_LOGIN: '1', BETTER_AUTH_URL: 'http://127.0.0.1:3300' })).toBe(true);
    expect(devLoginEnabled({ AUTH_DEV_LOGIN: '1', BETTER_AUTH_URL: 'https://voca.example.com' })).toBe(false);
    expect(devLoginEnabled({ AUTH_DEV_LOGIN: '1', BETTER_AUTH_URL: 'not a url' })).toBe(false);
    expect(devLoginEnabled({ BETTER_AUTH_URL: 'http://localhost:3300' })).toBe(false);
  });
});

describe('canSetStatus', () => {
  const admin = { id: 'a', role: 'admin' as const };
  it('lets admins approve, block and unblock others', () => {
    expect(canSetStatus(admin, { id: 'b' }, 'approved')).toBe(true);
    expect(canSetStatus(admin, { id: 'b' }, 'blocked')).toBe(true);
  });

  it('refuses self-blocking, moving back to pending, and non-admins', () => {
    expect(canSetStatus(admin, { id: 'a' }, 'blocked')).toBe(false);
    expect(canSetStatus(admin, { id: 'b' }, 'pending')).toBe(false);
    expect(canSetStatus({ id: 'c', role: 'user' }, { id: 'b' }, 'approved')).toBe(false);
  });
});

describe('safeNextPath', () => {
  it('keeps paths inside the app, with their query', () => {
    expect(safeNextPath('/documents/3?tab=words')).toBe('/documents/3?tab=words');
    expect(safeNextPath('/')).toBe('/');
  });

  it('falls back to home for other sites, auth screens and junk', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'documents', '/login', '/login?next=/x', '/pending', '/api/auth/sign-out', undefined, ['/x']]) {
      expect(safeNextPath(bad)).toBe('/');
    }
  });

  it('rejects control characters and paths that normalize into another site or an auth path', () => {
    // 브라우저는 URL 안의 탭·줄바꿈을 지우고 점 구간을 접는다: "/\t/evil.example" → "//evil.example"
    const bad = [
      '/\t/evil.example',
      '/\n/evil.example',
      '/\r/evil.example',
      '/\u0000x',
      '/ /evil.example',
      '/x/../login',
      '/%2e/api/auth/get-session',
      '/a/%2E%2E/pending',
    ];
    for (const value of bad) expect(safeNextPath(value)).toBe('/');
  });

  it('drops the fragment and keeps the normalized path and query', () => {
    expect(safeNextPath('/login#again')).toBe('/');
    expect(safeNextPath('/documents#top')).toBe('/documents');
    expect(safeNextPath('/a/./b?x=1')).toBe('/a/b?x=1');
    expect(safeNextPath('/documents/a%20b?x=1')).toBe('/documents/a%20b?x=1');
  });
});
