import { firstMatch } from './highlight';

// 화면 표시용. 긴 문장을 단어가 보이도록 단어 주변만 남겨 max자 안으로 줄인다. 잘린 쪽에는 "…"를 붙이고,
// 잘리는 곳은 가장 가까운 공백으로 옮긴다(단어 중간에서 자르지 않는다). 단어 자체는 자르지 않는다.
export function cutAround(sentence: string, index: number, length: number, max: number): string {
  if (sentence.length <= max) return sentence;
  const centered = index - Math.floor((max - length) / 2);
  let start = Math.min(Math.max(0, centered), sentence.length - max);
  let end = start + max;
  if (start > 0) start += 1; // "…" 자리
  if (end < sentence.length) end -= 1;
  if (start > 0) {
    const space = sentence.indexOf(' ', start - 1);
    if (space !== -1 && space + 1 <= index) start = space + 1;
  }
  if (end < sentence.length) {
    const space = sentence.lastIndexOf(' ', end);
    if (space >= index + length) end = space;
  }
  return (start > 0 ? '…' : '') + sentence.slice(start, end) + (end < sentence.length ? '…' : '');
}

// 검토 표에 보여 줄 짧은 문장(Designer 조건: 140자 안팎, 1280px에서 최대 2줄).
// 기준은 형광펜과 같은 첫 일치다. 저장된 원문은 그대로 두고 화면에서만 줄인다.
export const REVIEW_SENTENCE_LENGTH = 140;

export function shortSentence(sentence: string, word: string, max = REVIEW_SENTENCE_LENGTH): string {
  const match = firstMatch(sentence, word);
  return cutAround(sentence, match?.index ?? 0, match?.length ?? 0, max);
}
