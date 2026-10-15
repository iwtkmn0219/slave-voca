import { describe, expect, it } from 'vitest';
import { cutAround, shortSentence } from '@/lib/text/truncate';

const words = (n: number, w: string) => Array.from({ length: n }, () => w).join(' ');

describe("cutAround", () => {
  it('cuts at the nearest spaces around the word and stays within max', () => {
    const sentence = `${words(40, 'alpha')} TARGET ${words(40, 'omega')}`;
    const index = sentence.indexOf('TARGET');
    const cut = cutAround(sentence, index, 6, 60);
    expect(cut.length).toBeLessThanOrEqual(60);
    expect(cut).toMatch(/^…alpha /);
    expect(cut).toMatch(/ omega…$/);
    expect(cut).toContain('TARGET');
  });

  it('never cuts the word itself, even when max is close to its length', () => {
    const sentence = `${words(10, 'alpha')} TARGETWORD ${words(10, 'omega')}`;
    const cut = cutAround(sentence, sentence.indexOf('TARGETWORD'), 10, 11);
    expect(cut).toContain('TARGETWORD');
  });

  it('keeps the start when the word is near the beginning', () => {
    const sentence = `We TARGET ${words(40, 'omega')}`;
    const cut = cutAround(sentence, 3, 6, 50);
    expect(cut.startsWith('We TARGET')).toBe(true);
    expect(cut.endsWith('omega…')).toBe(true);
  });
});

describe('shortSentence', () => {
  it('leaves sentences within 140 characters as they are', () => {
    expect(shortSentence('A short sentence with a word.', 'word')).toBe('A short sentence with a word.');
  });

  it('keeps the first match that the highlight marks', () => {
    const sentence = `${words(30, 'lead')} Ablation here. ${words(30, 'tail')} ablation again.`;
    const cut = shortSentence(sentence, 'ablation');
    expect(cut.length).toBeLessThanOrEqual(140);
    expect(cut).toContain('Ablation here.');
    expect(cut).not.toContain('ablation again');
  });
});
