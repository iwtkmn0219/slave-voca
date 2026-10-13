import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { createClaudeMeaningModel, MEANING_MODEL_ID } from '@/lib/meaning/claude';

// messages.parse만 흉내 내는 가짜 클라이언트. 실제 API는 호출하지 않는다.
function fakeClient(response: object) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    messages: {
      parse: async (params: Record<string, unknown>) => {
        calls.push(params);
        return response;
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

const batch = [{ id: 7, word: 'address', sentence: 'We address the problem.' }];

describe('createClaudeMeaningModel', () => {
  it('asks Haiku 5.5 at low effort and maps the parsed output', async () => {
    const { client, calls } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: { meanings: [{ id: 7, meaning_ko: '다루다' }] },
    });
    const result = await createClaudeMeaningModel(client)(batch);

    expect(result).toEqual([{ id: 7, meaningKo: '다루다' }]);
    expect(MEANING_MODEL_ID).toBe('claude-haiku-5-5');
    expect(calls[0]).toMatchObject({
      model: 'claude-haiku-5-5',
      output_config: { effort: 'low' },
    });
    expect(JSON.parse((calls[0].messages as { content: string }[])[0].content)).toEqual(batch);
  });

  it('throws on refusals and unparsable responses', async () => {
    const refused = fakeClient({ stop_reason: 'refusal', parsed_output: null });
    await expect(createClaudeMeaningModel(refused.client)(batch)).rejects.toThrow('거절');
    const cut = fakeClient({ stop_reason: 'max_tokens', parsed_output: null });
    await expect(createClaudeMeaningModel(cut.client)(batch)).rejects.toThrow('max_tokens');
  });
});
