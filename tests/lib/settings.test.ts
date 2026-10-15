import { describe, expect, it } from 'vitest';
import { parseSettingsInput } from '@/lib/settings';

const valid = { excludeTopN: '5000', dailyNewLimit: '20', autoSpeak: false, theme: 'system' };

describe('parseSettingsInput', () => {
  it('accepts values in range, including the edges and 0 new cards', () => {
    expect(parseSettingsInput(valid)).toEqual({
      ok: true,
      value: { excludeTopN: 5000, dailyNewLimit: 20, autoSpeak: false, theme: 'system' },
    });
    expect(parseSettingsInput({ ...valid, excludeTopN: '1000', dailyNewLimit: '0', theme: 'dark' })).toMatchObject({
      ok: true,
      value: { excludeTopN: 1000, dailyNewLimit: 0, theme: 'dark' },
    });
    expect(parseSettingsInput({ ...valid, excludeTopN: ' 20000 ', dailyNewLimit: '200' })).toMatchObject({ ok: true });
  });

  it('reports every field that is out of range or not an integer', () => {
    expect(parseSettingsInput({ ...valid, excludeTopN: '999', dailyNewLimit: '1.5' })).toEqual({
      ok: false,
      errors: {
        excludeTopN: '1,000에서 20,000 사이의 정수를 넣어 주세요.',
        dailyNewLimit: '0에서 200 사이의 정수를 넣어 주세요.',
      },
    });
    expect(parseSettingsInput({ ...valid, dailyNewLimit: '201' })).toEqual({
      ok: false,
      errors: { dailyNewLimit: '0에서 200 사이의 정수를 넣어 주세요.' },
    });
    expect(parseSettingsInput({ ...valid, excludeTopN: '' })).toMatchObject({ ok: false });
    expect(parseSettingsInput({ ...valid, excludeTopN: '-5' })).toMatchObject({ ok: false });
  });

  it('rejects requests the form cannot send', () => {
    expect(parseSettingsInput(null)).toBeNull();
    expect(parseSettingsInput({ ...valid, theme: 'blue' })).toBeNull();
    expect(parseSettingsInput({ ...valid, autoSpeak: 'true' })).toBeNull();
  });
});
