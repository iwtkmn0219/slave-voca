export interface Segment {
  text: string;
  match: boolean;
}

// 문장에서 word와 같은 단어(대소문자 무시)를 표시용 조각으로 나눈다.
export function highlight(sentence: string, word: string): Segment[] {
  const pattern = new RegExp(`\\b(${word.replace(/[^A-Za-z-]/g, '')})\\b`, 'gi');
  return sentence
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, match: part.toLowerCase() === word.toLowerCase() }));
}
