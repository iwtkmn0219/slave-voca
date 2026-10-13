import type { Db } from '../db/client';
import { knownWords, words } from '../db/schema';

export function listKnownLemmas(db: Db): Set<string> {
  return new Set(db.select({ lemma: knownWords.lemma }).from(knownWords).all().map((r) => r.lemma));
}

export function listWordLemmas(db: Db): Set<string> {
  return new Set(db.select({ lemma: words.lemma }).from(words).all().map((r) => r.lemma));
}
