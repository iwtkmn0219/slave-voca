import wordnetWords from 'wink-lexicon/src/wn-words.js';
import { isFrequentWord } from './frequency';
import { lemmatize } from './lemma';

// WordNet 단어 목록(약 7만 7천 개)에 있는 원형인지. 약칭(conv)·수식 기호(dmodel)를 가려낸다.
export const inDictionary = (lemma: string): boolean => Object.hasOwn(wordnetWords, lemma);

// 실제 영어 단어인지: 빈도표에 있거나 원형이 WordNet에 있다.
// 줄 끝 하이픈을 붙인 결과(invariance, outperform)가 드문 단어일 때도 단어로 인정하려고 쓴다.
export const isRealWord = (word: string): boolean =>
  isFrequentWord(word) || inDictionary(lemmatize(word));
