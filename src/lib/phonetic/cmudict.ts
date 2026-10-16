import fs from 'node:fs';
import path from 'node:path';
import { arpabetToIpa } from './arpabet';

export type PhoneticSource = (word: string) => string | null;

// "word PH ONES" 줄 목록으로 조회 함수를 만든다. 같은 단어가 여러 번 나오면 첫 줄을 쓴다.
export function createCmudict(text: string): PhoneticSource {
  const entries = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const space = line.indexOf(' ');
    if (space <= 0) continue;
    const word = line.slice(0, space);
    if (!entries.has(word)) entries.set(word, line.slice(space + 1));
  }
  return (word) => {
    const arpabet = entries.get(word.toLowerCase());
    return arpabet === undefined ? null : arpabetToIpa(arpabet);
  };
}

let cached: PhoneticSource | undefined;

// data/cmudict.txt(약 13만 단어)를 처음 쓸 때 한 번만 읽는다. 번들에 넣지 않으려고 fs로 읽는다.
export function cmudictLookup(word: string): string | null {
  cached ??= createCmudict(fs.readFileSync(path.join(process.cwd(), 'data', 'cmudict.txt'), 'utf8'));
  return cached(word);
}

// 발음기호는 CMUdict(미국식, 발음 듣기 en-US와 같은 표기)에서만 찾는다. 조회가 실패해도(파일 없음 등)
// 저장 전체를 오류로 만들지 않고 발음기호 없이 둔다. 로그는 한 번만 남긴다.
// (2026-10-16 M5: 사전 API dictionaryapi.dev는 이용 조건이 밝혀져 있지 않고, 실측에서 CMUdict에 없는 단어를
// 채운 적이 없어 뺐다.)
export function createCmudictPhonetic(
  primary: PhoneticSource = cmudictLookup,
): (word: string) => Promise<string | null> {
  let logged = false;
  return async (word) => {
    try {
      return primary(word);
    } catch (err) {
      if (!logged) console.error('CMUdict 발음기호 조회 실패', err);
      logged = true;
      return null;
    }
  };
}
