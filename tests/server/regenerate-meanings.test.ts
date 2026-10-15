import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  listOccurrencesByDocument,
  markMeaningsFailed,
  saveReviewSelection,
  setMeanings,
} from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, updateDocumentStatus } from '@/server/repo/documents';
import { regenerateMeanings } from '@/server/services/enrich';
import type { MeaningModel } from '@/lib/meaning/generate';

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

function failedDocument(lemmas: string[]) {
  const doc = createDocument(db, { title: 'Paper', kind: 'paper' });
  replaceCandidates(
    db,
    doc.id,
    lemmas.map((lemma) => ({
      lemma,
      surface: lemma,
      sentence: `The ${lemma} matters.`,
      count: 1,
      isExisting: false,
      inDictionary: true,
    })),
  );
  updateDocumentStatus(db, doc.id, 'reviewing');
  const saved = saveReviewSelection(db, doc.id, listCandidates(db, doc.id).map((c) => c.id));
  markMeaningsFailed(db, saved.occurrenceIds);
  return { doc, saved };
}

describe('regenerateMeanings', () => {
  it('replaces an existing meaning with the new one', async () => {
    const { doc, saved } = failedDocument(['progression']);
    setMeanings(db, [{ id: saved.occurrenceIds[0], meaningKo: '진행' }]);
    const model: MeaningModel = async (batch) => batch.map((r) => ({ id: r.id, meaningKo: '수열' }));
    expect(await regenerateMeanings(db, saved.occurrenceIds, model)).toEqual({ error: null, done: 1, failed: 0 });
    expect(listOccurrencesByDocument(db, doc.id)[0]).toMatchObject({ meaningKo: '수열', meaningStatus: 'done' });
  });

  it('does not turn a meaning that another request stored meanwhile into failed', async () => {
    // 같은 용례를 두 요청(탭 두 개)이 다시 만들 때: 하나가 성공해 done이 된 뒤 늦게 끝난 요청이 실패해도 done을 지우지 않는다.
    const { doc, saved } = failedDocument(['progression']);
    const id = saved.occurrenceIds[0];
    const slowFailing: MeaningModel = async () => {
      setMeanings(db, [{ id, meaningKo: '수열' }]); // 다른 요청이 그 사이 성공
      throw new Error('503');
    };
    await regenerateMeanings(db, saved.occurrenceIds, slowFailing); // Error('503')에는 상태가 없어 재시도하지 않는다
    expect(listOccurrencesByDocument(db, doc.id)[0]).toMatchObject({ meaningKo: '수열', meaningStatus: 'done' });
  });

  it('keeps an existing meaning when regenerating it fails', async () => {
    const { doc, saved } = failedDocument(['progression']);
    setMeanings(db, [{ id: saved.occurrenceIds[0], meaningKo: '진행' }]);
    const model: MeaningModel = async () => [];
    expect(await regenerateMeanings(db, saved.occurrenceIds, model)).toEqual({ error: null, done: 0, failed: 1 });
    expect(listOccurrencesByDocument(db, doc.id)[0]).toMatchObject({ meaningKo: '진행', meaningStatus: 'done' });
  });

  it('fills the meanings it can and leaves the rest failed', async () => {
    const { doc, saved } = failedDocument(['robust', 'paradigm']);
    const model: MeaningModel = async (batch) =>
      batch.filter((r) => r.word === 'robust').map((r) => ({ id: r.id, meaningKo: '강건한' }));

    expect(await regenerateMeanings(db, saved.occurrenceIds, model)).toEqual({ error: null, done: 1, failed: 1 });
    expect(listOccurrencesByDocument(db, doc.id)).toMatchObject([
      { lemma: 'paradigm', meaningStatus: 'failed' },
      { lemma: 'robust', meaningStatus: 'done', meaningKo: '강건한' },
    ]);
  });

  it('changes nothing without an API key', async () => {
    const { doc, saved } = failedDocument(['robust']);
    expect(await regenerateMeanings(db, saved.occurrenceIds, null)).toEqual({ error: 'missing-key' });
    expect(listOccurrencesByDocument(db, doc.id)[0].meaningStatus).toBe('failed');
  });

  it('does nothing for an empty list', async () => {
    const model: MeaningModel = async () => {
      throw new Error('should not be called');
    };
    expect(await regenerateMeanings(db, [], model)).toEqual({ error: null, done: 0, failed: 0 });
  });
});
