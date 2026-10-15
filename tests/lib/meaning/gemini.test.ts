import { describe, expect, it } from 'vitest';
import { createGeminiMeaningModel, MEANING_MODEL_ID, type GeminiClient } from '@/lib/meaning/gemini';

// models.generateContent만 흉내 내는 가짜 클라이언트. 실제 API는 호출하지 않는다.
function fakeClient(response: { text?: string; candidates?: { finishReason?: string }[] }) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    models: {
      generateContent: async (params: Record<string, unknown>) => {
        calls.push(params);
        return response;
      },
    },
  } as unknown as GeminiClient;
  return { client, calls };
}

const batch = [{ id: 7, word: 'address', sentence: 'We address the problem.' }];

describe('createGeminiMeaningModel', () => {
  it('asks Gemini 3.5 Flash-Lite for JSON at minimal thinking and maps the result', async () => {
    const { client, calls } = fakeClient({
      text: JSON.stringify({ meanings: [{ id: 7, meaning_ko: '다루다' }] }),
    });
    const result = await createGeminiMeaningModel(client)(batch);

    expect(result).toEqual([{ id: 7, meaningKo: '다루다' }]);
    expect(MEANING_MODEL_ID).toBe('gemini-3.5-flash-lite');
    expect(calls[0]).toMatchObject({
      model: 'gemini-3.5-flash-lite',
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: 'MINIMAL' },
        maxOutputTokens: 16384,
      },
    });
    expect(JSON.parse(calls[0].contents as string)).toEqual(batch);
  });

  it('throws on empty, malformed or off-schema responses', async () => {
    const blocked = fakeClient({ text: undefined, candidates: [{ finishReason: 'SAFETY' }] });
    await expect(createGeminiMeaningModel(blocked.client)(batch)).rejects.toThrow('SAFETY');
    const broken = fakeClient({ text: '{"meanings": [' });
    await expect(createGeminiMeaningModel(broken.client)(batch)).rejects.toThrow();
    const wrongShape = fakeClient({ text: JSON.stringify({ meanings: [{ id: 'x' }] }) });
    await expect(createGeminiMeaningModel(wrongShape.client)(batch)).rejects.toThrow();
  });
});
