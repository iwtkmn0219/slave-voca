// Server Action은 브라우저에서 아무 값이나 받을 수 있으므로, DB에 닿기 전에 형태를 확인한다.

export function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

// 양의 정수 배열만 받는다. 중복은 하나로 줄인다. 형태가 다르면 null.
export function parseIdList(value: unknown): number[] | null {
  if (!Array.isArray(value) || !value.every(isId)) return null;
  return [...new Set(value)];
}
