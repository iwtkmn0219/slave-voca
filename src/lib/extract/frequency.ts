import frequency from '../../../data/frequency.json';

export type RankOf = (word: string) => number | undefined;

const ranks = frequency as Record<string, number>;

// 빈도 순위(1 = 가장 흔함). 목록에 없으면 undefined.
export const rankOf: RankOf = (word) => ranks[word];
