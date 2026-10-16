import fs from 'node:fs';
import path from 'node:path';
import { lemmatize } from './lemma';

// AWL 대표어는 영국식 철자다. 미국식 논문의 철자도 학술어로 인정한다.
// (comprise, likewise, precise, revise는 -ise로 끝나지만 영국식 철자가 아니라서 넣지 않는다.)
const AMERICAN_SPELLINGS: Record<string, string> = {
  analyse: 'analyze',
  maximise: 'maximize',
  minimise: 'minimize',
  utilise: 'utilize',
};

// Coxhead Academic Word List(2000) 대표어 570개. 이용 조건이 밝혀져 있지 않아 저장소에 넣지 않고,
// 각자 만든 data/awl.json을 처음 쓸 때 한 번 읽는다(스펙 8.7). 파일이 없으면 학술어 예외 없이 동작한다.
let cached: Set<string> | undefined;

function academicLemmas(): Set<string> {
  if (cached) return cached;
  const file = path.join(process.cwd(), 'data', 'awl.json');
  const headwords: string[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  cached = new Set(headwords.flatMap((w) => [w, AMERICAN_SPELLINGS[w]].filter(Boolean)).map(lemmatize));
  return cached;
}

export const isAcademic = (lemma: string): boolean => academicLemmas().has(lemma);

// data/awl.json이 있어 학술어 예외가 켜져 있는지. 테스트가 목록 유무에 맞춰 기대값을 고른다.
export const hasAcademicList = (): boolean => academicLemmas().size > 0;
