import headwords from '../../../data/awl.json';
import { lemmatize } from './lemma';

// AWL 대표어는 영국식 철자다. 미국식 논문의 철자도 학술어로 인정한다.
// (comprise, likewise, precise, revise는 -ise로 끝나지만 영국식 철자가 아니라서 넣지 않는다.)
const AMERICAN_SPELLINGS: Record<string, string> = {
  analyse: 'analyze',
  maximise: 'maximize',
  minimise: 'minimize',
  utilise: 'utilize',
};

// Coxhead Academic Word List(2000) 대표어 570개. 로컬 개인용으로만 쓴다(스펙 8.7).
const academic = new Set(
  (headwords as string[]).flatMap((w) => [w, AMERICAN_SPELLINGS[w]].filter(Boolean)).map(lemmatize),
);

export const isAcademic = (lemma: string): boolean => academic.has(lemma);
