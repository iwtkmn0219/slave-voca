import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { sessions, users } from '@/server/db/schema';
import { countPendingUsers, countUsersByStatus, listUsers, setUserStatus } from '@/server/repo/users';

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  const at = (ms: number) => new Date(Date.UTC(2026, 9, 16) + ms);
  db.insert(users)
    .values([
      { id: 'owner', name: 'Owner', email: 'owner@example.com', status: 'approved', role: 'admin', createdAt: at(0) },
      { id: 'late', name: 'Late', email: 'late@example.com', status: 'pending', createdAt: at(2000) },
      { id: 'early', name: 'Early', email: 'early@example.com', status: 'pending', createdAt: at(1000) },
      { id: 'friend', name: 'Friend', email: 'friend@example.com', status: 'approved', createdAt: at(500) },
    ])
    .run();
  db.insert(sessions)
    .values([{ id: 's1', token: 't1', userId: 'friend', expiresAt: at(86_400_000) }])
    .run();
});

describe('users repo', () => {
  it('lists pending users oldest first, then everyone else newest first', () => {
    expect(listUsers(db).map((u) => u.id)).toEqual(['early', 'late', 'friend', 'owner']);
    expect(countPendingUsers(db)).toBe(2);
    expect(countUsersByStatus(db)).toEqual({ pending: 2, approved: 2, blocked: 0 });
  });

  it('approves a pending user', () => {
    expect(setUserStatus(db, 'early', 'approved')).toBe(true);
    expect(countPendingUsers(db)).toBe(1);
  });

  it('blocking signs the user out everywhere', () => {
    expect(setUserStatus(db, 'friend', 'blocked')).toBe(true);
    expect(db.select().from(sessions).all()).toEqual([]);
  });

  it('reports an unknown user', () => {
    expect(setUserStatus(db, 'nobody', 'approved')).toBe(false);
  });
});
