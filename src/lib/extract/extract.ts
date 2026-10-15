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
const COMBINING_MARKS = /\p{M}/gu;
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

// 발음 구별 기호를 뗀다: naïve → naive, café → cafe. Łukasz의 Ł처럼 떼어지지 않는 글자는 남는다.
function stripDiacritics(token: string): string {
  return token.normalize('NFD').replace(COMBINING_MARKS, '');
}

// 복수형 어미에 맞는 단수형 후보를 가능성이 큰 순서로 돌려준다: nonlinearities → nonlinearity, softmaxes → softmax,
// datasets → dataset. 끝의 s만 떼면 nonlinearitie, softmaxe처럼 없는 형태가 나온다.
function singularCandidates(lemma: string): string[] {
  if (lemma.endsWith('ies')) return [lemma.slice(0, -3) + 'y', lemma.slice(0, -1)];
  if (/(?:x|ch|sh|z)es$/.test(lemma)) return [lemma.slice(0, -2), lemma.slice(0, -1)];
  return [lemma.slice(0, -1)];
}

// 원형 처리기가 못 바꾼 복수형(datasets, logits, hyperparameters)을 단수형으로 돌린다.
// 그대로 두는 것: -ss·-us·-is로 끝나는 단어(glass, softplus, axis), 사전에 있는 단어(lens, bias, series),
// 빈도표에는 있는데 단수형은 없는 단어(whereas → wherea는 없다. 학술어 예외도 이 형태로 받는다).
// 단수형 후보 중 사전이 아는 것을 먼저 쓰고(databases → database), 없으면 어미 규칙의 첫 후보를 쓴다.
// 단어마다 처리하므로 단수형이 아는 단어거나 흔한 단어면 원래 규칙대로 함께 빠진다.
function singularize(lemma: string, opts: ExtractOptions): string {
  if (!lemma.endsWith('s') || /(?:ss|us|is)$/.test(lemma) || opts.inDictionary(lemma)) return lemma;
  const candidates = singularCandidates(lemma).filter((c) => c.length >= MIN_LENGTH);
  const singular = candidates.find((c) => opts.inDictionary(c)) ?? candidates[0];
  if (singular === undefined) return lemma;
  if (opts.rankOf(lemma) !== undefined && opts.rankOf(singular) === undefined) return lemma;
  return singular;
}

export function extractCandidates(sentences: string[], opts: ExtractOptions): Candidate[] {
  const tallies = new Map<string, Tally>();

  for (const raw of sentences) {
    // 조합형(i + ̈)으로 들어온 글자를 한 글자로 모은다. 그러지 않으면 TOKEN이 naïve를 두 조각으로 자른다.
    const sentence = raw.normalize('NFC');
    let position = 0;
    for (const match of sentence.matchAll(TOKEN)) {
      const token = match[0];
      const isFirst = position++ === 0;
      if (token.includes('-') || token.length < MIN_LENGTH) continue;
      const folded = stripDiacritics(token);
      if (NON_ASCII.test(folded)) continue; // Łukasz → ukasz 같은 조각 방지
      if (token === token.toUpperCase()) continue; // 약어: CNN, BERT
      const lower = folded.toLowerCase();
      const lemma = lemmatize(lower);
      const base = lemma === lower ? singularize(lemma, opts) : lemma;
      if (isExcludedByRank(lower, base, opts) || opts.knownLemmas.has(base)) continue;

      let tally = tallies.get(base);
      if (!tally) {
        tally = {
          lemma: base,
          // 표면형은 문장에 적힌 그대로(naïve). 형광펜이 문장에서 이 글자를 찾는다.
          surface: token.toLowerCase(),
          sentence: truncateAround(sentence, match.index, token.length),
          count: 0,
          seenLowercase: false,
          seenCapitalizedMidSentence: false,
        };
        tallies.set(base, tally);
      }
      tally.count++;
      if (token === token.toLowerCase()) tally.seenLowercase = true;
      else if (!isFirst) tally.seenCapitalizedMidSentence = true;
    }
  }

  return [...tallies.values()]
    .filter((t) => t.seenLowercase || !t.seenCapitalizedMidSentence) // 고유명사 제외
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
