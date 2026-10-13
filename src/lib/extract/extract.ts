import { lemmatize } from './lemma';
import type { RankOf } from './frequency';

export interface Candidate {
  lemma: string;
  surface: string;
  sentence: string;
  count: number;
  isExisting: boolean;
}

export interface ExtractOptions {
  excludeTopN: number;
  rankOf: RankOf;
  knownLemmas: ReadonlySet<string>;
  existingLemmas: ReadonlySet<string>;
}

const TOKEN = /[A-Za-z]+(?:-[A-Za-z]+)*/g;
const MIN_LENGTH = 3;
const MAX_SENTENCE_LENGTH = 300;

interface Tally {
  lemma: string;
  surface: string;
  sentence: string;
  count: number;
  seenLowercase: boolean;
  seenCapitalizedMidSentence: boolean;
}

function isCommon(word: string, opts: ExtractOptions): boolean {
  const rank = opts.rankOf(word);
  return rank !== undefined && rank <= opts.excludeTopN;
}

function truncate(sentence: string): string {
  return sentence.length <= MAX_SENTENCE_LENGTH
    ? sentence
    : `${sentence.slice(0, MAX_SENTENCE_LENGTH - 1)}…`;
}

export function extractCandidates(sentences: string[], opts: ExtractOptions): Candidate[] {
  const tallies = new Map<string, Tally>();

  for (const sentence of sentences) {
    let position = 0;
    for (const [token] of sentence.matchAll(TOKEN)) {
      const isFirst = position++ === 0;
      if (token.includes('-') || token.length < MIN_LENGTH) continue;
      if (token === token.toUpperCase()) continue; // 약어: CNN, BERT
      const lower = token.toLowerCase();
      if (isCommon(lower, opts)) continue; // data → datum처럼 원형이 드문 흔한 단어
      const lemma = lemmatize(lower);
      if (isCommon(lemma, opts) || opts.knownLemmas.has(lemma)) continue;

      let tally = tallies.get(lemma);
      if (!tally) {
        tally = {
          lemma,
          surface: lower,
          sentence: truncate(sentence),
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

  return [...tallies.values()]
    .filter((t) => t.seenLowercase || !t.seenCapitalizedMidSentence) // 고유명사 제외
    .map((t) => ({
      lemma: t.lemma,
      surface: t.surface,
      sentence: t.sentence,
      count: t.count,
      isExisting: opts.existingLemmas.has(t.lemma),
    }))
    .sort((a, b) => b.count - a.count || (a.lemma < b.lemma ? -1 : a.lemma > b.lemma ? 1 : 0));
}
