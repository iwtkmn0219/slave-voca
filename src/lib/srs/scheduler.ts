import { fsrs, Rating, type Card, type Grade } from 'ts-fsrs';

export type Answer = 'again' | 'hard' | 'good';

export const ANSWERS: readonly Answer[] = ['again', 'hard', 'good'];

// 모름 → Again, 애매 → Hard, 앎 → Good (스펙 8.6)
export const ANSWER_GRADE: Record<Answer, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
};

export interface SrsState {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number; // ts-fsrs State: 0 New, 1 Learning, 2 Review, 3 Relearning
  lastReview: Date | null;
}

// ts-fsrs 기본 파라미터. 퍼즈(복습일 무작위 흔들기)는 꺼서 같은 응답이면 같은 일정이 나오게 한다.
const scheduler = fsrs({ enable_fuzz: false });

function toCard(s: SrsState): Card {
  return {
    due: s.due,
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    learning_steps: s.learningSteps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.lastReview ?? undefined,
  };
}

export function applyAnswer(current: SrsState, answer: Answer, now: Date): SrsState {
  const next = scheduler.next(toCard(current), now, ANSWER_GRADE[answer]).card;
  return {
    due: next.due,
    stability: next.stability,
    difficulty: next.difficulty,
    elapsedDays: next.elapsed_days,
    scheduledDays: next.scheduled_days,
    learningSteps: next.learning_steps,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    lastReview: next.last_review ?? now,
  };
}

// "오늘"은 서버 로컬 시간 자정부터다.
export function startOfLocalDay(now: Date): Date {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function newCardSlots(dailyNewLimit: number, introducedToday: number): number {
  return Math.max(0, dailyNewLimit - introducedToday);
}
