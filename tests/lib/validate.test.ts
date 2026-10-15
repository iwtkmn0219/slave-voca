import { describe, expect, it } from 'vitest';
import { isId, isJsonContentType, parseIdList } from '@/lib/validate';

describe('isId and parseIdList', () => {
  it('accepts positive integer ids and removes duplicates', () => {
    expect(isId(3)).toBe(true);
    expect(parseIdList([3, 1, 3])).toEqual([3, 1]);
    expect(parseIdList([])).toEqual([]);
  });

  it('rejects anything else', () => {
    expect(isId(0)).toBe(false);
    expect(isId(1.5)).toBe(false);
    expect(isId('3')).toBe(false);
    expect(parseIdList('1,2')).toBeNull();
    expect(parseIdList([1, '2'])).toBeNull();
    expect(parseIdList([1, -2])).toBeNull();
    expect(parseIdList(null)).toBeNull();
  });
});

describe('isJsonContentType', () => {
  it('accepts exactly the JSON media type, with or without parameters', () => {
    expect(isJsonContentType('application/json')).toBe(true);
    expect(isJsonContentType('application/json; charset=utf-8')).toBe(true);
    expect(isJsonContentType(' Application/JSON ;charset=UTF-8')).toBe(true);
  });

  it('rejects cross-site form types, even when a parameter mentions json', () => {
    // text/plain·form 형식은 사전 확인(preflight) 없이 다른 사이트가 보낼 수 있다.
    expect(isJsonContentType('text/plain')).toBe(false);
    expect(isJsonContentType('text/plain; x=application/json')).toBe(false);
    expect(isJsonContentType('application/x-www-form-urlencoded')).toBe(false);
    expect(isJsonContentType('application/jsonp')).toBe(false);
    expect(isJsonContentType('')).toBe(false);
    expect(isJsonContentType(null)).toBe(false);
  });
});
