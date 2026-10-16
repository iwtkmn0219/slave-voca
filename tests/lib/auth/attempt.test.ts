import { describe, expect, it } from 'vitest';
import { succeeded } from '@/lib/auth/attempt';

describe('succeeded', () => {
  it('is true when the call resolves without an error', async () => {
    expect(await succeeded(async () => ({ data: { ok: true }, error: null }))).toBe(true);
    expect(await succeeded(async () => ({}))).toBe(true);
    expect(await succeeded(async () => undefined)).toBe(true);
  });

  it('is false when the call resolves with an error', async () => {
    expect(await succeeded(async () => ({ data: null, error: { status: 500, message: 'x' } }))).toBe(false);
  });

  it('is false when the call throws, such as a network failure', async () => {
    expect(
      await succeeded(async () => {
        throw new TypeError('fetch failed');
      }),
    ).toBe(false);
  });
});
