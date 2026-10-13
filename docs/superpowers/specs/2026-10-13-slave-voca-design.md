# slave-voca 설계서

- 작성일: 2026-10-13
- 상태: 승인됨 (최초안·M1 반영 개정안 모두 2026-10-13 승인, 변경 내용은 13장)
- 관련 제안서: https://claude.ai/code/artifact/6220a7b4-f86c-417b-833d-8e7f3a3414ae

## 1. 목적

논문·발표 자료 PDF에서 어려운 영어 단어를 자동으로 뽑아, 원문 문장 기준의 한국어 뜻과 발음을 붙인 카드로 만들고 간격 반복(SRS)으로 외우게 하는 개인용 웹앱이다.

**성공 기준**

- 텍스트 선택이 가능한 논문 PDF 한 편을 넣고 추출·검토·저장까지 5분 이내
- 저장된 모든 카드에 문맥상 한국어 뜻, 발음기호(사전에 있으면), 발음 듣기, 원문 문장이 있음
- 오늘 복습할 카드만 모아 보여주고, 응답에 따라 다음 복습일이 자동으로 바뀜

## 2. 확정된 결정

| 항목 | 결정 |
|---|---|
| 사용자 | 본인 1명, 로그인 없음 |
| 실행 환경 | 로컬 PC에서 실행, PC 브라우저로 접속 |
| 배포 | 1차 범위 밖. 단, 저장소 계층을 분리해 나중에 옮기기 쉽게 설계 |
| 스택 | Next.js(App Router, TypeScript) 하나로 화면과 서버 |
| DB | SQLite (Drizzle ORM + better-sqlite3) |
| 단어 추출 | 빈도 기준. 흔한 단어 상위 5,000개(원형 기준) 제외, 설정에서 변경 가능 |
| 문맥 뜻 | Claude Haiku 5.5 (`claude-haiku-5-5`), 문서 단위로 묶어 요청 |
| 발음기호 | Free Dictionary API (`api.dictionaryapi.dev`) |
| 발음 듣기 | 브라우저 내장 Web Speech API (`speechSynthesis`, en-US) |
| 암기 방식 | FSRS 간격 반복 (`ts-fsrs` 라이브러리) |
| 새 카드 상한 | 하루 20장, 남은 카드는 다음 날로 이월. 설정에서 변경 가능 |

## 3. 범위

**1차에 포함:** PDF 업로드, 후보 단어 추출, 검토 화면, 문맥 뜻 생성, 발음기호·발음 듣기, 문서별 단어 목록, SRS 복습, 카드 뜻 수정·삭제, 설정(N, 새 카드 상한)

**1차에서 제외:** 스캔 PDF(OCR), 여러 단어로 된 구문 추출, 배포·로그인, 모바일 화면, 학습 통계, Anki 내보내기

## 4. 사용 흐름

1. **업로드:** 사용자가 PDF와 종류(논문/발표)를 고른다. 제목은 파일명에서 기본값을 채운다.
2. **추출:** 서버가 텍스트를 문장으로 나누고, 후보 단어 목록을 만들어 `candidates`에 저장한다.
3. **검토:** 사용자가 후보 목록에서 아는 단어를 체크 해제하고 "저장"을 누른다.
   - 체크 해제한 단어 → `known_words`에 추가, 이후 모든 추출에서 제외
   - 체크한 단어 → `words`(카드)와 `occurrences`(용례) 생성
4. **뜻·발음 채우기:** 저장 직후 서버가 문맥 뜻과 발음기호를 채운다. 화면은 진행 상태를 보여준다.
5. **복습:** 매일 "오늘의 복습"에서 카드를 보고 모름/애매/앎으로 응답한다.

## 5. 화면

| 경로 | 화면 | 내용 |
|---|---|---|
| `/` | 홈 | 오늘 복습할 카드 수(복습/새 카드), "복습 시작" 버튼, 최근 문서 |
| `/documents` | 문서 목록 | 업로드 폼, 문서별 상태(검토 대기/처리 중/완료/오류)와 단어 수 |
| `/documents/[id]/review` | 검토 | 후보 표: 체크박스, 단어(원형), 문서 내 등장 횟수, 원문 문장(단어 강조), "이미 학습 중"·"사전에 없음" 표시. 사전에 없는 단어는 기본 체크 해제, 나머지는 기본 체크. 전체 선택/해제, 저장 |
| `/documents/[id]` | 문서 단어 목록 | 이 문서의 용례 목록: 단어, 발음기호, 문맥 뜻, 원문 문장. 뜻 수정, 실패한 뜻 재시도, 카드 삭제 |
| `/study` | 복습 | 앞면: 단어 + 발음 버튼. 뒷면: 발음기호, 문맥 뜻, 원문 문장(용례가 여럿이면 최신 2개). 모름/애매/앎 버튼 |
| `/settings` | 설정 | 제외 기준 N, 하루 새 카드 상한 |

## 6. 모듈 구조

```
src/
  app/                    Next.js 화면과 Route Handler / Server Action
  lib/
    pdf/parse.ts          PDF → 정제된 문장 배열
    extract/extract.ts    문장 배열 → 후보 단어 목록
    extract/frequency.ts  빈도표 로드, 원형의 순위 조회
    meaning/generate.ts   (단어, 문장) 묶음 → 한국어 뜻 (Claude API)
    phonetic/lookup.ts    단어 → 발음기호 (Free Dictionary API)
    srs/scheduler.ts      응답 → 다음 복습 상태, 오늘의 복습 큐
  server/
    db/schema.ts          Drizzle 스키마
    db/client.ts          DB 연결 (교체 지점)
    repo/*.ts             모든 DB 읽기·쓰기
data/
  frequency.json          원형 → 순위 (빌드 스크립트로 생성)
  awl.json                AWL 대표어 570개 (공식 문서에서 1회 추출, 8.7)
scripts/
  build-frequency.ts      공개 영어 빈도 목록 → 원형 기준 순위표
```

**원칙:** `lib/` 모듈은 DB를 모르고 입력→출력만 다룬다. DB 접근은 `server/repo/`에서만 한다. 배포로 옮길 때는 `db/client.ts`와 스키마 방언만 바꾼다.

## 7. 데이터 모델

| 테이블 | 컬럼 | 비고 |
|---|---|---|
| `documents` | id, title, kind(paper/presentation), status(extracting/reviewing/processing/done/error), error_message, created_at | 원본 PDF는 저장하지 않음 |
| `candidates` | id, document_id, lemma, surface, sentence, count, is_existing, in_dictionary | 검토가 끝나면 해당 문서 행 삭제 |
| `words` | id, lemma(unique), phonetic, FSRS 상태(due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review), introduced_at, created_at | 카드 1장 = 단어 1개 |
| `occurrences` | id, word_id, document_id, surface, sentence, meaning_ko, meaning_status(pending/done/failed), created_at | 같은 단어도 문서마다 뜻이 다를 수 있어 뜻은 여기에 저장 |
| `known_words` | lemma(PK), created_at | 추출에서 제외 |
| `review_logs` | id, word_id, rating, reviewed_at | 복습 기록 |
| `settings` | key(PK), value | `exclude_top_n`=5000, `daily_new_limit`=20 |

- 같은 단어가 다른 문서에서 다시 저장되면 `words`는 그대로 두고 `occurrences`만 추가한다. SRS 상태는 초기화하지 않는다.
- 카드 삭제는 `words`와 그 `occurrences`, `review_logs`를 함께 지운다. 삭제한 단어는 `known_words`에 넣지 않는다.

## 8. 처리 규칙

### 8.1 PDF 파싱 (`lib/pdf/parse.ts`)

- `pdfjs-dist`로 페이지별 텍스트를 읽는다.
- 줄 끝 하이픈 복원: `"inter-\nnational"` → `"international"` (하이픈 뒤 줄바꿈이고 다음 글자가 소문자일 때만). **단, 붙인 단어가 실제 단어가 아니고(빈도표에도 없고 원형 기준으로 WordNet 사전에도 없음) 앞뒤 조각이 각각 빈도표에 있으면 하이픈을 남긴다**(`"fine-\ntuning"` → `"fine-tuning"`). 이렇게 남은 단어는 8.2의 2번 규칙대로 합성어로 버려진다. 붙인 단어를 빈도표로만 판정하면 이 앱이 뽑아야 할 드문 단어(`in-\nvariance`, `under-\npin`, `out-\nperform`)까지 합성어로 잃기 때문에 사전도 함께 본다. 빈도표·사전 조회는 함수 인자로 받아 `lib/pdf`가 단어 목록에 직접 의존하지 않게 한다.
- 이메일 주소(`\S+@\S+`)와 URL(`https?://\S+`)을 지운다. 저자 이메일 아이디(`avaswani`)가 후보로 새는 것을 막는다.
- 참고문헌 제목 줄부터 끝까지 버린다. 제목은 대소문자를 구분해 `References`, `REFERENCES`, `Bibliography`, `BIBLIOGRAPHY`, `참고문헌`만 인정하고, 앞에 장 번호(`6 References`, `7. REFERENCES`)가 붙어도 인정한다. 제목이 여러 번 나오면 **마지막** 제목에서 자른다.
- `Intl.Segmenter('en', { granularity: 'sentence' })`로 문장을 나눈다.
- 공백을 제외한 추출 텍스트가 200자 미만이면 실패로 처리한다: "텍스트를 찾지 못했습니다. 스캔 PDF는 지원하지 않습니다."

### 8.2 단어 추출 (`lib/extract/extract.ts`)

1. 문장마다 `/\p{L}+(?:-\p{L}+)*/gu`로 토큰을 뽑는다(유니코드 글자 기준).
2. 3글자 미만, 모두 대문자인 약어(예: `CNN`), 하이픈 복합어, **ASCII가 아닌 글자가 든 토큰**(`Łukasz`)은 버린다. 유니코드 기준으로 뽑은 뒤 버려야 `Łukasz`가 `ukasz` 조각으로 남지 않는다.
3. 소문자로 바꾸고 `wink-lemmatizer`로 원형을 만든다(명사→동사→형용사 순으로 시도해 처음으로 형태가 바뀐 결과, 없으면 그대로).
4. 문장 첫 단어가 아닌 위치에서 **항상 대문자로만** 나온 단어는 고유명사로 보고 버린다. (한계: 문장 첫머리에만 나오는 인명은 거르지 못한다. 검토 화면에서 사용자가 해제한다.)
5. 빈도 순위가 `exclude_top_n` 이하인 단어(표면형 또는 원형)와 `known_words`에 있는 원형을 버린다. 표면형도 보는 이유: `data`의 원형이 `datum`으로 바뀌어 흔한 단어가 새어 나오는 것을 막는다. 빈도표에 없는 원형은 남긴다(전문용어일 가능성이 높음). **예외: 원형이 학술 핵심어 목록(8.7)에 있고 순위가 2,001 이상이면 남긴다.** 상위 2,000위 안의 AWL 단어 174개(area, data, code 등)는 쉬워서 예외에서 뺀다. `known_words` 제외는 예외 없이 적용한다.
6. 원형별로 묶어 등장 횟수와 원문 문장을 기록한다. 원문 문장은 첫 등장 문장을 쓰되, 300자를 넘으면 **단어가 보이도록 단어 주변을 잘라** 300자로 맞춘다(앞뒤로 잘린 쪽에 `…`). `words`에 이미 있으면 `is_existing=true`.
7. **복수형 보정:** 원형이 `s`로 끝나고(`ss`로 끝나는 것은 제외) `s`를 뗀 형태가 같은 문서의 후보에 있으면, 그 후보에 횟수를 합친다(`datasets` → `dataset`). 원문 문장은 합쳐지는 쪽(`dataset`)의 것을 유지한다.
8. **사전 확인:** 원형이 영어 단어 목록(`wink-lexicon`의 WordNet 단어 77,262개, MIT 라이선스, 이미 설치됨)에 있으면 `in_dictionary=true`. 없으면 검토 화면에서 기본 체크 해제하고 "사전에 없음"을 표시한다. 버리지는 않는다. 알려진 한계: `dataset`, `encoder`, `embedding` 같은 최신 전문용어도 사전에 없음으로 나온다. 반대로 `err`, `std`는 사전에 있어 그대로 통과한다.
9. 등장 횟수 내림차순, 같으면 알파벳순으로 정렬한다.
10. 빈도표·학술어 목록 조회는 객체의 프로토타입 키(`constructor` 등)에 반응하지 않아야 한다.

### 8.3 빈도표 (`scripts/build-frequency.ts`)

- 입력: 공개 영어 빈도 목록 `first20hours/google-10000-english`의 `20k.txt` (빈도순 단어 2만 개)
- 각 단어와 그 원형(8.2의 3번 방식)을 둘 다 키로 넣고, 키별 **가장 높은 순위**를 남겨 `data/frequency.json`으로 저장한다.
- 리스크: 이 목록은 웹 문서 기반이라 학술 기본어 순위가 실제와 다를 수 있다. 마일스톤 1에서 확인한 결과, 순위 2,001~5,000에 학술 핵심어가 논문마다 약 140개씩 들어 있었다(hence, whereas, derive 등). 이 문제는 N을 낮추지 않고 8.7의 학술 핵심어 목록으로 보완한다. N 기본값은 5,000을 유지한다.

### 8.4 문맥 뜻 생성 (`lib/meaning/generate.ts`)

- `@anthropic-ai/sdk`, 모델 `claude-haiku-5-5`, `output_config.effort: "low"`
- 한 요청에 최대 50개의 (id, 단어, 원문 문장)을 담는다. 100개면 2번 요청한다.
- 구조화 출력(`output_config.format`의 JSON 스키마)으로 `[{ id, meaning_ko }]`를 받는다.
- 시스템 지시: "각 단어가 주어진 문장에서 쓰인 의미를 한국어로 짧게(2~15자, 품사에 맞게) 답하라. 사전의 첫 뜻이 아니라 이 문장 속 의미를 쓴다."
- API 키는 환경변수 `ANTHROPIC_API_KEY`(`.env.local`)에서 읽고, 서버에서만 사용한다.
- 응답에 빠진 id나 요청 실패는 해당 용례를 `meaning_status=failed`로 둔다. 문서 단어 목록에서 재시도할 수 있다.
- SDK 사용법은 구현 시 claude-api 스킬의 TypeScript 문서를 따른다.

### 8.5 발음기호 (`lib/phonetic/lookup.ts`)

- `GET https://api.dictionaryapi.dev/api/v2/entries/en/{lemma}` 응답에서 첫 번째로 비어 있지 않은 `phonetic` 또는 `phonetics[].text`를 쓴다.
- 404나 오류가 나면 아래 CMUdict 보조로 넘어간다. 재시도하지 않는다.
- 동시 요청은 5개, 요청당 5초 제한. 연속 5번 장애(시간 초과·네트워크 오류·5xx·**429**)가 나면 남은 단어는 API를 건너뛰고 CMUdict만 쓴다. 404는 장애로 세지 않는다. (M2에서는 429를 404처럼 다뤄 차단기에 세지 않았다. M3에서 장애로 바꾼다.)
- **CMUdict 보조 (`lib/phonetic/cmudict.ts`, `data/cmudict-ipa.json`):** API에서 발음기호를 얻지 못한 단어는 CMU Pronouncing Dictionary(약 13만 5천 단어, BSD 2-clause, 미국식 발음)에서 찾는다. 원형과 표면형을 순서대로 찾고, 여러 발음이 있으면 첫 번째를 쓴다. ARPAbet 표기를 IPA로 바꿔 `/.../` 형태로 저장한다. 강세 기호(ˈ, ˌ)는 강세 모음 바로 앞 자음 하나 앞에 붙이는 근사 규칙을 쓴다(음절 분리는 하지 않음). 그래도 없으면 `phonetic=null`.
- CMUdict 데이터는 빌드 스크립트(`scripts/build-cmudict.ts`)가 원본을 내려받아, 알파벳 소문자 단어만 남긴 IPA 표로 만들어 커밋한다. 저작권 고지는 `data/cmudict-LICENSE`로 함께 둔다.
- API와 CMUdict는 서로 다른 출처라 표기가 조금 다를 수 있다(API는 영국식이 섞임). 학습용으로는 허용한다.

### 8.6 SRS (`lib/srs/scheduler.ts`)

- `ts-fsrs` 기본 파라미터를 쓴다. 응답은 모름→Again, 애매→Hard, 앎→Good에 대응한다.
- **오늘의 큐:** (1) `state != New`이고 `due <= 지금`인 카드, due 오름차순 + (2) 새 카드 중 `created_at` 오름차순으로 `daily_new_limit - 오늘 처음 본 새 카드 수`장
- 새 카드를 처음 응답하면 `introduced_at`을 기록한다. "오늘"은 로컬 자정을 기준으로 한다.
- 큐는 복습 화면을 열 때 계산하고, 응답할 때마다 서버에 저장한다. Again을 받은 카드는 같은 세션 끝에 다시 보여준다.

### 8.7 학술 핵심어 목록 (`data/awl.json`)

- 출처: Coxhead의 Academic Word List(AWL, 2000). 대표어(headword) 570개를 원형화해 저장한다.
- 용도: 8.2의 5번 예외. 이 목록에 있고 빈도 순위가 2,001 이상인 원형은 `exclude_top_n` 안이어도 후보로 남긴다. 2,001~5,000위 구간에 166개가 있다(achieve, adequate, assume, hence, whereas 등).
- 파일: 공식 대표어 문서(`Headwords-of-the-Academic-Word-List.docx`, Victoria University of Wellington)에서 1회 추출한 570개 단어의 JSON 배열. 로드할 때 원형화한다.
- 철자: 목록은 영국식이다. 실제 영국식 철자인 대표어 4개(analyse, maximise, minimise, utilise)에만 미국식 형태(analyze, maximize, minimize, utilize)를 함께 넣는다. comprise, likewise, precise, revise처럼 -ise로 끝나도 철자 변형이 없는 단어에는 적용하지 않는다.
- 한계: 대표어만 쓰므로 M1에서 꼽은 학술 핵심어 23개 중 약 13개만 살아난다(respectively, numerous, novel, substantial, adopt 등은 AWL 대표어가 아님). 나머지는 사용자가 N을 조정하거나 나중에 단어군(word family) 목록을 도입할 때 다룬다.
- 라이선스: 명시된 이용 조건이 없다. **로컬 개인용으로만 쓴다.** 저장소를 공개하거나 앱을 배포하기 전에 사용자와 다시 검토한다. (같은 목적의 NAWL은 CC BY-SA 4.0이지만, 일상 고빈도어를 제외한 목록이라 목표 단어 10개 중 하나도 없어서 쓰지 않는다.)

## 9. 오류 처리

| 상황 | 처리 |
|---|---|
| PDF가 아님, 50MB 초과 | 업로드 거부, 메시지 표시. 50MB 초과는 폼에서 제출 전에 막는다. PDF 판별은 앞 1,024바이트 안에 `%PDF-`가 있으면 인정한다(PDF 규격이 허용하는 앞쪽 쓰레기 바이트 대응) |
| 텍스트 없음(스캔 PDF) | 문서 `status=error`, 사유 표시 |
| 후보 0개 | 검토 화면에 "외울 단어가 없습니다" 표시, 문서는 `done` |
| `ANTHROPIC_API_KEY` 없음 | 카드는 저장하고 뜻은 `failed`, 화면에 키 설정 안내 |
| Claude API 실패, 응답 누락 | 해당 용례 `failed`, 재시도 버튼 |
| 사전 API 실패 | 발음기호만 비움, 발음 듣기는 유지 |
| 브라우저 TTS 없음 | 발음 버튼 숨김 |

## 10. 테스트

- **단위 테스트 (Vitest)**
  - `pdf/parse`: 하이픈 복원, 참고문헌 제거, 문장 분리, 텍스트 부족 판정 (텍스트 픽스처 사용)
  - `extract`: 길이·약어·고유명사 제외, 원형 통합(studies/studied→study), N 기준, known_words 제외, 정렬
  - `srs/scheduler`: 오늘의 큐 구성, 새 카드 상한, 이월, 자정 경계
  - `meaning/generate`: SDK를 목으로 대체해 묶음 분할, 누락 id → failed, 오류 → failed
  - `repo`: 메모리 SQLite로 같은 단어 재저장 시 용례만 추가, 카드 삭제 연쇄
- **수동 확인:** 실제 논문 PDF 3편(1단 1편, 2단 2편)으로 추출 품질과 처리 시간 5분 이내를 확인한다.
- 실제 Claude API 호출은 수동 확인에서만 한다.

## 11. 마일스톤

1. **추출 검증 (완료, 2026-10-13):** 프로젝트 골격, PDF 파싱, 빈도표, 단어 추출, 검토 화면(저장 전까지). 논문 3편 품질 확인 결과는 `docs/superpowers/notes/2026-10-13-m1-extraction-check.md`
2. **추출 개선 + 카드 만들기 (완료, 2026-10-13):** 8.1·8.2 개정 규칙(하이픈 합성어, 이메일·URL, 비ASCII, 복수형, 사전 확인, 학술 핵심어 목록, 단어 주변 자르기), DB 스키마, 저장, known_words, 문맥 뜻 생성, 발음기호. 첫 작업으로 브라우저에서 M1의 체크박스·전체 선택과 업로드 크기 제한을 확인한다. 확인 결과는 `docs/superpowers/notes/2026-10-13-m2-check.md`
3. **복습:** 오늘의 큐, 복습 화면, TTS, FSRS 갱신, 홈 화면의 오늘 복습 요약, 발음기호 CMUdict 보조(8.5)와 429 장애 처리
4. **다듬기:** 문서 단어 목록, 뜻 수정·재시도, 카드 삭제, 설정, 오류 메시지. M2 리뷰에서 넘어온 항목: 채우기 실패(error) 문서에서 단어 목록으로 가는 링크, 저장 입력 검사(정수 배열), 단수형이 아는 단어일 때 복수형이 남는 문제, 발음 구별 기호 단어(naïve, café) 제외 문제, 짧은 단어 복수형 오병합(lens→len), 뜻 묶음 동시 요청(키로 측정 후), 저장 후 백그라운드 채우기(검토)

## 12. 열린 항목

- Claude API 키 발급 여부: 아직 없다(2026-10-13 확인). 키가 없어도 마일스톤 2의 추출 개선, 저장, 발음기호는 진행할 수 있다. 뜻 생성은 테스트에서 SDK를 목으로 대체하고, 실제 호출 확인만 키를 받은 뒤 한다.
- AWL 라이선스: 저장소 공개나 앱 배포 전에 다시 검토한다(8.7).

## 13. 변경 이력

- 2026-10-13: 최초 작성, 승인
- 2026-10-13: 마일스톤 1 품질 확인과 코드 리뷰 결과 반영. 8.1(하이픈 복원 조건, 이메일·URL 제거, 번호 붙은 참고문헌 제목, 마지막 제목에서 자르기), 8.2(유니코드 토큰, 비ASCII 제외, 학술어 예외, 단어 주변 자르기, 복수형 보정, 사전 확인, 프로토타입 키), 8.7 신설, `candidates.in_dictionary` 추가, 검토 화면 기본 체크 규칙, PDF 판별 1,024바이트, 마일스톤 2 범위
- 2026-10-13: AWL 예외를 빈도 순위 2,001 이상으로 한정(M2 프로토타입에서 상위 2,000위 안의 AWL 단어가 오탐을 늘리는 것을 확인)
- 2026-10-13: M2 리뷰 반영. 8.1 하이픈 판정에 WordNet 사전 추가, AWL 절 번호를 8.7로 바로잡음(8.6 SRS와 중복), AWL 미국식 철자 추가, AWL 범위의 한계 명시
- 2026-10-13: M2 완료 반영. 8.5에 CMUdict 보조와 429 장애 처리 추가(사전 API가 하루 종일 응답하지 않아 카드 203개 중 1개만 발음기호가 채워짐), 마일스톤 3·4 범위에 M2 리뷰 항목 배정
