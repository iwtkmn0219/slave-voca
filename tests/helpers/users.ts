import type { Db } from '@/server/db/client';
import { users } from '@/server/db/schema';

// 테스트용 사용자. 데이터는 모두 주인이 있어야 하므로(M6-2) 메모리 DB를 만든 뒤 넣는다.
export const USER = 'user-a';
export const OTHER = 'user-b';

export function addUser(db: Db, id: string = USER): string {
  db.insert(users)
    .values({ id, name: id, email: `${id}@example.com`, status: 'approved' })
    .run();
  return id;
}
