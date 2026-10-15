import { describe, expect, it } from 'vitest';
import { formatInterval, previewIntervals } from '@/lib/srs/interval';
import { applyAnswer, type SrsState } from '@/lib/srs/scheduler';

const now = new Date('2026-10-15T10:00:00Z');
const fresh: SrsState = {
  due: new Date(0),
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  learningSteps: 0,
  reps: 0,
  lapses: 0,
  state: 0,
  lastReview: null,
};

describe('previewIntervals', () => {
  it('matches what applyAnswer would schedule for each answer', () => {
    const preview = previewIntervals(fresh, now);
    for (const answer of ['again', 'hard', 'good'] as const) {
      expect(preview[answer]).toBe(applyAnswer(fresh, answer, now).due.getTime() - now.getTime());
    }
    expect(preview.again).toBeLessThanOrEqual(preview.hard);
    expect(preview.hard).toBeLessThanOrEqual(preview.good);
  });

  it('does not change the card it previews', () => {
    const copy = { ...fresh };
    previewIntervals(fresh, now);
    expect(fresh).toEqual(copy);
  });
});

describe('formatInterval', () => {
  it('uses the largest whole unit', () => {
    expect(formatInterval(0)).toBe('1분');
    expect(formatInterval(10 * 60_000)).toBe('10분');
    expect(formatInterval(3 * 3_600_000)).toBe('3시간');
    expect(formatInterval(86_400_000)).toBe('1일');
    expect(formatInterval(45 * 86_400_000)).toBe('2개월');
    expect(formatInterval(800 * 86_400_000)).toBe('2년');
  });
});
