import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';
import type { MeaningModel, TokenUsage } from './generate';

export const MEANING_MODEL_ID = 'gemini-3.5-flash-lite';

// 2026-10-16 실측(attention 200개 묶음)에서 기존 지시보다 문맥 오답이 적었던 B1 지시. 예시(few-shot)는
// 특정 단어 해석을 한쪽으로 끌고 가는 부작용이 있어 넣지 않는다.
const SYSTEM_INSTRUCTION = [
  '너는 영어 학술 논문·발표 자료를 읽는 한국인 연구자를 돕는다.',
  '각 항목의 word가 sentence 안에서 쓰인 의미를 한국어로 짧게(2~15자) 답한다.',
  '규칙:',
  '1. 사전의 첫 뜻이 아니라 그 문장 속 의미를 쓴다.',
  '2. 학술 논문 문맥이다. 한국어 학술 글에서 관용적으로 쓰는 전문 용어가 있으면 그것을 쓴다. 일상어 뜻을 쓰지 않는다.',
  '3. word가 여러 단어로 된 용어나 굳은 표현(연어)의 일부이면, 그 표현 전체가 뜻하는 바를 기준으로 답한다.',
  '4. 품사에 맞게 쓴다(동사는 "~하다", 형용사는 "~한"). 명사가 형용사처럼 앞 단어를 꾸미면 그 용어 안의 뜻으로 쓴다.',
  '5. 모든 id에 하나씩 답한다.',
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

// 한글 낱자모: 첫가끝 자모(U+1100–11FF)와 호환 자모(U+3130–318F). 정상 뜻은 완성형 음절로 온다.
// 2026-10-16 실측에서 200개 묶음 응답이 통째로 낱자모로 깨져 온 일이 있었다(예: "머커뉴ᄆ").
const LOOSE_JAMO = /[ᄀ-ᇿ㄰-㆏]/;

// 응답 형식은 맞지만 뜻 글자가 깨진 경우. generate.ts의 재시도 판정이 이름으로 알아보고 다시 요청한다.
export class GarbledOutputError extends Error {
  constructor(readonly garbledCount: number) {
    super(`뜻 글자가 깨져 왔습니다: ${garbledCount}개`);
    this.name = 'GarbledOutputError';
  }
}

// Gemini 3.5 Flash-Lite로 문맥 뜻을 만든다. 키는 GEMINI_API_KEY에서 읽는다(서버 전용).
export function createGeminiMeaningModel(
  client: GeminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
): MeaningModel {
  return async (batch, onUsage) => {
    const response = await client.models.generateContent({
      model: MEANING_MODEL_ID,
      contents: JSON.stringify(batch.map((r) => ({ id: r.id, word: r.word, sentence: r.sentence }))),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
        // 2026-10-16 실측(M4-4): LOW가 MINIMAL보다 문맥 오답이 적었고 비용은 같았다(사고 토큰은 출력 요금에 포함).
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        // 묶음 50개의 출력은 약 1,500토큰이지만, 200개 묶음(약 5,500토큰)에 맞춘 여유를 그대로 둔다. 과금은 실제 출력량만큼이다.
        maxOutputTokens: 16384,
      },
    });
    onUsage?.(tokenUsage(response.usageMetadata));
    const text = response.text;
    if (!text) {
      const reason = response.candidates?.[0]?.finishReason ?? 'unknown';
      throw new Error(`응답이 비었습니다: ${reason}`);
    }
    const parsed = OutputSchema.parse(JSON.parse(text));
    // 분해형(NFD)으로 온 정상 음절은 완성형으로 합쳐 두고, 그래도 남는 낱자모만 깨진 것으로 본다.
    const meanings = parsed.meanings.map((m) => ({ id: m.id, meaningKo: m.meaning_ko.normalize('NFC') }));
    const garbled = meanings.filter((m) => LOOSE_JAMO.test(m.meaningKo)).length;
    if (garbled > 0) throw new GarbledOutputError(garbled);
    return meanings;
  };
}

// 응답의 usageMetadata를 과금 단위로 바꾼다. 사고 토큰은 출력 요금으로 매겨진다(2026-10-17 공식 요금표).
// 값이 빠진 응답은 0으로 센다.
export function tokenUsage(
  meta: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined,
): TokenUsage {
  return {
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
  };
}
