import path from 'node:path';
import { createDb } from '../src/server/db/client';
import { ClaimError, claimLegacyData } from '../src/server/repo/claim';

// M6-2 이전 데이터를 내 계정으로 옮긴다. 사용법: npm run db:claim -- you@gmail.com
// 먼저 그 계정으로 로그인해 계정을 만들어 둔다. DB 경로는 앱과 같다(SLAVE_VOCA_DB, 없으면 data/app.db).
const email = process.argv[2];
if (!email) {
  console.error('사용법: npm run db:claim -- <이메일>');
  process.exit(1);
}
const db = createDb(process.env.SLAVE_VOCA_DB ?? path.join(process.cwd(), 'data', 'app.db'));
try {
  const r = claimLegacyData(db, email);
  console.log(`옮겼습니다: 문서 ${r.documents}, 카드 ${r.words}, 아는 단어 ${r.knownWords}, 설정 ${r.settings}`);
} catch (err) {
  if (err instanceof ClaimError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
