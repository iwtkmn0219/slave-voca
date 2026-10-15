import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { markMeaningsFailed, saveReviewSelection, setMeanings } from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, updateDocumentStatus } from '@/server/repo/documents';
import { regenerateUsageMeaning } from '@/server/services/usage-meaning';
import { MISSING_KEY_MESSAGE } from '@/lib/regen-messages';
import type { MeaningModel } from '@/lib/meaning/generate';

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

function oneUsage(): number {
  const doc = createDocument(db, { title: 'Paper', kind: 'paper' });
  replaceCandidates(db, doc.id, [
    { lemma: 'progression', surface: 'progression', sentence: 'A geometric progression.', count: 1, isExisting: false, inDictionary: true },
  ]);
  updateDocumentStatus(db, doc.id, 'reviewing');
  const saved = saveReviewSelection(db, doc.id, listCandidates(db, doc.id).map((c) => c.id));
  markMeaningsFailed(db, saved.occurrenceIds);
  return saved.occurrenceIds[0];
}

const model = (meaningKo: string): MeaningModel => async (batch) => batch.map((r) => ({ id: r.id, meaningKo }));

describe('regenerateUsageMeaning', () => {
  it('rejects ids that are not positive integers and ids that do not exist', async () => {
    expect(await regenerateUsageMeaning(db, '1', model('x'))).toEqual({ error: '잘못된 요청입니다.' });
    expect(await regenerateUsageMeaning(db, 0, model('x'))).toEqual({ error: '잘못된 요청입니다.' });
    expect(await regenerateUsageMeaning(db, 999, model('x'))).toEqual({ error: '용례를 찾을 수 없습니다.' });
  });

  it('stores and returns the new meaning', async () => {
    const id = oneUsage();
    expect(await regenerateUsageMeaning(db, id, model('수열'))).toEqual({
      error: null,
      meaningKo: '수열',
      meaningStatus: 'done',
      failed: false,
    });
  });

  it('keeps the old meaning and reports failed when regeneration fails', async () => {
    const id = oneUsage();
    setMeanings(db, [{ id, meaningKo: '진행' }]);
    const broken: MeaningModel = async () => {
      throw new Error('boom');
    };
    expect(await regenerateUsageMeaning(db, id, broken)).toEqual({
      error: null,
      meaningKo: '진행',
      meaningStatus: 'done',
      failed: true,
    });
  });

  it('changes nothing without an API key', async () => {
    const id = oneUsage();
    expect(await regenerateUsageMeaning(db, id, null)).toEqual({ error: MISSING_KEY_MESSAGE });
  });
});
