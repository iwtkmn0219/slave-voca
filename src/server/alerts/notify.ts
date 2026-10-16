// 관리자 알림(C-1). ALERT_WEBHOOK_URL이 Discord·Slack 웹훅이면 거기로 보내고, 없으면 서버 로그에만 남긴다.
// 알림에는 문서 문장·뜻·비밀값·세션 정보를 넣지 않는다. 보내기에 실패해도 앱 동작은 막지 않는다.

const SEND_TIMEOUT_MS = 5000;

// 웹훅 주소에 맞는 본문. 알 수 없는 주소는 null(보내지 않는다).
export function webhookBody(url: string, text: string): object | null {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    host = u.hostname;
  } catch {
    return null;
  }
  if (host === 'discord.com' || host === 'discordapp.com') return { content: text };
  if (host === 'hooks.slack.com') return { text };
  return null;
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export async function notify(
  text: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
  fetcher: Fetcher = fetch,
): Promise<void> {
  console.warn(`[알림] ${text}`);
  const url = env.ALERT_WEBHOOK_URL;
  if (!url) return;
  const body = webhookBody(url, text);
  if (!body) {
    console.error('알림 주소가 Discord·Slack 웹훅이 아니라 보내지 않았습니다.');
    return;
  }
  try {
    const res = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) console.error(`알림을 보내지 못했습니다: ${res.status}`);
  } catch (err) {
    console.error('알림을 보내지 못했습니다', err instanceof Error ? err.name : err);
  }
}

// 같은 key는 windowMs 안에 한 번만 보낸다(서버 오류용). 메모리에 두므로 서버가 다시 시작하면 처음부터 센다.
const lastSent = new Map<string, number>();
export const ERROR_ALERT_WINDOW_MS = 10 * 60 * 1000;

export function shouldSendThrottled(key: string, now: number, windowMs = ERROR_ALERT_WINDOW_MS): boolean {
  const last = lastSent.get(key);
  if (last !== undefined && now - last < windowMs) return false;
  lastSent.set(key, now);
  return true;
}

export function resetThrottleForTest(): void {
  lastSent.clear();
}

// 오류에서 알림에 실어도 안전한 것만 뽑는다: 종류(name), code, status. 메시지는 싣지 않는다.
// 쿼리 오류 메시지에는 문장·뜻 같은 값이, API 오류에는 요청 내용이 들어갈 수 있다. 자세한 내용은 서버 로그에 있다.
// 영문·숫자·_ . - 만으로 된 짧은 값만 받는다.
const SAFE_LABEL = /^[\w.-]{1,60}$/;
function safeLabel(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value);
  return SAFE_LABEL.test(text) ? text : null;
}

export function errorLabel(err: unknown): string {
  const { code, status } = (typeof err === 'object' && err !== null ? err : {}) as { code?: unknown; status?: unknown };
  const name = err instanceof Error ? safeLabel(err.name) : null;
  return [name ?? '오류', safeLabel(code), safeLabel(status)].filter((p): p is string => p !== null).join(' · ');
}

// 서버 오류 알림. 같은 오류(장소+종류+code+status)는 10분에 한 번.
export async function notifyServerError(where: string, err: unknown): Promise<void> {
  const label = errorLabel(err);
  if (!shouldSendThrottled(`${where}|${label}`, Date.now())) return;
  await notify(`서버 오류 (${where})\n${label}`);
}
