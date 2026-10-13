# 문맥 뜻 모델 교체 (Claude → Gemini) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 문맥 뜻 생성 모델을 Claude Haiku 5.5에서 Gemini 2.5 Flash-Lite로 바꾼다. 화면, DB, 묶음 처리(`generate.ts`)는 그대로 둔다.

**Architecture:** M2의 `MeaningModel` 함수 형태를 그대로 쓴다. `src/lib/meaning/claude.ts`를 지우고, 같은 역할의 `src/lib/meaning/gemini.ts`를 만든다. 키 이름만 `ANTHROPIC_API_KEY`에서 `GEMINI_API_KEY`로 바뀐다.

**Tech Stack:** `@google/genai` 2.24.0 (오늘 나온 2.29.0이 아니라 3주 지난 버전으로 고정), `zod` 4.6.7(유지). `@anthropic-ai/sdk`는 제거한다.

**Spec:** `docs/superpowers/specs/2026-10-13-slave-voca-design.md` 8.4 (2026-10-13 개정)

## Global Constraints

- 작업 브랜치: `feat/gemini-meaning` (main에서 분기). 마일스톤 3 계획보다 먼저 끝내고 main에 병합한다.
- 모델 `gemini-2.5-flash-lite`, `thinkingConfig: { thinkingBudget: 0 }`, `responseMimeType: "application/json"` + `responseJsonSchema`. 응답은 zod로 다시 검증한다.
- 키는 `GEMINI_API_KEY`(`.env.local`), 서버에서만 읽는다. 키를 커밋하거나 로그·메시지에 남기지 않는다.
- 무료 등급 키는 입력이 Google 제품 개선에 쓰인다(공식 가격 페이지). 실제 확인은 공개 논문으로만 한다.
- 실제 API 호출은 Step 6(키가 있을 때)에서만 한다. 단위 테스트는 가짜 클라이언트를 쓴다.

## Review Focus

1. Gemini가 안전 필터 등으로 빈 응답을 돌려줌: 예외로 처리돼 그 묶음만 `failed`가 돼야 한다(`throws on empty, malformed or off-schema responses`).
2. JSON이 잘리거나 형식이 다름(`maxOutputTokens` 초과 등): 마찬가지로 묶음 실패로 처리하고, 앱이 멈추면 안 된다(같은 테스트).
3. 키 이름 변경: `.env.local`에 예전 `ANTHROPIC_API_KEY`만 있으면 키가 없는 것으로 보고 안내문이 `GEMINI_API_KEY`를 말해야 한다(Step 5 확인).
4. 사고 토큰: 2.5 Flash-Lite는 출력 가격에 사고 토큰이 포함된다. `thinkingBudget: 0`이 요청에 실려야 한다(첫 테스트가 확인).
5. 남은 흔적: `src`, `tests`, `package.json`에 `anthropic`·`claude`·`ANTHROPIC` 문자열이 남으면 안 된다(Step 4 grep).

---

### Task 1: Gemini 구현으로 교체

**Files:**
- Create: `src/lib/meaning/gemini.ts`, `tests/lib/meaning/gemini.test.ts`
- Delete: `src/lib/meaning/claude.ts`, `tests/lib/meaning/claude.test.ts`
- Modify: `src/server/services/enrich.ts`(import·키 2줄), `src/lib/meaning/generate.ts`(주석 1줄), `src/app/documents/[id]/page.tsx`(키 이름 2곳), `package.json`

**Interfaces:**
- Produces: `MEANING_MODEL_ID = 'gemini-2.5-flash-lite'`, `type GeminiClient = Pick<GoogleGenAI, 'models'>`, `createGeminiMeaningModel(client?: GeminiClient): MeaningModel`
- `MeaningModel`, `generateMeanings`, `EnrichDeps`의 형태는 바뀌지 않는다.

- [ ] **Step 1: 브랜치와 의존성**

```bash
git checkout main
git checkout -b feat/gemini-meaning
npm i --save-exact @google/genai@2.24.0
npm uninstall @anthropic-ai/sdk
```

- [ ] **Step 2: 실패하는 테스트 작성** — `tests/lib/meaning/gemini.test.ts` (그리고 `tests/lib/meaning/claude.test.ts`는 `git rm`)

```ts
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
  it('asks Gemini 2.5 Flash-Lite for JSON without thinking and maps the result', async () => {
    const { client, calls } = fakeClient({
      text: JSON.stringify({ meanings: [{ id: 7, meaning_ko: '다루다' }] }),
    });
    const result = await createGeminiMeaningModel(client)(batch);

    expect(result).toEqual([{ id: 7, meaningKo: '다루다' }]);
    expect(MEANING_MODEL_ID).toBe('gemini-2.5-flash-lite');
    expect(calls[0]).toMatchObject({
      model: 'gemini-2.5-flash-lite',
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
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
```

Run: `npx vitest run tests/lib/meaning`
Expected: FAIL — `@/lib/meaning/gemini`를 찾지 못함

- [ ] **Step 3: 구현** — `src/lib/meaning/gemini.ts` (그리고 `src/lib/meaning/claude.ts`는 `git rm`)

```ts
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { MeaningModel } from './generate';

export const MEANING_MODEL_ID = 'gemini-2.5-flash-lite';

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

// Gemini 2.5 Flash-Lite로 문맥 뜻을 만든다. 키는 GEMINI_API_KEY에서 읽는다(서버 전용).
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
        thinkingConfig: { thinkingBudget: 0 }, // 짧은 뜻 생성에는 사고 토큰이 필요 없다(비용 절감)
        maxOutputTokens: 8192,
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
```

`responseJsonSchema`는 손으로 쓴 단순한 JSON Schema다. `z.toJSONSchema()`가 만드는 `$schema`나 큰 정수 범위 같은 키워드는 Gemini가 지원하지 않을 수 있어서 쓰지 않는다.

- [ ] **Step 4: 호출부 교체**

`src/server/services/enrich.ts`:

```ts
import { createGeminiMeaningModel } from '@/lib/meaning/gemini';
```
```ts
    meaningModel: process.env.GEMINI_API_KEY ? createGeminiMeaningModel() : null,
```

`src/lib/meaning/generate.ts` 주석: `실제 구현은 claude.ts` → `실제 구현은 gemini.ts`

`src/app/documents/[id]/page.tsx`:

```tsx
  const missingKey = !process.env.GEMINI_API_KEY;
```
```tsx
            ? `GEMINI_API_KEY가 설정되지 않아 뜻 ${failed}개를 만들지 못했습니다. .env.local에 키를 넣고 서버를 다시 시작하세요.`
```

남은 흔적 확인 — 출력이 없어야 한다:

```bash
grep -rn "ANTHROPIC\|anthropic\|claude" src tests package.json
```

- [ ] **Step 5: 전체 확인**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 96 tests PASS(claude 테스트 2개가 빠지고 gemini 테스트 2개가 들어와 개수는 같다), 타입·린트 오류 0, 빌드 성공. 키 없이 `npm run dev`로 PDF 하나를 저장하면 단어 목록 안내문이 `GEMINI_API_KEY`를 말해야 한다.

- [ ] **Step 6: 실제 확인 (키가 있을 때만, 없으면 "보류")**

사용자가 키를 주면 `.env.local`에 `GEMINI_API_KEY=...`를 넣고 dev 서버를 다시 시작한다. M2 결과 문서(`docs/superpowers/notes/2026-10-13-m2-check.md`)의 "실제 뜻 생성" 표를 attention 논문으로 채우고, 모델 이름을 Gemini 2.5 Flash-Lite로 적는다. 비용은 Google AI Studio 사용량 화면에서 확인한다(무료 등급이면 "무료 등급"으로 적는다).

- [ ] **Step 7: 커밋, 리뷰, 병합**

```bash
git add -A
git commit -m "feat: switch contextual meanings from Claude Haiku 5.5 to Gemini 2.5 Flash-Lite"
```

CodeReviewer 리뷰 후 main에 로컬 병합(`--no-ff`)한다. main에서 test·typecheck·lint·build 결과와 병합 커밋 해시를 PM에게 보낸다.
