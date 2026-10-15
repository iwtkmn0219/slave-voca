// Server Action은 브라우저에서 아무 값이나 받을 수 있으므로, DB에 닿기 전에 형태를 확인한다.

export function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

// 양의 정수 배열만 받는다. 중복은 하나로 줄인다. 형태가 다르면 null.
export function parseIdList(value: unknown): number[] | null {
  if (!Array.isArray(value) || !value.every(isId)) return null;
  return [...new Set(value)];
}

// Content-Type이 정확히 application/json인지. 매개변수(charset 등)는 허용하지만 "text/plain; x=application/json"처럼
// 매개변수에 json이 들어 있는 값은 거른다. text/plain·form 형식은 다른 사이트가 사전 확인(preflight) 없이 보낼 수 있다.
export function isJsonContentType(value: string | null): boolean {
  return value?.split(';')[0].trim().toLowerCase() === 'application/json';
}
