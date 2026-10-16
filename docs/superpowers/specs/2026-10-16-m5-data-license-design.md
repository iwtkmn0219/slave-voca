# M5 설계: 상업적으로 쓸 수 있는 데이터로 교체(빈도표, 학술어 예외, 발음기호)

- 상태: 사용자 결정(2026-10-16, 선택지 A). 실측과 프로토타입으로 확인했다.
- 계획서: `docs/superpowers/plans/2026-10-16-m5-data-license.md`
- 버전: 0.5.0(베타 배포 로드맵 1단계)
- 상위 설계서: `2026-10-13-slave-voca-design.md` 2장, 8.2·8.3·8.5·8.7, 10장, 12장

## 1. 왜

목표는 수익화까지다(사용자, 2026-10-16). 첫 단계는 지인 10명 안팎의 비공개 베타이고(1.0.0), 결제는 그 뒤에 붙인다. 지금 쓰는 데이터 셋 중 두 개는 상업적으로 쓸 수 없고, 하나는 조건을 알 수 없다.

| 데이터 | 지금 | 문제 |
|---|---|---|
| 빈도표 | `first20hours/google-10000-english`(Google Web Trillion Word Corpus 파생) | 원본 안내: "상업적 용도로는 LDC 라이선스 없이 쓰지 말라" |
| 학술어 예외 | Coxhead AWL 570개(`data/awl.json`, 저장소에는 없음) | 이용 조건이 없고, 대학 페이지에는 저작권 표시만 있다 |
| 발음기호 보조 | Free Dictionary API(`dictionaryapi.dev`) | 이용 조건이 명시돼 있지 않다(저장소 GPL-3.0, 데이터 출처 불명) |

CMUdict(BSD), WordNet(`wink-lexicon`), Pretendard(OFL)는 상업적으로 써도 된다.

## 2. 실측(2026-10-16, PM)

논문 3편(ResNet, Attention, BERT)을 빈 단어장 기준으로 추출했다. 비교 기준은 지금 설정(Google 빈도표 + AWL, N=5000)이다. 목표 학술어는 M1에서 꼽은 단어 15개다: hence, whereas, respectively, subsequent, substantial, derive, exhibit, yield, novel, adopt, furthermore, crucial, despite, widely, considerable.

| 조합 | 편당 후보 | 지금 대비 잃음 / 새로 | 목표 15개 중 |
|---|---|---|---|
| 지금(Google + AWL, N=5000) | 229 / 240 / 215 | — | 14 |
| wordfreq, 예외 없음, N=5000 | 196 / 206 / 186 | 102 / 36 | 6 |
| wordfreq + NAWL(CC BY-SA), N=5000 | 200 / 219 / 193 | 94 / 45 | 6 |
| wordfreq + arXiv 초록(CC0)으로 만든 학술어 목록, N=5000 | 282 / 298 / 279 | 37 / 142 | 12 |
| **wordfreq, 예외 없음, N=3000** | **267 / 278 / 255** | **33 / 108** | **11** |

- **NAWL**은 일상 고빈도어(NGSL)를 뺀 목록이라 hence, whereas 같은 단어가 없다. 그래서 보탬이 거의 없다.
- **arXiv 초록으로 만든 목록:** 기준은 다음 세 가지다.
  - 12개 분야 초록 12,000개에서의 상대 빈도가 일반 빈도의 3배 이상
  - 6개 분야 이상에 나옴
  - 초록의 0.3% 이상에 나옴

  이 목록은 input, output, error, sample 같은 쉬운 주제어까지 끌어온다. AWL과 겹치는 비율도 15~44%에 그쳤다.
- **N=3000, 예외 없음:**
  - 남는 목표 단어: hence, whereas, respectively, subsequent, substantial, derive, exhibit, yield, furthermore, crucial, considerable
  - 놓치는 목표 단어: novel, adopt, despite, widely
  - 새로 들어오는 단어 108개: accuracy, algorithm, matrix, vector, input 같은 기술어가 많다. 연구자에게는 대부분 쉬운 단어라서, 한 번 "안다"로 표시하면 다음 문서부터 빠진다.
  - 빠지는 단어 33개: achieve, assume, context, task, technique 등. AWL 덕분에 남던 쉬운 학술어가 대부분이다.
- **발음기호:**
  - 후보 단어 608개 중 80개(13%)가 CMUdict에 없다. regularization, classifier, softmax 같은 전문어가 대부분이다.
  - 그중 데모 DB에 있는 23개는 지금 사전 API가 하나도 채우지 못했다.
  - 그래서 API를 빼도 잃는 발음기호가 없다.

## 3. 바꾸는 것

1. **빈도표를 wordfreq로 바꾼다.**
   - 원본: `wordfreq` 3.1.1 영어 빈도순 단어에서 알파벳 소문자 단어(`^[a-z]+$`)만 골라 앞에서 20,000개
   - 순위는 거른 뒤의 위치다. 지금처럼 단어와 원형을 모두 키로 넣고, 키별 가장 높은 순위를 `data/frequency.json`에 남긴다.
   - 새 스크립트 `scripts/export-wordfreq.py`가 `data/wordfreq-en.txt`를 쓴다(Python, `pip install wordfreq==3.1.1`). 이 파일은 커밋하지 않는다.
   - `scripts/build-frequency.ts`는 그 파일을 읽어 `data/frequency.json`을 만든다. `npm run freq:build`가 두 단계를 차례로 실행한다.
   - Python은 빈도표를 다시 만들 때만 필요하다. 앱 실행, 테스트, CI에는 필요 없다(`frequency.json`을 커밋한다).
2. **흔한 단어 제외 기준(N)의 기본값을 5,000에서 3,000으로 바꾼다.**
   - 설정 범위(1,000~20,000)는 그대로다.
   - 사용자가 설정에서 저장한 값은 그대로 둔다. 기본값을 쓰던 경우만 바뀐다(지금 데모 DB도 저장된 설정이 없다).
3. **학술어 예외를 없앤다.** 다음을 지운다.
   - `src/lib/extract/academic.ts`와 `ExtractOptions.isAcademic`
   - 2,001위 조건
   - AWL 관련 테스트
   - `.gitignore`의 `data/awl.json` 줄
   - README의 "학술 핵심어 목록" 절

   로컬에 `data/awl.json`이 있어도 더는 읽지 않는다.
4. **사전 API를 없앤다.**
   - 지울 것: `src/lib/phonetic/lookup.ts`(요청, 5초 제한, 연속 실패 차단기)와 그 테스트
   - `withCmudictFirst` 대신 `createCmudictPhonetic()`를 둔다.
     - CMUdict만 찾는다.
     - CMUdict 자체가 실패하면(파일 없음 등) 로그를 한 번 남기고 발음기호 없이 둔다.
   - 저장 직후 채우기에 네트워크 요청이 없어진다.
5. **설정 화면 문구:** "흔한 단어 제외 기준"의 도움말에서 "학술 핵심어는 남깁니다."를 지운다. 새 문구는 "빈도 상위 N위 안의 단어는 후보에서 뺍니다."다.
6. **출처 표시:** wordfreq 데이터는 CC BY-SA 4.0이다.
   - `data/frequency-NOTICE.md`에 다음을 적는다.
     - 출처와 인용(wordfreq, SUBTLEX-US·UK, Google Books Ngram, OpenSubtitles)
     - 파생 파일(`frequency.json`)이 CC BY-SA 4.0으로 배포된다는 것
     - SUBTLEX가 무료로 공개된 데이터라는 것
   - README 데이터 출처 표도 고친다. 앱 코드는 MIT 그대로다.

## 4. 영향

- **이미 저장된 후보·카드·뜻·발음기호는 바뀌지 않는다.** 새로 올리는 문서부터 적용된다.
- 첫 몇 편은 후보가 15% 안팎 늘고 쉬운 기술어가 섞인다. 검토 화면에서 "안다"로 정리하면 이후 문서에서 빠진다.
- 하이픈 복원(8.1)도 빈도표로 "흔한 단어인지"를 보므로 결과가 조금 달라질 수 있다. 위 실측 수치에 이미 반영돼 있다.
- 사전 API가 하던 발음기호 보조가 없어진다. 실측에서 채운 것이 없었으므로 화면 변화는 없다.
- 테스트는 191개(로컬 AWL 있음) 또는 189개 통과 + 2개 건너뜀(AWL 없음)에서 **181개 통과, 건너뜀 0**이 된다. 사전 API와 차단기 테스트, AWL 테스트가 빠지고, 예외 규칙 테스트 2개는 기준 N 테스트 2개로 바뀐다.

## 5. 확인 방법

- **프로토타입과 같은 결과:**
  - 원형·표면형·횟수가 PM 실측(`wordfreq, 예외 없음, N=3000`)과 같아야 한다. 편당 후보는 ResNet 267, Attention 278, BERT 255다.
  - `npm run freq:build`로 다시 만든 `data/frequency.json`은 20,464개 항목이고, 실측에 쓴 파일과 바이트까지 같다.
- 테스트 181개, 타입 검사·린트 오류 없음, 빌드 표는 지금과 같다.
- 브라우저: 설정 화면 도움말 문구와 N 기본값 3000(저장된 설정이 없는 새 DB)을 확인한다.

## 6. 범위 밖

- AWL 상업적 이용 허락 요청: 사용자가 원하면 따로 한다. 허락을 받으면 학술어 예외를 다시 넣을 수 있다(이번에 지우는 코드는 기록에 남는다).
- CMUdict에 없는 전문어(약 13%)의 발음기호: 뜻 요청에 IPA를 함께 받는 방법 등을 나중에 검토한다.
- 빈도표 갱신: wordfreq 데이터는 2021년 기준이고 더 갱신되지 않는다. 지금 쓰기에는 충분하다.
