import { describe, expect, it } from 'vitest';
import { displayName, formatJoinedAt, initialOf, loginNoticeKind } from '@/lib/auth/display';

describe('formatJoinedAt', () => {
  const now = new Date('2026-10-20T00:00:00Z');

  it('writes month, day and 24-hour time in Korean time, without the year this year', () => {
    expect(formatJoinedAt(new Date('2026-10-16T05:32:00Z'), now)).toBe('10월 16일 14:32');
    expect(formatJoinedAt(new Date('2026-01-02T15:05:00Z'), now)).toBe('1월 3일 00:05');
  });

  it('puts the year in front when it is not this year', () => {
    expect(formatJoinedAt(new Date('2025-10-16T05:32:00Z'), now)).toBe('2025년 10월 16일 14:32');
  });

  it('decides "this year" in Korean time too', () => {
    // 2026-12-31 15:30 UTC는 한국 시간으로 2027-01-01 00:30이다.
    expect(formatJoinedAt(new Date('2026-12-31T15:30:00Z'), new Date('2027-03-01T00:00:00Z'))).toBe('1월 1일 00:30');
  });
});

describe('initialOf', () => {
  it('uses the first letter of the name, upper-cased', () => {
    expect(initialOf('김연구', 'a@b.c')).toBe('김');
    expect(initialOf('  iwtkmn0219', 'a@b.c')).toBe('I');
  });

  it('falls back to the first letter of the email when there is no name', () => {
    expect(initialOf('', 'friend@example.com')).toBe('F');
    expect(initialOf('   ', 'friend@example.com')).toBe('F');
  });
});

describe('displayName', () => {
  it('uses the name, or the part of the email before @', () => {
    expect(displayName('김연구', 'a@b.c')).toBe('김연구');
    expect(displayName('', 'friend@example.com')).toBe('friend');
  });
});

describe('loginNoticeKind', () => {
  it('maps the sign-in error query to a notice kind', () => {
    expect(loginNoticeKind(undefined)).toBeNull();
    expect(loginNoticeKind('access_denied')).toBe('cancelled');
    expect(loginNoticeKind('server_error')).toBe('error');
    expect(loginNoticeKind('')).toBe('error');
    expect(loginNoticeKind(['access_denied'])).toBe('error');
  });
});
