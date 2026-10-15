import { describe, expect, it } from 'vitest';
import { isNativeSpaceTarget, isTypingTarget } from '@/lib/ui/keys';

describe('isTypingTarget', () => {
  it('detects text fields and editable content', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'number' })).toBe(true);
    expect(isTypingTarget({ tagName: 'textarea' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('lets shortcuts through elsewhere, including checkboxes', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget({ tagName: 'BODY' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('isNativeSpaceTarget', () => {
  it('is true where Space already clicks something', () => {
    expect(isNativeSpaceTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(true);
    expect(isNativeSpaceTarget({ tagName: 'BUTTON' })).toBe(true);
    expect(isNativeSpaceTarget({ tagName: 'BODY' })).toBe(false);
    expect(isNativeSpaceTarget({ tagName: 'INPUT', type: 'text' })).toBe(false);
    expect(isNativeSpaceTarget(null)).toBe(false);
  });
});
