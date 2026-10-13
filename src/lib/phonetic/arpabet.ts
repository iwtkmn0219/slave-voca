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

// "R OW0 B AH1 S T" → "/roʊˈbʌst/". 강세 기호는 강세 모음 바로 앞 자음 하나 앞에 붙인다(음절 분리 없는 근사).
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
    const at = i > 0 && !list[i - 1].vowel ? i - 1 : i;
    out[at] = p.stress + out[at];
  }
  return `/${out.join('')}/`;
}
