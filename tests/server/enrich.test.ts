import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { words } from '@/server/db/schema';
import { listOccurrencesByDocument, saveReviewSelection } from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, getDocument, updateDocumentStatus } from '@/server/repo/documents';
import { enrichDocument, type EnrichDeps } from '@/server/services/enrich';

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

function savedDocument(lemmas: string[]) {
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
  const ids = listCandidates(db, doc.id).map((c) => c.id);
  return { doc, saved: saveReviewSelection(db, doc.id, ids) };
}

const deps = (overrides: Partial<EnrichDeps> = {}): EnrichDeps => ({
  meaningModel: async (batch) => batch.map((r) => ({ id: r.id, meaningKo: `${r.word}의 뜻` })),
  lookupPhonetic: async (word) => (word === 'robust' ? '/rəʊˈbʌst/' : null),
  ...overrides,
});

describe('enrichDocument', () => {
  it('fills meanings and phonetics, then marks the document done', async () => {
    const { doc, saved } = savedDocument(['robust', 'paradigm']);
    await enrichDocument(db, doc.id, saved, deps());

    expect(listOccurrencesByDocument(db, doc.id)).toMatchObject([
      { lemma: 'paradigm', meaningKo: 'paradigm의 뜻', meaningStatus: 'done', phonetic: null },
      { lemma: 'robust', meaningKo: 'robust의 뜻', meaningStatus: 'done', phonetic: '/rəʊˈbʌst/' },
    ]);
    expect(getDocument(db, doc.id)?.status).toBe('done');
  });

  it('marks every meaning failed when there is no API key', async () => {
    const { doc, saved } = savedDocument(['robust']);
    await enrichDocument(db, doc.id, saved, deps({ meaningModel: null }));

    expect(listOccurrencesByDocument(db, doc.id)[0]).toMatchObject({
      meaningStatus: 'failed',
      phonetic: '/rəʊˈbʌst/',
    });
    expect(getDocument(db, doc.id)?.status).toBe('done');
  });

  it('skips phonetic lookups for words that already have one', async () => {
    db.insert(words).values({ lemma: 'robust', phonetic: '/old/' }).run();
    const { doc, saved } = savedDocument(['robust']);
    const looked: string[] = [];
    await enrichDocument(
      db,
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
    expect(listOccurrencesByDocument(db, doc.id)[0].phonetic).toBe('/old/');
  });
});
