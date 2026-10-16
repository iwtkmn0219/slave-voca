import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { knownWords, words } from '../db/schema';

export function listKnownLemmas(db: Db, userId: string): Set<string> {
  return new Set(
    db.select({ lemma: knownWords.lemma }).from(knownWords).where(eq(knownWords.userId, userId)).all().map((r) => r.lemma),
  );
}

export function listWordLemmas(db: Db, userId: string): Set<string> {
  return new Set(db.select({ lemma: words.lemma }).from(words).where(eq(words.userId, userId)).all().map((r) => r.lemma));
}
