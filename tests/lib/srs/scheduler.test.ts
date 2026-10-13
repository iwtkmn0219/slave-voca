import { describe, expect, it } from 'vitest';
import {
  ANSWER_GRADE,
  applyAnswer,
  newCardSlots,
  startOfLocalDay,
  type SrsState,
} from '@/lib/srs/scheduler';

const now = new Date('2026-10-13T10:00:00Z');
const MINUTE = 60_000;
const DAY = 86_400_000;

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

describe('applyAnswer', () => {
  it('maps answers to FSRS grades', () => {
    expect(ANSWER_GRADE).toEqual({ again: 1, hard: 2, good: 3 });
  });

  it('brings a forgotten new card back within minutes', () => {
    const next = applyAnswer(fresh, 'again', now);
    expect(next.state).toBe(1); // Learning
    expect(next.due.getTime() - now.getTime()).toBeLessThanOrEqual(10 * MINUTE);
    expect(next.reps).toBe(1);
    expect(next.lastReview).toEqual(now);
  });

  it('pushes a known card further out with each good answer', () => {
    let state = applyAnswer(fresh, 'good', now);
    state = applyAnswer(state, 'good', state.due);
    expect(state.state).toBe(2); // Review
    const firstGap = state.due.getTime() - state.lastReview!.getTime();
    const later = applyAnswer(state, 'good', state.due);
    const secondGap = later.due.getTime() - later.lastReview!.getTime();
    expect(firstGap).toBeGreaterThanOrEqual(DAY);
    expect(secondGap).toBeGreaterThan(firstGap);
  });

  it('is deterministic for the same input', () => {
    expect(applyAnswer(fresh, 'hard', now)).toEqual(applyAnswer(fresh, 'hard', now));
  });
});

describe('startOfLocalDay', () => {
  it('returns local midnight of the same day', () => {
    const start = startOfLocalDay(new Date(2026, 9, 13, 23, 59, 59));
    expect(start).toEqual(new Date(2026, 9, 13, 0, 0, 0, 0));
  });
});

describe('newCardSlots', () => {
  it('never goes below zero', () => {
    expect(newCardSlots(20, 0)).toBe(20);
    expect(newCardSlots(20, 15)).toBe(5);
    expect(newCardSlots(20, 25)).toBe(0);
  });
});
