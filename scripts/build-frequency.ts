import { readFileSync, writeFileSync } from 'node:fs';
import { buildFrequencyMap } from '../src/lib/extract/build-frequency-map';

// scripts/export-wordfreq.py가 쓴 빈도순 단어 목록(한 줄에 하나)을 data/frequency.json으로 바꾼다.
const SOURCE = process.argv[2] ?? 'data/wordfreq-en.txt';

const words = readFileSync(SOURCE, 'utf8').split(/\r?\n/);
const map = buildFrequencyMap(words);
writeFileSync('data/frequency.json', JSON.stringify(map));
console.log(`data/frequency.json: ${Object.keys(map).length}개 항목`);
