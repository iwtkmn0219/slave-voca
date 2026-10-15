import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';
import type { MeaningModel } from './generate';

export const MEANING_MODEL_ID = 'gemini-3.5-flash-lite';

const SYSTEM_INSTRUCTION = [
  '너는 영어 논문·발표 자료를 읽는 한국인 학습자를 돕는다.',
  '각 항목의 word가 sentence 안에서 쓰인 의미를 한국어로 짧게(2~15자) 답한다.',
  '사전의 첫 뜻이 아니라 그 문장 속 의미를 쓰고, 품사에 맞게 쓴다(동사는 "~하다", 형용사는 "~한").',
  '모든 id에 하나씩 답한다.',
].join('\n');

// Gemini 구조화 출력용 JSON Schema. 응답은 아래 zod 스키마로 한 번 더 검증한다.
const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    meanings: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, meaning_ko: { type: 'string' } },
        required: ['id', 'meaning_ko'],
      },
    },
  },
  required: ['meanings'],
};

const OutputSchema = z.object({
  meanings: z.array(z.object({ id: z.number().int(), meaning_ko: z.string() })),
});

export type GeminiClient = Pick<GoogleGenAI, 'models'>;

// Gemini 3.5 Flash-Lite로 문맥 뜻을 만든다. 키는 GEMINI_API_KEY에서 읽는다(서버 전용).
export function createGeminiMeaningModel(
  client: GeminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
): MeaningModel {
  return async (batch) => {
    const response = await client.models.generateContent({
      model: MEANING_MODEL_ID,
      contents: JSON.stringify(batch.map((r) => ({ id: r.id, word: r.word, sentence: r.sentence }))),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
        // 3.x는 사고를 끌 수 없다. 가장 낮은 MINIMAL로 사고 토큰(출력 요금에 포함)을 줄인다.
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        // 200개 묶음의 출력이 약 5,500토큰(실측)이라 여유를 둔다. 과금은 실제 출력량만큼이다.
        maxOutputTokens: 16384,
      },
    });
    const text = response.text;
    if (!text) {
      const reason = response.candidates?.[0]?.finishReason ?? 'unknown';
      throw new Error(`응답이 비었습니다: ${reason}`);
    }
    const parsed = OutputSchema.parse(JSON.parse(text));
    return parsed.meanings.map((m) => ({ id: m.id, meaningKo: m.meaning_ko }));
  };
}
