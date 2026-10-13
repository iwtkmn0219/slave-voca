import { lemmatize } from './lemma';

// 빈도순 단어 목록(1번째 줄 = 1위)을 단어·원형 → 최고 순위 표로 바꾼다.
export function buildFrequencyMap(words: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  words.forEach((raw, index) => {
    const word = raw.trim().toLowerCase();
    if (!/^[a-z]+$/.test(word)) return;
    const rank = index + 1;
    for (const key of [word, lemmatize(word)]) {
      if (map[key] === undefined || map[key] > rank) map[key] = rank;
    }
  });
  return map;
}
