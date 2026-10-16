import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addUser, USER } from '../helpers/users';
import { createDb, type Db } from '@/server/db/client';
import { meaningUsage } from '@/server/db/schema';
import { replaceCandidates, listCandidates } from '@/server/repo/candidates';
import { createDocument, getDocument, updateDocumentStatus } from '@/server/repo/documents';
import type { EnrichDeps } from '@/server/services/enrich';
import { saveReviewAndEnrich } from '@/server/services/save-review';
import type { MeaningModel } from '@/lib/meaning/generate';

// 맡아 둔 뒤 뜻 채우기가 시작도 못 하고 실패하는 경우(뜻 조회 예외)를 만들기 위해 listMeaningRequests만 바꾼다.
const failList = vi.hoisted(() => ({ on: false }));
vi.mock('@/server/repo/cards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/repo/cards')>();
  return {
    ...actual,
    listMeaningRequests: (...args: Parameters<typeof actual.listMeaningRequests>) => {
      if (failList.on) throw new Error('lookup failed');
      return actual.listMeaningRequests(...args);
    },
  };
});

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  addUser(db);
  failList.on = true;
  vi.stubEnv('ALERT_WEBHOOK_URL', '');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  failList.on = false;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('reservation settlement', () => {
  it('settles the reservation even when filling meanings fails before the model is called', async () => {
    const doc = createDocument(db, USER, { title: 'Paper', kind: 'paper' });
    replaceCandidates(db, doc.id, [
      { lemma: 'robust', surface: 'robust', sentence: 'The robust model.', count: 1, isExisting: false, inDictionary: true },
    ]);
    updateDocumentStatus(db, doc.id, 'reviewing');
    const ids = listCandidates(db, USER, doc.id).map((c) => c.id);
    const model: MeaningModel = async () => {
      throw new Error('model must not be called');
    };
    const deps: EnrichDeps = { meaningModel: model, lookupPhonetic: async () => null };

    expect(await saveReviewAndEnrich(db, USER, doc.id, ids, deps)).toEqual({ error: null });

    expect(getDocument(db, USER, doc.id)?.status).toBe('error');
    // 호출하지 않았으므로 토큰은 0이고 비용은 0으로 정산된다. 예상 비용이 예산을 계속 차지하면 안 된다.
    expect(db.select().from(meaningUsage).all()).toMatchObject([{ words: 1, inputTokens: 0, outputTokens: 0, costUsd: 0, settled: true }]);
  });
});
