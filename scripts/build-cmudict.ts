import { writeFileSync } from 'node:fs';

// CMU Pronouncing Dictionary(BSD 2-clause). 고정 커밋을 받아 알파벳 소문자 단어의 첫 발음만 남긴다.
const COMMIT = '74790861f652b15e4ac49015a90074ad62a27690';
const BASE = `https://raw.githubusercontent.com/cmusphinx/cmudict/${COMMIT}`;

async function download(file: string): Promise<string> {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`${file} 다운로드 실패: HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const [dict, license] = await Promise.all([download('cmudict.dict'), download('LICENSE')]);
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of dict.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim(); // 줄 끝 주석 제거
    const match = /^([a-z]+) ([A-Z012 ]+)$/.exec(line); // "read(2)" 같은 변형과 기호가 든 단어는 버린다
    if (!match || seen.has(match[1])) continue;
    seen.add(match[1]);
    lines.push(`${match[1]} ${match[2]}`);
  }
  writeFileSync('data/cmudict.txt', lines.join('\n') + '\n');
  writeFileSync('data/cmudict-LICENSE', license);
  console.log(`data/cmudict.txt: ${lines.length}개 단어`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
