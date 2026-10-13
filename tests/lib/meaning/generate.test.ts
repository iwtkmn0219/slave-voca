import { describe, expect, it } from 'vitest';
import {
  generateMeanings,
  MEANING_BATCH_SIZE,
  type MeaningModel,
  type MeaningRequest,
} from '@/lib/meaning/generate';

const requests = (n: number): MeaningRequest[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, word: `w${i + 1}`, sentence: 's.' }));

const echoModel: MeaningModel = async (batch) =>
  batch.map((r) => ({ id: r.id, meaningKo: `뜻${r.id}` }));

describe('generateMeanings', () => {
  it('sends batches of 50 and collects every meaning', async () => {
    const sizes: number[] = [];
    const model: MeaningModel = async (batch) => {
      sizes.push(batch.length);
      return echoModel(batch);
    };
    const outcome = await generateMeanings(requests(120), model);
    expect(MEANING_BATCH_SIZE).toBe(50);
    expect(sizes).toEqual([50, 50, 20]);
    expect(outcome.done).toHaveLength(120);
    expect(outcome.failedIds).toEqual([]);
  });

  it('fails ids that are missing, blank, or not part of the batch', async () => {
    const model: MeaningModel = async () => [
      { id: 1, meaningKo: ' 견고한 ' },
      { id: 2, meaningKo: '   ' },
      { id: 99, meaningKo: '엉뚱한' },
    ];
    const outcome = await generateMeanings(requests(3), model);
    expect(outcome.done).toEqual([{ id: 1, meaningKo: '견고한' }]);
    expect(outcome.failedIds).toEqual([2, 3]);
  });

  it('fails only the batch whose request threw', async () => {
    let call = 0;
    const model: MeaningModel = async (batch) => {
      call++;
      if (call === 1) throw new Error('rate limited');
      return echoModel(batch);
    };
    const outcome = await generateMeanings(requests(60), model);
    expect(outcome.failedIds).toHaveLength(50);
    expect(outcome.done.map((d) => d.id)).toEqual(Array.from({ length: 10 }, (_, i) => 51 + i));
  });

  it('does nothing for an empty request list', async () => {
    expect(await generateMeanings([], echoModel)).toEqual({ done: [], failedIds: [] });
  });
});
