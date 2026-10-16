import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, USER } from '../helpers/users';
import { createDb, type Db } from '@/server/db/client';
import { words } from '@/server/db/schema';
import { listOccurrencesByDocument, saveReviewSelection } from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, getDocument, updateDocumentStatus } from '@/server/repo/documents';
import { enrichDocument, type EnrichDeps } from '@/server/services/enrich';

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  addUser(db);
});

function savedDocument(lemmas: string[]) {
  const doc = createDocument(db, USER, { title: 'Paper', kind: 'paper' });
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
  const ids = listCandidates(db, USER, doc.id).map((c) => c.id);
  return { doc, saved: saveReviewSelection(db, USER, doc.id, ids) };
}

const deps = (overrides: Partial<EnrichDeps> = {}): EnrichDeps => ({
  meaningModel: async (batch) => batch.map((r) => ({ id: r.id, meaningKo: `${r.word}의 뜻` })),
  lookupPhonetic: async (word) => (word === 'robust' ? '/rəʊˈbʌst/' : null),
  ...overrides,
});

describe('enrichDocument', () => {
  it('fills meanings and phonetics, then marks the document done', async () => {
    const { doc, saved } = savedDocument(['robust', 'paradigm']);
    await enrichDocument(db, USER, doc.id, saved, deps());

    expect(listOccurrencesByDocument(db, USER, doc.id)).toMatchObject([
      { lemma: 'paradigm', meaningKo: 'paradigm의 뜻', meaningStatus: 'done', phonetic: null },
      { lemma: 'robust', meaningKo: 'robust의 뜻', meaningStatus: 'done', phonetic: '/rəʊˈbʌst/' },
    ]);
    expect(getDocument(db, USER, doc.id)?.status).toBe('done');
  });

  it('marks every meaning failed when there is no API key', async () => {
    const { doc, saved } = savedDocument(['robust']);
    await enrichDocument(db, USER, doc.id, saved, deps({ meaningModel: null }));

    expect(listOccurrencesByDocument(db, USER, doc.id)[0]).toMatchObject({
      meaningStatus: 'failed',
      phonetic: '/rəʊˈbʌst/',
    });
    expect(getDocument(db, USER, doc.id)?.status).toBe('done');
  });

  it('marks the document error and pending meanings failed when enrichment throws', async () => {
    const { doc, saved } = savedDocument(['robust', 'paradigm']);
    // 모델 함수 밖에서 예외가 나는 경우(잘못된 응답 모양): 뜻은 pending으로 남아 있다.
    const broken = deps({
      meaningModel: async (batch) => batch.map((r) => ({ id: r.id }) as { id: number; meaningKo: string }),
    });
    await enrichDocument(db, USER, doc.id, saved, broken);

    expect(getDocument(db, USER, doc.id)).toMatchObject({
      status: 'error',
      errorMessage: '뜻과 발음을 채우지 못했습니다.',
    });
    const rows = listOccurrencesByDocument(db, USER, doc.id);
    expect(rows.map((r) => r.meaningStatus)).toEqual(['failed', 'failed']);
    expect(db.select().from(words).all()).toHaveLength(2); // 저장된 카드는 그대로 둔다
  });

  it('keeps meanings that were done when only the phonetic step throws', async () => {
    const { doc, saved } = savedDocument(['robust']);
    await enrichDocument(
      db,
      USER,
      doc.id,
      saved,
      deps({
        lookupPhonetic: async () => {
          throw new Error('boom');
        },
      }),
    );

    expect(getDocument(db, USER, doc.id)?.status).toBe('error');
    expect(listOccurrencesByDocument(db, USER, doc.id)[0].meaningStatus).toBe('done');
  });

  it('skips phonetic lookups for words that already have one', async () => {
    db.insert(words).values({ userId: USER, lemma: 'robust', phonetic: '/old/' }).run();
    const { doc, saved } = savedDocument(['robust']);
    const looked: string[] = [];
    await enrichDocument(
      db,
      USER,
      doc.id,
      saved,
      deps({
        lookupPhonetic: async (w) => {
          looked.push(w);
          return '/new/';
        },
      }),
    );
    expect(looked).toEqual([]);
    expect(listOccurrencesByDocument(db, USER, doc.id)[0].phonetic).toBe('/old/');
  });
});
