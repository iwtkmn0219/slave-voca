// 입력칸에 글을 쓰는 중이면 한 글자 단축키를 끈다(제안서 6장).
// 체크박스·라디오·버튼은 글을 쓰는 곳이 아니므로 단축키를 막지 않는다.
export interface KeyTarget {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
}

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset']);

export function isTypingTarget(target: KeyTarget | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((target.type ?? 'text').toLowerCase());
  return tag === 'TEXTAREA' || tag === 'SELECT';
}

// 마우스로 눌러도 포커스를 가져가지 않게 한다(Tab 포커스는 그대로). 발음 버튼·필터 칩을 클릭한 뒤
// Space·Enter가 그 버튼을 다시 누르지 않고 화면 단축키(뒷면 보기, 행 체크)로 가게 하려는 것이다.
export const keepFocus = (e: { preventDefault(): void }) => e.preventDefault();

// Space로 체크박스·버튼을 누르는 브라우저 기본 동작과 겹치지 않게, 그 위에서는 Space 단축키를 쓰지 않는다.
export function isNativeSpaceTarget(target: KeyTarget | null): boolean {
  const tag = target?.tagName?.toUpperCase();
  if (tag === 'BUTTON') return true;
  return tag === 'INPUT' && NON_TEXT_INPUTS.has((target?.type ?? '').toLowerCase());
}
