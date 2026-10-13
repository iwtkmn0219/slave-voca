import { lemmatize } from './lemma';
import type { RankOf } from './frequency';

export interface Candidate {
  lemma: string;
  surface: string;
  sentence: string;
  count: number;
  isExisting: boolean;
  inDictionary: boolean;
}

export interface ExtractOptions {
  excludeTopN: number;
  rankOf: RankOf;
  knownLemmas: ReadonlySet<string>;
  existingLemmas: ReadonlySet<string>;
  isAcademic: (lemma: string) => boolean;
  inDictionary: (lemma: string) => boolean;
}

const TOKEN = /\p{L}+(?:-\p{L}+)*/gu;
const NON_ASCII = /[^\x00-\x7F]/;
const MIN_LENGTH = 3;
const MAX_SENTENCE_LENGTH = 300;
// 학술 핵심어 예외는 상위 2,000위 밖에만 적용한다. 그 안의 AWL 단어(area, data, code)는 쉽다.
const ACADEMIC_RESCUE_MIN_RANK = 2001;

interface Tally {
  lemma: string;
  surface: string;
  sentence: string;
  count: number;
  seenLowercase: boolean;
  seenCapitalizedMidSentence: boolean;
}

function bestRank(words: string[], rankOf: RankOf): number | undefined {
  const ranks = words.map(rankOf).filter((r): r is number => r !== undefined);
  return ranks.length > 0 ? Math.min(...ranks) : undefined;
}

function isExcludedByRank(lower: string, lemma: string, opts: ExtractOptions): boolean {
  // 표면형도 본다: data → datum처럼 원형이 드문 흔한 단어를 거른다.
  const rank = bestRank([lower, lemma], opts.rankOf);
  if (rank === undefined || rank > opts.excludeTopN) return false;
  return !(rank >= ACADEMIC_RESCUE_MIN_RANK && opts.isAcademic(lemma));
}

// 300자를 넘으면 단어가 보이도록 단어 주변을 잘라 정확히 300자로 맞춘다.
export function truncateAround(sentence: string, index: number, length: number): string {
  if (sentence.length <= MAX_SENTENCE_LENGTH) return sentence;
  const centered = index - Math.floor((MAX_SENTENCE_LENGTH - length) / 2);
  const start = Math.min(Math.max(0, centered), sentence.length - MAX_SENTENCE_LENGTH);
  const end = start + MAX_SENTENCE_LENGTH;
  const head = start > 0 ? '…' : '';
  const tail = end < sentence.length ? '…' : '';
  return head + sentence.slice(start + head.length, end - tail.length) + tail;
}

function compareByCountThenLemma(a: Candidate, b: Candidate): number {
  return b.count - a.count || (a.lemma < b.lemma ? -1 : a.lemma > b.lemma ? 1 : 0);
}

// 원형 처리기가 못 바꾼 복수형(datasets)을 같은 문서의 단수형 후보(dataset)에 합친다.
function mergePlurals(tallies: Tally[]): Tally[] {
  const byLemma = new Map(tallies.map((t) => [t.lemma, t]));
  const merged: Tally[] = [];
  for (const t of tallies) {
    const singular =
      t.lemma.endsWith('s') && !t.lemma.endsWith('ss') ? byLemma.get(t.lemma.slice(0, -1)) : undefined;
    if (singular) singular.count += t.count;
    else merged.push(t);
  }
  return merged;
}

export function extractCandidates(sentences: string[], opts: ExtractOptions): Candidate[] {
  const tallies = new Map<string, Tally>();

  for (const sentence of sentences) {
    let position = 0;
    for (const match of sentence.matchAll(TOKEN)) {
      const token = match[0];
      const isFirst = position++ === 0;
      if (token.includes('-') || token.length < MIN_LENGTH) continue;
      if (NON_ASCII.test(token)) continue; // Łukasz → ukasz 같은 조각 방지
      if (token === token.toUpperCase()) continue; // 약어: CNN, BERT
      const lower = token.toLowerCase();
      const lemma = lemmatize(lower);
      if (isExcludedByRank(lower, lemma, opts) || opts.knownLemmas.has(lemma)) continue;

      let tally = tallies.get(lemma);
      if (!tally) {
        tally = {
          lemma,
          surface: lower,
          sentence: truncateAround(sentence, match.index, token.length),
          count: 0,
          seenLowercase: false,
          seenCapitalizedMidSentence: false,
        };
        tallies.set(lemma, tally);
      }
      tally.count++;
      if (token === lower) tally.seenLowercase = true;
      else if (!isFirst) tally.seenCapitalizedMidSentence = true;
    }
  }

  const kept = [...tallies.values()].filter(
    (t) => t.seenLowercase || !t.seenCapitalizedMidSentence, // 고유명사 제외
  );
  return mergePlurals(kept)
    .map((t) => ({
      lemma: t.lemma,
      surface: t.surface,
      sentence: t.sentence,
      count: t.count,
      isExisting: opts.existingLemmas.has(t.lemma),
      inDictionary: opts.inDictionary(t.lemma),
    }))
    .sort(compareByCountThenLemma);
}
