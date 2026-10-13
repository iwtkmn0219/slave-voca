import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { MeaningModel } from './generate';

export const MEANING_MODEL_ID = 'claude-haiku-5-5';

const SYSTEM_PROMPT = [
  '너는 영어 논문·발표 자료를 읽는 한국인 학습자를 돕는다.',
  '각 항목의 word가 sentence 안에서 쓰인 의미를 한국어로 짧게(2~15자) 답한다.',
  '사전의 첫 뜻이 아니라 그 문장 속 의미를 쓰고, 품사에 맞게 쓴다(동사는 "~하다", 형용사는 "~한").',
  '모든 id에 하나씩 답한다.',
].join('\n');

const OutputSchema = z.object({
  meanings: z.array(z.object({ id: z.number().int(), meaning_ko: z.string() })),
});

// Claude Haiku 5.5로 문맥 뜻을 만든다. 키는 ANTHROPIC_API_KEY에서 읽는다(서버 전용).
export function createClaudeMeaningModel(client: Anthropic = new Anthropic()): MeaningModel {
  return async (batch) => {
    const response = await client.messages.parse({
      model: MEANING_MODEL_ID,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(batch.map((r) => ({ id: r.id, word: r.word, sentence: r.sentence }))),
        },
      ],
      output_config: { effort: 'low', format: zodOutputFormat(OutputSchema) },
    });
    if (response.stop_reason === 'refusal') throw new Error('모델이 요청을 거절했습니다.');
    if (!response.parsed_output) throw new Error(`응답을 해석하지 못했습니다: ${response.stop_reason}`);
    return response.parsed_output.meanings.map((m) => ({ id: m.id, meaningKo: m.meaning_ko }));
  };
}
