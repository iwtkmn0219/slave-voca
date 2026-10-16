# slave-voca

논문·발표 자료 PDF에서 어려운 영어 단어를 뽑아, 원문 문장 기준의 한국어 뜻과 발음을 붙인 카드로 만들고 간격 반복(FSRS)으로 외우게 하는 개인용 웹앱입니다.

- PDF를 올리면 빈도 기준으로 후보 단어를 뽑고, 검토 화면에서 고른 단어만 카드로 저장합니다.
- 뜻은 Gemini(`gemini-3.5-flash-lite`)가 그 단어가 쓰인 문장을 보고 만듭니다. 발음기호는 CMUdict에서 가져옵니다.
- 복습 화면은 키보드로 씁니다(Space 뒷면, 1~3 응답, Z 되돌리기, P 발음).

설계와 개발 기록은 `docs/superpowers/`에 있습니다(한국어).

> 로그인이 없는 1인용 로컬 앱입니다. 인터넷에 그대로 열어 두지 마세요. 주소를 아는 누구나 PDF를 올려 Gemini 요금을 쓰고 카드를 고칠 수 있습니다.

## 실행

Node.js 24에서 개발했습니다.

```bash
npm ci
cp .env.example .env.local   # 값을 채운다(아래)
npm run dev
```

- 로그인은 Google 계정으로 합니다. `ADMIN_EMAILS`의 이메일은 바로 관리자로 들어가고, 다른 사람은 가입한 뒤 관리자가 `/admin`에서 승인해야 씁니다.
- Google 설정 없이 이 컴퓨터에서만 써 보려면 `AUTH_DEV_LOGIN=1`로 두세요. 로그인 화면에 이메일만으로 들어가는 개발용 칸이 생깁니다(`BETTER_AUTH_URL`이 localhost일 때만).

- `GEMINI_API_KEY`가 없어도 단어 추출·카드·복습은 됩니다. 뜻만 "실패"로 남고, 키를 넣은 뒤 단어 목록에서 다시 만들 수 있습니다.
- DB는 처음 실행할 때 `data/app.db`(SQLite)에 만들어집니다. 다른 경로를 쓰려면 `SLAVE_VOCA_DB`를 지정합니다.
- 검사: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`

### Google 로그인 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만든다.
2. "API 및 서비스 → OAuth 동의 화면"에서 외부(External) 앱으로 만들고, 앱 이름과 지원 이메일을 적는다. 범위는 기본(이메일, 프로필, openid)만 쓴다.
   - 게시 상태가 "테스트"이면 테스트 사용자로 등록한 계정만 로그인할 수 있다. 누구나 가입 신청을 하게 하려면 "프로덕션으로 게시"한다(기본 범위만 쓰면 Google 검토가 필요 없다).
3. "사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID"에서 "웹 애플리케이션"을 고른다.
   - 승인된 리디렉션 URI: `<BETTER_AUTH_URL>/api/auth/callback/google` (예: `http://localhost:3000/api/auth/callback/google`). 배포 주소가 생기면 그 주소도 더한다.
4. 받은 클라이언트 ID와 보안 비밀을 `.env.local`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 넣고, `BETTER_AUTH_SECRET`(32자 이상 무작위)과 `ADMIN_EMAILS`(내 Google 이메일)를 채운다.

## 데이터 출처

| 파일 | 출처 | 조건 |
|---|---|---|
| `data/frequency.json` | [wordfreq](https://github.com/rspeer/wordfreq) 3.1.1 영어 빈도(SUBTLEX, Google Books Ngram, OpenSubtitles, Wikipedia 등에서 집계). `npm run freq:build`로 다시 만든다(Python, `pip install wordfreq==3.1.1`) | CC BY-SA 4.0, 출처는 `data/frequency-NOTICE.md` |
| `data/cmudict.txt` | [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict). `npm run cmudict:build`로 다시 만든다 | BSD 형식, `data/cmudict-LICENSE` |
| 영어 사전 확인 | `wink-lexicon`(WordNet 파생) | MIT / WordNet 라이선스 |

## 개발 흐름과 버전

[CONTRIBUTING.md](CONTRIBUTING.md)와 [CHANGELOG.md](CHANGELOG.md)를 보세요.

## 라이선스

코드는 [MIT](LICENSE)입니다. 위 데이터 파일에는 각 출처의 조건이 따로 적용됩니다.
