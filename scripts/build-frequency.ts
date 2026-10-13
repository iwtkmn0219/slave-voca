import { writeFileSync } from 'node:fs';
import { buildFrequencyMap } from '../src/lib/extract/build-frequency-map';

const SOURCE_URL =
  'https://raw.githubusercontent.com/first20hours/google-10000-english/master/20k.txt';

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`빈도 목록 다운로드 실패: HTTP ${res.status}`);
  const words = (await res.text()).split(/\r?\n/);
  const map = buildFrequencyMap(words);
  writeFileSync('data/frequency.json', JSON.stringify(map));
  console.log(`data/frequency.json: ${Object.keys(map).length}개 항목`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
