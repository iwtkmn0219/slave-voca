# 마일스톤 1 추출 품질 확인 (2026-10-13)

- 대상 커밋: `0ce28e9` (feat/m1-extraction), 설정 기본값 `exclude_top_n=5000`
- 방법: `npm run dev`로 띄운 서버의 `/documents` 업로드 폼에 PDF를 실제로 POST하고(JS 없는 폼 제출과 같은 방식), 검토 화면 HTML과 DB의 `candidates`를 확인했다. 브라우저를 직접 조작하지는 않았다.
- 처리 시간 = 업로드 요청부터 검토 화면으로 이동하는 응답까지 + 검토 화면 로드. 서버를 띄운 뒤 첫 업로드에는 컴파일 시간이 포함된다.

| 논문 | 형식 | 처리 시간 | 후보 수 | 상위 30 중 오탐 |
|---|---|---|---|---|
| Attention Is All You Need | 1단 | 0.6초 | 219개 | 2개 (`dmodel`, `pos`) |
| ResNet | 2단 | 0.6초 (첫 요청), 이후 0.3초 | 205개 | 4개 (`conv`, `relu`, `iter`, `err`) |
| BERT | 2단 | 0.3초 | 209개 | 2개 (`finetuning`, `datasets`) |

목표 시간(5분)보다 훨씬 빠르다. 상위 30개는 대체로 쓸 만하다: residual, degradation, counterpart, transduction, bidirectional, leaderboard, ablation 등. 오탐은 주로 상위 30개 밖, 1~2회 나오는 단어에 몰려 있다.

## 오탐 유형

전체 후보 633개(3편 합계)를 훑어서 분류했다. 괄호 안은 대략적인 개수다.

- **줄 끝 하이픈 복원이 원래 하이픈이 있던 합성어까지 붙임 (약 22개)**
  - ResNet: fullyconvolutional, parameterfree, highlevel
  - Attention: sequencealigned, sourcetarget, multihead, positionwise
  - BERT: finetuning, finetune, finetuned, pretrain·pretraining·pretrains(일부는 원문 표기일 수 있음), taskspecific, featurebased, selfattention, sentencelevel, tokenlevel, representationlearning, singlemodel, rightside
  - 줄 중간의 `fine-tuning`은 규칙대로 버려지고, 줄 끝에서 잘린 것만 붙어서 후보가 된다. CodeReviewer가 Task 2 리뷰에서 지적한 문제이고, 2단 논문(BERT)에서 가장 많이 나온다.
- **저자명·이메일·소속 (약 25개)**
  - jiansun, kahe, avaswani, nikip, usz, lukaszkaiser, illia, polosukhin, aidan, llion, noam, gomez, lukasz, jacobdevlin, kentonl, kristout, mingweichang, fedus, harvard, github, gmail, edu
  - 원인 1: 이메일 아이디(`avaswani@google.com`)는 소문자라서 고유명사 필터(“항상 대문자”)를 통과한다.
  - 원인 2: 제목·저자 블록이 Abstract 앞까지 한 문장으로 붙어서 이름 일부가 문장 첫 단어 취급을 받는다.
- **비ASCII 글자 때문에 잘린 조각 (2~3개)**: `Łukasz` → `ukasz`, `Uszkoreit`의 이메일 → `usz`. 토큰 정규식이 `[A-Za-z]`라 `Ł`에서 끊긴다.
- **약칭·수식 기호 (약 25개)**
  - 약칭: conv, relu, iter, err, std, val, params, num, pos, cos, ppl, lrate
  - 수식 변수가 글자로 붙은 것: dmodel(`d_model`), dff, logk, headh, headi, qiki, maxj, tokm, snull, ith
- **형태 통합 실패 (약 7개)**: datasets/dataset, embeddings, encoders, hyperparameters, subproblems, pretrains. wink-lemmatizer 사전에 없는 전문용어는 복수형이 원형으로 바뀌지 않아 같은 단어가 두 번 나온다.
- **고유명사·데이터셋 이름이 소문자로 붙은 것 (약 5개)**: mscoco, gluebenchmark, newstest, nlnet, unet
- **원문 오타**: `befor` (BERT 원문 그대로)
- **2단 편집 때문에 섞인 문장: 상위 단어에서는 발견하지 못함.** pdf.js의 읽기 순서가 세 편 모두 단 순서를 지켰다. 대신 다음과 같은 문장 품질 문제가 있다.
  - 표가 한 문장으로 들어감. 예: BERT의 `leaderboard` 원문 문장이 GLUE 결과표 숫자 덩어리다.
  - 각주가 본문 문장 끝에 붙음. 예: `snull` 문장 뒤에 각주 12번이 이어진다.
  - 제목·저자 블록이 첫 문장에 붙음.

## 빠진 단어

`exclude_top_n=5000` 때문에 걸러진 단어 중 순위 2,001~5,000에 학술 핵심어가 많다(논문마다 약 140개).

- 외울 가치가 큰 예: hence, whereas, yield, respectively, subsequent, exhibit, employ, superior, numerous, latter, novel, derive, substantial, incorporate, primarily, adopt, equivalent, extent, conduct, obtain, sufficient, mechanism, fundamental
- 같은 구간에 쉬운 단어도 섞여 있다: experiment, push, sum, pair, dot, warm, healthy, billion, zero
- 웹 문서 기반 빈도 목록이라 학술어 순위가 실제 체감보다 높다(스펙 8.3의 리스크가 실제로 확인됨).
- 줄 중간의 하이픈 복합어(`state-of-the-art`, `fine-tuning`)는 규칙대로 통째로 버려지므로 그 안의 단어도 후보에 나오지 않는다.

## 제안

- 제외 기준 N: **5,000 유지.** 3,000으로 낮추면 hence, yield, respectively 같은 학술어가 살아나지만 experiment, push, sum, pair 같은 쉬운 단어도 같이 늘어난다. 대신 학술 핵심어를 따로 살리는 방법을 권한다(아래 5번). N은 설정에서 바꿀 수 있으니 사용자가 써 보고 조정하면 된다.
- 추가 필터 규칙 (효과가 큰 순서):
  1. **줄 끝 하이픈 복원 조건 강화:** 붙인 단어가 빈도표에 없는데 하이픈 앞뒤 조각이 각각 빈도표에 있으면 하이픈을 남긴다. 그러면 그 단어는 기존 규칙대로 합성어로 버려진다. 2단 논문의 오탐 약 20개가 사라진다.
  2. **이메일·URL 제거:** 토큰을 뽑기 전에 `\S+@\S+`와 `https?://\S+`를 지운다. 저자명 오탐 대부분과 github, gmail, edu가 사라진다.
  3. **토큰을 유니코드 글자로 뽑기:** 정규식을 `\p{L}` 기준으로 바꾸고, ASCII가 아닌 글자가 든 토큰은 버린다. `ukasz`, `usz` 같은 조각이 사라진다.
  4. **사전에 없는 단어 처리:** 영어 단어 목록(예: wink-lexicon 또는 공개 단어 목록)에 없는 원형은 검토 화면에서 기본으로 체크 해제하고 "사전에 없음"을 표시한다. conv, dmodel, logk, mscoco 같은 약칭·기호·이름이 해당한다. softmax, dropout 같은 전문용어도 함께 해제되므로, 바로 버리지 말고 체크 해제만 하기를 권한다. 다른 방법으로, M2의 발음기호 조회(dictionaryapi 404)를 같은 신호로 쓸 수도 있다.
  5. **학술 핵심어 허용 목록(선택):** Academic Word List 같은 목록에 있는 단어는 N 기준과 관계없이 후보로 남긴다. 목록 출처와 라이선스는 PM이 결정해야 한다.
  6. **복수형 보정:** 원형 처리기가 바꾸지 못한 `-s` 단어는, `s`를 뗀 형태가 같은 문서의 후보에 있으면 그 원형으로 합친다(BERT: datasets→dataset, encoders→encoder).
  7. (낮은 우선순위) 숫자 비율이 높은 "문장"(표)은 원문 문장 후보에서 빼고, 같은 단어의 다른 문장을 쓴다.
