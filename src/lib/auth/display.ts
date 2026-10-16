// 인증·관리 화면의 표시용 순수 함수(화면 규칙 3.2, 5.2, 6.2, 2.3).

const TIME_ZONE = 'Asia/Seoul'; // 베타 사용자는 한국에 있다. 서버 시간대에 따라 표기가 달라지지 않게 고정한다.

const joinedAt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TIME_ZONE,
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const yearOf = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric' });

// "10월 16일 14:32". 올해가 아니면 앞에 "2025년"을 붙인다.
export function formatJoinedAt(date: Date, now: Date): string {
  const text = joinedAt.format(date);
  const year = yearOf.format(date);
  return year === yearOf.format(now) ? text : `${year}년 ${text}`;
}

// 머리글자 원: 이름의 첫 글자(대문자), 이름이 없으면 이메일의 첫 글자.
export function initialOf(name: string, email: string): string {
  const source = name.trim() || email.trim();
  return (Array.from(source)[0] ?? '').toUpperCase();
}

// 계정 버튼에 보일 이름. 이름이 없으면 이메일의 @ 앞부분.
export function displayName(name: string, email: string): string {
  return name.trim() || email.split('@')[0];
}

// /login?error= 값을 안내 종류로 바꾼다. 원인 코드는 화면에 보이지 않는다.
export function loginNoticeKind(error: string | string[] | undefined): 'cancelled' | 'error' | null {
  if (error === undefined) return null;
  return error === 'access_denied' ? 'cancelled' : 'error';
}
