import lemmatizer from 'wink-lemmatizer';

// 명사 → 동사 → 형용사 순으로 시도해, 처음으로 형태가 바뀐 결과를 원형으로 쓴다.
export function lemmatize(word: string): string {
  const lower = word.toLowerCase();
  for (const fn of [lemmatizer.noun, lemmatizer.verb, lemmatizer.adjective]) {
    const lemma = fn(lower);
    if (lemma !== lower) return lemma;
  }
  return lower;
}
