import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { knownWords, settings, words } from '@/server/db/schema';
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocumentStatus,
} from '@/server/repo/documents';
import {
  countCandidatesByDocument,
  listCandidates,
  replaceCandidates,
} from '@/server/repo/candidates';
import { DEFAULT_SETTINGS, getSettings } from '@/server/repo/settings';
import { listKnownLemmas, listWordLemmas } from '@/server/repo/vocabulary';

const candidate = (lemma: string, count: number) => ({
  lemma,
  surface: lemma,
  sentence: `A ${lemma} here.`,
  count,
  isExisting: false,
});

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

describe('documents repo', () => {
  it('creates a document in the extracting state and updates its status', () => {
    const doc = createDocument(db, { title: 'Paper', kind: 'paper' });
    expect(doc.status).toBe('extracting');
    updateDocumentStatus(db, doc.id, 'error', 'broken');
    expect(getDocument(db, doc.id)).toMatchObject({ status: 'error', errorMessage: 'broken' });
  });

  it('lists the newest document first', () => {
    const first = createDocument(db, { title: 'A', kind: 'paper' });
    const second = createDocument(db, { title: 'B', kind: 'presentation' });
    expect(listDocuments(db).map((d) => d.id)).toEqual([second.id, first.id]);
  });
});

describe('candidates repo', () => {
  it('replaces candidates and lists them by count, then lemma', () => {
    const doc = createDocument(db, { title: 'A', kind: 'paper' });
    replaceCandidates(db, doc.id, [candidate('old', 1)]);
    replaceCandidates(db, doc.id, [
      candidate('beta', 1),
      candidate('alpha', 1),
      candidate('zeta', 3),
    ]);
    expect(listCandidates(db, doc.id).map((c) => c.lemma)).toEqual(['zeta', 'alpha', 'beta']);
  });

  it('counts candidates per document', () => {
    const a = createDocument(db, { title: 'A', kind: 'paper' });
    const b = createDocument(db, { title: 'B', kind: 'paper' });
    replaceCandidates(db, a.id, [candidate('xenon', 1), candidate('xylem', 1)]);
    replaceCandidates(db, b.id, []);
    const counts = countCandidatesByDocument(db);
    expect(counts.get(a.id)).toBe(2);
    expect(counts.get(b.id)).toBeUndefined();
  });
});

describe('settings repo', () => {
  it('returns defaults when nothing is stored', () => {
    expect(getSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it('reads stored values and ignores invalid ones', () => {
    db.insert(settings)
      .values([
        { key: 'exclude_top_n', value: '3000' },
        { key: 'daily_new_limit', value: 'abc' },
      ])
      .run();
    expect(getSettings(db)).toEqual({ excludeTopN: 3000, dailyNewLimit: 20 });
  });
});

describe('vocabulary repo', () => {
  it('lists known lemmas and existing card lemmas', () => {
    db.insert(knownWords).values({ lemma: 'robust' }).run();
    db.insert(words).values({ lemma: 'paradigm' }).run();
    expect(listKnownLemmas(db)).toEqual(new Set(['robust']));
    expect(listWordLemmas(db)).toEqual(new Set(['paradigm']));
  });
});
