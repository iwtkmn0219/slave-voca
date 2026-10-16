import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addUser, OTHER, USER } from '../helpers/users';
import { createDb, type Db } from '@/server/db/client';
import { knownWords, meaningUsage, users, words } from '@/server/db/schema';
import { listOccurrencesByDocument, markMeaningsFailed, saveReviewSelection } from '@/server/repo/cards';
import { listCandidates, replaceCandidates } from '@/server/repo/candidates';
import { createDocument, getDocument, updateDocumentStatus } from '@/server/repo/documents';
import { monthlySpendUsd, monthlyWordsByUser, monthlyWordsOf, reserveUsage } from '@/server/repo/usage';
import { regenerateMeanings, type EnrichDeps } from '@/server/services/enrich';
import { reserveMeaningUsage, UsageLimitError } from '@/server/services/meaning-usage';
import { saveReviewAndEnrich } from '@/server/services/save-review';
import { regenerateUsageMeaning } from '@/server/services/usage-meaning';
import type { MeaningModel } from '@/lib/meaning/generate';
import { LIMIT_SLOT } from '@/lib/regen-messages';

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  addUser(db);
  addUser(db, OTHER);
  vi.stubEnv('ALERT_WEBHOOK_URL', '');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const NOW = new Date('2026-10-17T03:00:00Z');
const LIMITS = { monthlyWords: 10, monthlyBudgetUsd: 5 };

// 응답마다 입력 100, 출력 40토큰을 쓰는 가짜 모델.
const model: MeaningModel = async (batch, onUsage) => {
  onUsage?.({ inputTokens: 100, outputTokens: 40 });
  return batch.map((r) => ({ id: r.id, meaningKo: `${r.word}의 뜻` }));
};
const deps = (meaningModel: MeaningModel | null = model): EnrichDeps => ({
  meaningModel,
  lookupPhonetic: async () => null,
});

function reviewingDocument(userId: string, lemmas: string[]) {
  const doc = createDocument(db, userId, { title: 'Paper', kind: 'paper' });
  replaceCandidates(
    db,
    doc.id,
    lemmas.map((lemma) => ({ lemma, surface: lemma, sentence: `The ${lemma} matters.`, count: 1, isExisting: false, inDictionary: true })),
  );
  updateDocumentStatus(db, doc.id, 'reviewing');
  return { doc, ids: listCandidates(db, userId, doc.id).map((c) => c.id) };
}

describe('reserveUsage', () => {
  it('counts words per user within the Korean month and holds the reservation', () => {
    expect(reserveUsage(db, USER, 'save', 6, NOW, LIMITS)).toMatchObject({ ok: true });
    // 맡아 둔 6단어가 이미 들어 있어 5단어는 넘친다.
    expect(reserveUsage(db, USER, 'save', 5, NOW, LIMITS)).toEqual({ ok: false, reason: 'user-limit' });
    expect(reserveUsage(db, USER, 'save', 4, NOW, LIMITS)).toMatchObject({ ok: true });
    // 다른 사람과 다음 달은 따로 센다.
    expect(reserveUsage(db, OTHER, 'save', 10, NOW, LIMITS)).toMatchObject({ ok: true });
    expect(reserveUsage(db, USER, 'save', 10, new Date('2026-10-31T15:00:00Z'), LIMITS)).toMatchObject({ ok: true });
    expect(monthlyWordsOf(db, USER, NOW)).toBe(10);
    expect(monthlyWordsByUser(db, NOW)).toEqual(new Map([[USER, 10], [OTHER, 10]]));
  });

  it('refuses when the estimated cost would pass the monthly budget', () => {
    const tight = { monthlyWords: 100_000, monthlyBudgetUsd: 0.001 }; // 단어당 예상 $0.0001 → 10단어까지
    expect(reserveUsage(db, USER, 'save', 10, NOW, tight)).toMatchObject({ ok: true });
    expect(reserveUsage(db, OTHER, 'save', 1, NOW, tight)).toEqual({ ok: false, reason: 'budget' });
  });
});

describe('reserveMeaningUsage', () => {
  it('settles the reservation with the real token cost', () => {
    const meter = reserveMeaningUsage(db, USER, 'save', 3, { now: NOW, limits: LIMITS });
    meter.onUsage({ inputTokens: 1_000_000, outputTokens: 0 });
    meter.onUsage({ inputTokens: 0, outputTokens: 1_000_000 });
    meter.finish();
    meter.finish(); // 두 번 불러도 한 번만 정산한다
    expect(db.select().from(meaningUsage).all()).toMatchObject([
      { userId: USER, source: 'save', words: 3, inputTokens: 1_000_000, outputTokens: 1_000_000, costUsd: 2.8, settled: true },
    ]);
    expect(monthlySpendUsd(db, NOW)).toBeCloseTo(2.8);
  });

  it('keeps the cost when the user is deleted', () => {
    reserveMeaningUsage(db, OTHER, 'save', 3, { now: NOW, limits: LIMITS }).finish();
    db.delete(users).where(eq(users.id, OTHER)).run();
    expect(db.select().from(meaningUsage).all()).toMatchObject([{ userId: null, words: 3 }]);
  });

  it('throws UsageLimitError with the reset day, without writing anything', () => {
    expect(() => reserveMeaningUsage(db, USER, 'save', 11, { now: NOW, limits: LIMITS })).toThrow(UsageLimitError);
    try {
      reserveMeaningUsage(db, USER, 'save', 11, { now: NOW, limits: LIMITS });
    } catch (err) {
      expect(err).toMatchObject({ reason: 'user-limit', resetsOn: '11월 1일' });
    }
    expect(db.select().from(meaningUsage).all()).toEqual([]);
  });
});

describe('saveReviewAndEnrich', () => {
  it('saves, counts one word per saved usage and records the tokens', async () => {
    const { doc, ids } = reviewingDocument(USER, ['robust', 'paradigm']);
    expect(await saveReviewAndEnrich(db, USER, doc.id, ids, deps())).toEqual({ error: null });
    expect(getDocument(db, USER, doc.id)?.status).toBe('done');
    expect(db.select().from(meaningUsage).all()).toMatchObject([
      { userId: USER, source: 'save', words: 2, inputTokens: 100, outputTokens: 40, settled: true },
    ]);
  });

  it('changes nothing when the save would pass the limit', async () => {
    vi.stubEnv('MONTHLY_WORD_LIMIT', '1');
    const { doc, ids } = reviewingDocument(USER, ['robust', 'paradigm']);
    const result = await saveReviewAndEnrich(db, USER, doc.id, ids.slice(0, 1).concat(ids.slice(1)), deps());
    expect(result).toEqual({ error: LIMIT_SLOT, limitResetsOn: expect.stringMatching(/^\d{1,2}월 1일$/) });
    expect(getDocument(db, USER, doc.id)?.status).toBe('reviewing');
    expect(listCandidates(db, USER, doc.id)).toHaveLength(2);
    expect(db.select().from(words).all()).toEqual([]);
    expect(db.select().from(knownWords).all()).toEqual([]);
    expect(db.select().from(meaningUsage).all()).toEqual([]);
  });

  it('counts only selected candidates (unselected ones become known words)', async () => {
    vi.stubEnv('MONTHLY_WORD_LIMIT', '1');
    const { doc, ids } = reviewingDocument(USER, ['robust', 'paradigm']);
    expect(await saveReviewAndEnrich(db, USER, doc.id, ids.slice(0, 1), deps())).toEqual({ error: null });
    expect(db.select().from(meaningUsage).all()).toMatchObject([{ words: 1 }]);
  });

  it('does not check or record usage without an API key', async () => {
    vi.stubEnv('MONTHLY_WORD_LIMIT', '0');
    const { doc, ids } = reviewingDocument(USER, ['robust']);
    expect(await saveReviewAndEnrich(db, USER, doc.id, ids, deps(null))).toEqual({ error: null });
    expect(db.select().from(meaningUsage).all()).toEqual([]);
  });

  it('counts a retried batch once but bills every response', async () => {
    let calls = 0;
    const flaky: MeaningModel = async (batch, onUsage) => {
      onUsage?.({ inputTokens: 100, outputTokens: 40 });
      if (calls++ === 0) throw Object.assign(new Error('busy'), { status: 503 });
      return batch.map((r) => ({ id: r.id, meaningKo: '뜻' }));
    };
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const { doc, ids } = reviewingDocument(USER, ['robust']);
    const pending = saveReviewAndEnrich(db, USER, doc.id, ids, deps(flaky));
    await vi.runAllTimersAsync();
    await pending;
    vi.useRealTimers();
    expect(db.select().from(meaningUsage).all()).toMatchObject([{ words: 1, inputTokens: 200, outputTokens: 80 }]);
  });
});

describe('regenerate entrances', () => {
  function failedUsages(lemmas: string[]) {
    const { doc, ids } = reviewingDocument(USER, lemmas);
    const saved = saveReviewSelection(db, USER, doc.id, ids);
    markMeaningsFailed(db, saved.occurrenceIds);
    return { doc, saved };
  }

  it('records regenerate and card sources', async () => {
    const { saved } = failedUsages(['robust', 'paradigm']);
    await regenerateMeanings(db, USER, saved.occurrenceIds, model);
    await regenerateUsageMeaning(db, USER, saved.occurrenceIds[0], model);
    expect(db.select({ source: meaningUsage.source, words: meaningUsage.words }).from(meaningUsage).all()).toEqual([
      { source: 'regenerate', words: 2 },
      { source: 'card', words: 1 },
    ]);
  });

  it('keeps the old meanings and reports usage-limit when over the limit', async () => {
    vi.stubEnv('MONTHLY_WORD_LIMIT', '1');
    const { doc, saved } = failedUsages(['robust', 'paradigm']);
    expect(await regenerateMeanings(db, USER, saved.occurrenceIds, model)).toMatchObject({ error: 'usage-limit' });
    expect(await regenerateUsageMeaning(db, USER, saved.occurrenceIds[0], model)).toEqual({ error: null, meaningKo: 'robust의 뜻', meaningStatus: 'done', failed: false });
    expect(await regenerateUsageMeaning(db, USER, saved.occurrenceIds[1], model)).toMatchObject({
      error: LIMIT_SLOT,
      limitResetsOn: expect.any(String),
    });
    expect(listOccurrencesByDocument(db, USER, doc.id).map((r) => r.meaningStatus)).toEqual(['failed', 'done']);
  });

  it('does not count ids that belong to someone else', async () => {
    const { saved } = failedUsages(['robust']);
    expect(await regenerateMeanings(db, OTHER, saved.occurrenceIds, model)).toEqual({ error: null, done: 0, failed: 0 });
    expect(db.select().from(meaningUsage).all()).toEqual([]);
  });
});
