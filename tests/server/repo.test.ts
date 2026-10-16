import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, USER } from '../helpers/users';
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
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '@/server/repo/settings';
import { listKnownLemmas, listWordLemmas } from '@/server/repo/vocabulary';

const candidate = (lemma: string, count: number) => ({
  lemma,
  surface: lemma,
  sentence: `A ${lemma} here.`,
  count,
  isExisting: false,
  inDictionary: true,
});

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  addUser(db);
});

describe('documents repo', () => {
  it('creates a document in the extracting state and updates its status', () => {
    const doc = createDocument(db, USER, { title: 'Paper', kind: 'paper' });
    expect(doc.status).toBe('extracting');
    updateDocumentStatus(db, doc.id, 'error', 'broken');
    expect(getDocument(db, USER, doc.id)).toMatchObject({ status: 'error', errorMessage: 'broken' });
  });

  it('lists the newest document first', () => {
    const first = createDocument(db, USER, { title: 'A', kind: 'paper' });
    const second = createDocument(db, USER, { title: 'B', kind: 'presentation' });
    expect(listDocuments(db, USER).map((d) => d.id)).toEqual([second.id, first.id]);
  });
});

describe('candidates repo', () => {
  it('replaces candidates and lists them by count, then lemma', () => {
    const doc = createDocument(db, USER, { title: 'A', kind: 'paper' });
    replaceCandidates(db, doc.id, [candidate('old', 1)]);
    replaceCandidates(db, doc.id, [
      candidate('beta', 1),
      candidate('alpha', 1),
      candidate('zeta', 3),
    ]);
    expect(listCandidates(db, USER, doc.id).map((c) => c.lemma)).toEqual(['zeta', 'alpha', 'beta']);
  });

  it('stores more candidates than one INSERT can bind', () => {
    // 한 행에 변수 6개라 SQLite 상한(32766)으로는 5461행까지만 한 번에 넣을 수 있다.
    const doc = createDocument(db, USER, { title: 'Thesis', kind: 'paper' });
    const many = Array.from({ length: 6000 }, (_, i) =>
      candidate(`word${String(i).padStart(4, '0')}`, i % 3),
    );
    replaceCandidates(db, doc.id, many);
    const stored = listCandidates(db, USER, doc.id);
    expect(stored).toHaveLength(6000);
    expect(stored[0]).toMatchObject({ lemma: 'word0002', count: 2 });
    expect(stored.at(-1)).toMatchObject({ lemma: 'word5997', count: 0 });
  });

  it('counts candidates per document', () => {
    const a = createDocument(db, USER, { title: 'A', kind: 'paper' });
    const b = createDocument(db, USER, { title: 'B', kind: 'paper' });
    replaceCandidates(db, a.id, [candidate('xenon', 1), candidate('xylem', 1)]);
    replaceCandidates(db, b.id, []);
    const counts = countCandidatesByDocument(db, USER);
    expect(counts.get(a.id)).toBe(2);
    expect(counts.get(b.id)).toBeUndefined();
  });
});

describe('settings repo', () => {
  it('returns defaults when nothing is stored', () => {
    expect(getSettings(db, USER)).toEqual(DEFAULT_SETTINGS);
  });

  it('reads an empty stored number as the default, not as 0', () => {
    db.insert(settings).values({ userId: USER, key: 'daily_new_limit', value: '' }).run();
    expect(getSettings(db, USER).dailyNewLimit).toBe(20);
  });

  it('reads stored values and ignores invalid ones', () => {
    db.insert(settings)
      .values([
        { userId: USER, key: 'exclude_top_n', value: '3000' },
        { userId: USER, key: 'daily_new_limit', value: 'abc' },
      ])
      .run();
    expect(getSettings(db, USER)).toEqual({ excludeTopN: 3000, dailyNewLimit: 20, autoSpeak: false });
  });

  it('accepts a daily new limit of 0 and falls back for values out of range', () => {
    db.insert(settings)
      .values([
        { userId: USER, key: 'exclude_top_n', value: '999' },
        { userId: USER, key: 'daily_new_limit', value: '0' },
        { userId: USER, key: 'auto_speak', value: 'yes' },
      ])
      .run();
    expect(getSettings(db, USER)).toEqual({ excludeTopN: 3000, dailyNewLimit: 0, autoSpeak: false });
  });

  it('saves all settings and overwrites earlier values', () => {
    saveSettings(db, USER, { excludeTopN: 8000, dailyNewLimit: 0, autoSpeak: true });
    saveSettings(db, USER, { excludeTopN: 9000, dailyNewLimit: 5, autoSpeak: true });
    expect(getSettings(db, USER)).toEqual({ excludeTopN: 9000, dailyNewLimit: 5, autoSpeak: true });
    expect(db.select().from(settings).all()).toHaveLength(3);
  });
});

describe('vocabulary repo', () => {
  it('lists known lemmas and existing card lemmas', () => {
    db.insert(knownWords).values({ userId: USER, lemma: 'robust' }).run();
    db.insert(words).values({ userId: USER, lemma: 'paradigm' }).run();
    expect(listKnownLemmas(db, USER)).toEqual(new Set(['robust']));
    expect(listWordLemmas(db, USER)).toEqual(new Set(['paradigm']));
  });
});
