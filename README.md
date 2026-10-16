# slave-voca

논문·발표 자료 PDF에서 어려운 영어 단어를 뽑아, 원문 문장 기준의 한국어 뜻과 발음을 붙인 카드로 만들고 간격 반복(FSRS)으로 외우게 하는 개인용 웹앱입니다.

- PDF를 올리면 빈도·학술어 기준으로 후보 단어를 뽑고, 검토 화면에서 고른 단어만 카드로 저장합니다.
- 뜻은 Gemini(`gemini-3.5-flash-lite`)가 그 단어가 쓰인 문장을 보고 만듭니다. 발음기호는 CMUdict와 Free Dictionary API에서 가져옵니다.
- 복습 화면은 키보드로 씁니다(Space 뒷면, 1~3 응답, Z 되돌리기, P 발음).

설계와 개발 기록은 `docs/superpowers/`에 있습니다(한국어).

> 로그인이 없는 1인용 로컬 앱입니다. 인터넷에 그대로 열어 두지 마세요. 주소를 아는 누구나 PDF를 올려 Gemini 요금을 쓰고 카드를 고칠 수 있습니다.

## 실행

Node.js 24에서 개발했습니다.

```bash
npm ci
cp .env.example .env.local   # GEMINI_API_KEY를 채운다
npm run dev
```

- `GEMINI_API_KEY`가 없어도 단어 추출·카드·복습은 됩니다. 뜻만 "실패"로 남고, 키를 넣은 뒤 단어 목록에서 다시 만들 수 있습니다.
- DB는 처음 실행할 때 `data/app.db`(SQLite)에 만들어집니다. 다른 경로를 쓰려면 `SLAVE_VOCA_DB`를 지정합니다.
- 검사: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`

### 학술 핵심어 목록(선택)

빈도 상위 N위 안이라도 학술 핵심어(hence, whereas, derive 등)는 후보로 남기는 규칙이 있습니다. 이 규칙에 쓰는 Coxhead의 [Academic Word List](https://www.wgtn.ac.nz/lals/resources/academicwordlist)는 이용 조건이 밝혀져 있지 않아 저장소에 넣지 않았습니다.

쓰려면 Victoria University of Wellington이 배포하는 대표어(headword) 570개를 소문자 JSON 배열로 `data/awl.json`에 저장하세요(예: `["(AWL 대표어 570개. 이용 조건이 밝혀져 있지 않아 공개 저장소에서 뺐다. README 참고)"]`). 파일이 없으면 이 규칙만 빠지고 나머지는 그대로 동작합니다.

## 데이터 출처

| 파일 | 출처 | 조건 |
|---|---|---|
| `data/frequency.json` | [first20hours/google-10000-english](https://github.com/first20hours/google-10000-english)의 `20k.txt`(Peter Norvig의 Google Web Trillion Word Corpus 집계에서 파생). `npm run freq:build`로 다시 만든다 | 원본 저장소 안내에 따라 비상업적으로만 쓴다. 상업적 사용에는 LDC 라이선스가 필요하다 |
| `data/cmudict.txt` | [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict). `npm run cmudict:build`로 다시 만든다 | BSD 형식, `data/cmudict-LICENSE` |
| 영어 사전 확인 | `wink-lexicon`(WordNet 파생) | MIT / WordNet 라이선스 |
| `data/awl.json` | 저장소에 없음(위 참고) | — |

## 라이선스

코드는 [MIT](LICENSE)입니다. 위 데이터 파일에는 각 출처의 조건이 따로 적용됩니다.
