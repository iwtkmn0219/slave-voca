import wordnetWords from 'wink-lexicon/src/wn-words.js';

// WordNet 단어 목록(약 7만 7천 개)에 있는 원형인지. 약칭(conv)·수식 기호(dmodel)를 가려낸다.
export const inDictionary = (lemma: string): boolean => Object.hasOwn(wordnetWords, lemma);
