import frequency from '../../../data/frequency.json';

export type RankOf = (word: string) => number | undefined;

const ranks = frequency as Record<string, number>;

// 빈도 순위(1 = 가장 흔함). 목록에 없으면 undefined.
// hasOwn: 'constructor' 같은 프로토타입 키를 순위로 오인하지 않는다.
export const rankOf: RankOf = (word) => (Object.hasOwn(ranks, word) ? ranks[word] : undefined);

export const isFrequentWord = (word: string): boolean => rankOf(word) !== undefined;
