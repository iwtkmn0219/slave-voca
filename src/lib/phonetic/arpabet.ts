// CMUdict의 ARPAbet 기호 → IPA. 모음은 강세 숫자(0·1·2)를 뗀 이름으로 찾는다.
const VOWELS: Record<string, string> = {
  AA: 'ɑ',
  AE: 'æ',
  AO: 'ɔ',
  AW: 'aʊ',
  AY: 'aɪ',
  EH: 'ɛ',
  EY: 'eɪ',
  IH: 'ɪ',
  IY: 'i',
  OW: 'oʊ',
  OY: 'ɔɪ',
  UH: 'ʊ',
  UW: 'u',
};

const CONSONANTS: Record<string, string> = {
  B: 'b',
  CH: 'tʃ',
  D: 'd',
  DH: 'ð',
  F: 'f',
  G: 'ɡ',
  HH: 'h',
  JH: 'dʒ',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  NG: 'ŋ',
  P: 'p',
  R: 'r',
  S: 's',
  SH: 'ʃ',
  T: 't',
  TH: 'θ',
  V: 'v',
  W: 'w',
  Y: 'j',
  Z: 'z',
  ZH: 'ʒ',
};

const STRESS_MARK: Record<string, string> = { '1': 'ˈ', '2': 'ˌ' };

interface Phone {
  ipa: string;
  vowel: boolean;
  stress: string; // '' | 'ˈ' | 'ˌ'
}

function toPhone(symbol: string): Phone | null {
  const match = /^([A-Z]+)([012])?$/.exec(symbol);
  if (!match) return null;
  const [, base, digit] = match;
  if (base === 'AH') return { ipa: digit === '0' ? 'ə' : 'ʌ', vowel: true, stress: STRESS_MARK[digit] ?? '' };
  if (base === 'ER') return { ipa: digit === '0' ? 'ɚ' : 'ɝ', vowel: true, stress: STRESS_MARK[digit] ?? '' };
  if (VOWELS[base]) return { ipa: VOWELS[base], vowel: true, stress: STRESS_MARK[digit] ?? '' };
  if (CONSONANTS[base] && digit === undefined) return { ipa: CONSONANTS[base], vowel: false, stress: '' };
  return null;
}

// 영어 단어 첫머리에 올 수 있는 자음 묶음(IPA, 공백 구분). 자음 하나는 모두 허용한다.
// 강세 기호는 "최대 첫소리 원칙"으로, 강세 모음 앞 자음 열 중 이 목록에 있는 가장 긴 꼬리 앞에 붙인다.
const ONSET_CLUSTERS = new Set([
  'p l', 'p r', 'b l', 'b r', 't r', 'd r', 'k l', 'k r', 'ɡ l', 'ɡ r', 'f l', 'f r', 'θ r', 'ʃ r',
  's p', 's t', 's k', 's m', 's n', 's l', 's w', 't w', 'd w', 'k w', 'ɡ w',
  'p j', 'b j', 'f j', 'v j', 'm j', 'k j', 'h j',
  's p l', 's p r', 's t r', 's k r', 's k w', 's p j', 's k j',
]);
const MAX_ONSET = 3;

// 강세 모음(i) 앞 자음 열에서 음절이 시작하는 위치를 찾는다.
function onsetStart(list: Phone[], i: number): number {
  let runStart = i;
  while (runStart > 0 && !list[runStart - 1].vowel) runStart--;
  if (runStart === 0) return 0; // 단어 첫머리의 자음 열은 통째로 첫소리다
  for (let len = Math.min(MAX_ONSET, i - runStart); len >= 2; len--) {
    const cluster = list.slice(i - len, i).map((p) => p.ipa).join(' ');
    if (ONSET_CLUSTERS.has(cluster)) return i - len;
  }
  return i > runStart ? i - 1 : i;
}

// "R OW0 B AH1 S T" → "/roʊˈbʌst/", "AE0 B S T R AE1 K T" → "/æbˈstrækt/".
// 모음이 하나뿐인 단어는 강세 기호를 생략한다. 모르는 기호가 있으면 null.
export function arpabetToIpa(arpabet: string): string | null {
  const phones = arpabet.trim().split(/\s+/).map(toPhone);
  if (phones.length === 0 || phones.some((p) => p === null)) return null;
  const list = phones as Phone[];
  const markStress = list.filter((p) => p.vowel).length > 1;

  const out: string[] = list.map((p) => p.ipa);
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    if (!markStress || !p.vowel || p.stress === '') continue;
    const at = onsetStart(list, i);
    out[at] = p.stress + out[at];
  }
  return `/${out.join('')}/`;
}
