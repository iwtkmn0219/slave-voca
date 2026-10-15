export interface Segment {
  text: string;
  match: boolean;
}

const wordPattern = (word: string, flags: string) =>
  new RegExp(`\\b(${word.replace(/[^A-Za-z-]/g, '')})\\b`, flags);

// 문장에서 word와 같은 단어(대소문자 무시)를 표시용 조각으로 나눈다.
export function highlight(sentence: string, word: string): Segment[] {
  return sentence
    .split(wordPattern(word, 'gi'))
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, match: part.toLowerCase() === word.toLowerCase() }));
}

// highlight와 같은 기준의 첫 일치 위치. 문장 줄이기가 이 단어를 남기는 데 쓴다.
export function firstMatch(sentence: string, word: string): { index: number; length: number } | null {
  const m = wordPattern(word, 'i').exec(sentence);
  return m ? { index: m.index, length: m[0].length } : null;
}
