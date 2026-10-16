// 뜻 다시 만들기 결과 문구. 서버 Action과 화면이 같이 쓴다.
// 버튼 자리(단어 목록 260px 열, 카드 출처 줄 오른쪽)에 한 줄로 들어가게 짧게 둔다.
// 키를 넣는 방법은 홈 화면 안내가 자세히 알려 준다.
export const REGEN_FAILED = '다시 만들지 못했습니다';
export const MISSING_KEY_MESSAGE = 'API 키가 없어 만들 수 없습니다';

// 이번 달 한도(개인 또는 전체)에 걸렸을 때(C-1 화면 규칙 2장). resetsOn은 서버가 돌려주는 "11월 1일" 같은 날짜다.
// 개인 한도와 전체 상한을 구분하지 않는다.
export const LIMIT_SAVE = (resetsOn: string) =>
  `이번 달 사용량을 다 써서 저장하지 않았습니다. 고른 단어는 그대로 있습니다. ${resetsOn}부터 저장할 수 있고, 더 필요하면 관리자에게 문의해 주세요.`;
export const LIMIT_REGEN = (resetsOn: string) =>
  `이번 달 사용량을 다 써서 뜻을 다시 만들지 못했습니다. 원래 뜻은 그대로입니다. ${resetsOn}부터 다시 만들 수 있고, 더 필요하면 관리자에게 문의해 주세요.`;
export const LIMIT_CARD = (resetsOn: string) =>
  `이번 달 사용량을 다 써서 뜻을 만들 수 없습니다. ${resetsOn}부터 다시 만들 수 있고, 더 필요하면 관리자에게 문의해 주세요.`;
export const LIMIT_SLOT = '이번 달 사용량을 다 썼습니다 · 관리자에게 문의해 주세요';
