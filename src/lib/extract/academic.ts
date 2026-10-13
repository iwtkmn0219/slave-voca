import headwords from '../../../data/awl.json';
import { lemmatize } from './lemma';

// Coxhead Academic Word List(2000) 대표어 570개. 로컬 개인용으로만 쓴다(스펙 8.6).
const academic = new Set((headwords as string[]).map(lemmatize));

export const isAcademic = (lemma: string): boolean => academic.has(lemma);
