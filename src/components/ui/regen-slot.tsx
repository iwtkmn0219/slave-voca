import { MISSING_KEY_MESSAGE } from "@/lib/regen-messages";
import { keepFocus } from "@/lib/ui/keys";
import { Limited, Spinner } from "./status";

// 뜻 다시 만들기의 진행·결과. 뜻은 제자리에 흐리게 두고(높이가 변하지 않게) 상태는 버튼 자리에 보인다.
// limited: 이번 달 한도에 걸림(C-1). 다시 눌러도 같으므로 "다시 시도"를 두지 않는다.
export type RegenState =
  | { phase: "busy" }
  | { phase: "done" }
  | { phase: "failed"; text: string }
  | { phase: "limited"; text: string };

// 평소에는 점선 밑줄, 마우스·키보드 포커스에서 강조색 실선 밑줄.
export const regenButtonClass =
  "hit-44 tap text-muted underline decoration-dotted underline-offset-[3px] hover:text-accent hover:decoration-solid focus-visible:text-accent focus-visible:decoration-solid";

function RegenButton({ label, onClick, className }: { label: string; onClick: () => void; className: string }) {
  return (
    <button type="button" onMouseDown={keepFocus} onClick={onClick} className={className}>
      {label}
    </button>
  );
}

// state가 없으면 idle(평소 버튼들)을 그린다. 결과 문구는 호출한 쪽이 state를 지울 때까지 남는다.
export function RegenSlot({
  state,
  onRegenerate,
  idle,
  buttonClassName = regenButtonClass,
}: {
  state: RegenState | undefined;
  onRegenerate: () => void;
  idle: React.ReactNode;
  buttonClassName?: string;
}) {
  return (
    <span aria-live="polite" className="inline-flex flex-wrap items-center gap-x-1.5">
      {state === undefined ? (
        idle
      ) : state.phase === "busy" ? (
        <span className="inline-flex items-center gap-1.5 text-muted">
          <Spinner /> 다시 만드는 중
        </span>
      ) : state.phase === "limited" ? (
        <Limited>{state.text}</Limited>
      ) : state.phase === "done" ? (
        <>
          <span className="text-muted">새 뜻으로 바꿨습니다 ·</span>
          <RegenButton label="다시 만들기" onClick={onRegenerate} className={buttonClassName} />
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span aria-hidden className="w-2.5 border-t-2 border-dashed border-again" />
            <span>
              {state.text}
              {state.text !== MISSING_KEY_MESSAGE && " ·"}
            </span>
          </span>
          {/* 키가 없으면 다시 시도해도 같다 */}
          {state.text !== MISSING_KEY_MESSAGE && (
            <RegenButton label="다시 시도" onClick={onRegenerate} className={buttonClassName} />
          )}
        </>
      )}
    </span>
  );
}

export function RegenIdleButton({ onRegenerate, className = regenButtonClass }: { onRegenerate: () => void; className?: string }) {
  return <RegenButton label="뜻 다시 만들기" onClick={onRegenerate} className={className} />;
}
