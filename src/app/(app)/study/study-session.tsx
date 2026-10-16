"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { Highlighted } from "@/components/ui/highlighted";
import { Kbd } from "@/components/ui/kbd";
import { RegenIdleButton, RegenSlot, type RegenState } from "@/components/ui/regen-slot";
import { LIMIT_CARD, REGEN_FAILED } from "@/lib/regen-messages";
import { Failed, Limited, Spinner } from "@/components/ui/status";
import { Tag } from "@/components/ui/tag";
import { formatInterval } from "@/lib/srs/interval";
import type { Answer } from "@/lib/srs/scheduler";
import { advanceQueue, withMeanings, type RegeneratedMeaning } from "@/lib/srs/session";
import { isNativeEnterTarget, isNativeSpaceTarget, isTypingTarget, keepFocus } from "@/lib/ui/keys";
import type { StudyCard, Usage } from "@/server/repo/study";
import type { RegenerateUsageResult } from "@/server/services/usage-meaning";
import { answerCard, undoLastAnswer } from "./actions";
import { SpeakButton, speak } from "./speak-button";

// active: 누르는 동안 바탕을 한 단계 진하게(휴대폰에는 마우스 올림이 없다. C 화면 규칙 7.6)
const ANSWER_BUTTONS: { answer: Answer; label: string; key: string; tone: string; text: string }[] = [
  {
    answer: "again",
    label: "모름",
    key: "1",
    tone: "bg-again-soft text-again active:bg-[color-mix(in_srgb,currentColor_10%,var(--again-soft))]",
    text: "text-again",
  },
  {
    answer: "hard",
    label: "애매",
    key: "2",
    tone: "bg-hard-soft text-hard active:bg-[color-mix(in_srgb,currentColor_10%,var(--hard-soft))]",
    text: "text-hard",
  },
  {
    answer: "good",
    label: "앎",
    key: "3",
    tone: "bg-good-soft text-good active:bg-[color-mix(in_srgb,currentColor_10%,var(--good-soft))]",
    text: "text-good",
  },
];

// 응답 시도 id. crypto.randomUUID는 https·localhost에서만 있어, 그 밖(LAN 주소로 폰 확인)에서는 난수 문자열을 쓴다.
function newAttemptId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// 응답 저장 실패는 서버 문구 대신 이 문구를 쓴다(C 화면 규칙 7.6).
const SAVE_FAILED = "응답을 저장하지 못했습니다 · 다시 눌러 주세요";
// 누른 뒤 이만큼 지나도 저장이 안 끝나면 "저장 중"을 보인다(빠른 망에서 깜박이지 않게).
const SAVING_HINT_DELAY_MS = 400;
// 이 글자 수 이상인 단어는 휴대폰에서 한 단계 작게 쓴다(C 화면 규칙 7.4).
const LONG_WORD = 13;

// 되돌릴 수 있는 직전 응답. card는 응답 전 카드(앞면으로 다시 보여 줄 것), prevDue는 응답 전 lastDue 값.
interface LastAnswer {
  logId: number;
  card: StudyCard;
  choice: Answer;
  prevDue: number | undefined;
}

type UndoNote = { kind: "done"; lemma: string } | { kind: "failed"; text: string } | null;

const UNDO_REJECTED = "되돌리지 못했습니다 · 다른 곳에서 이미 답한 카드입니다";
const UNDO_FAILED = "되돌리지 못했습니다";

const undoButtonClass =
  "hit-44 tap text-muted underline decoration-dotted underline-offset-[3px] hover:text-accent hover:decoration-solid focus-visible:text-accent focus-visible:decoration-solid disabled:opacity-55";

// 답 버튼 아래 단축키 안내 줄의 되돌리기 자리(Designer 2026-10-16). 무엇이 되돌려지는지 "단어 · 응답"으로 보인다.
function UndoControl({
  last,
  note,
  busy,
  onUndo,
  label = "되돌리기",
}: {
  last: LastAnswer | null;
  note: UndoNote;
  busy: boolean;
  onUndo: () => void;
  label?: string;
}) {
  const answer = last && ANSWER_BUTTONS.find((b) => b.answer === last.choice);
  return (
    <span aria-live="polite" className="inline-flex flex-wrap items-center gap-x-1.5">
      {note?.kind === "done" && (
        <span>
          <span className="font-en">{note.lemma}</span> 응답을 되돌렸습니다
        </span>
      )}
      {note?.kind === "failed" && <Failed>{note.text}</Failed>}
      {/* 일시적 실패는 대상이 남아 있다: Z뿐 아니라 버튼으로도 다시 시도할 수 있게 한다 */}
      {note?.kind === "failed" && last && (
        <>
          <span aria-hidden>·</span>
          <button type="button" onMouseDown={keepFocus} onClick={onUndo} disabled={busy} className={undoButtonClass}>
            다시 시도
          </button>
        </>
      )}
      {last && answer && !note && (
        <>
          <Kbd>Z</Kbd>
          <button type="button" onMouseDown={keepFocus} onClick={onUndo} disabled={busy} className={undoButtonClass}>
            {label}
          </button>
          <span className="ml-1">
            <span className="font-en">{last.card.lemma}</span> · <span className={answer.text}>{answer.label}</span>
          </span>
        </>
      )}
    </span>
  );
}

// 세션을 마친 뒤 이 시간 안에 다시 나오는 카드(학습 단계)를 따로 알려 준다.
const SOON_WINDOW_MS = 60 * 60_000;

interface Soon {
  count: number;
  minutes: number;
}

function UsageBlock({
  usage,
  primary,
  regen,
  onRegenerate,
}: {
  usage: Usage;
  primary: boolean;
  regen: RegenState | undefined;
  onRegenerate: () => void;
}) {
  return (
    <div
      className={
        primary
          ? "mt-6 border-t border-line pt-5 max-sm:mt-4 max-sm:pt-4"
          : "mt-4 border-t border-dashed border-line pt-4"
      }
    >
      {/* 다시 만드는 동안 원래 뜻을 제자리에 흐리게 둔다: 카드 높이와 아래 답 버튼 위치가 변하지 않는다 */}
      <div
        className={`${primary ? "text-[22px] leading-[1.45] font-bold max-sm:text-[20px]" : "text-[17px] font-bold max-sm:text-base"} ${
          regen?.phase === "busy" ? "opacity-50" : ""
        }`}
      >
        {usage.meaningStatus === "done" ? (
          usage.meaningKo
        ) : usage.meaningStatus === "failed" ? (
          <Failed>문맥 뜻을 만들지 못했습니다</Failed>
        ) : (
          <span className="inline-flex items-center gap-2 text-[15px] font-normal text-muted">
            <Spinner /> 뜻 만드는 중
          </span>
        )}
      </div>
      <p
        className={`mt-2.5 font-en text-ink-2 [overflow-wrap:anywhere] ${
          primary ? "text-lg leading-[1.6] max-sm:text-[16.5px]" : "text-base leading-[1.6] max-sm:text-[15px]"
        }`}
      >
        <Highlighted sentence={usage.sentence} word={usage.surface} />
      </p>
      {/* PC: 출처는 왼쪽, 다시 만들기는 오른쪽 끝. 휴대폰: 출처 아래 줄(제목이 두 줄이 되어도 버튼이 옮겨 다니지 않게) */}
      <div className="mt-2 flex items-start justify-between gap-4 text-[12.5px] leading-5 text-muted max-sm:flex-col max-sm:gap-1">
        <p className="[overflow-wrap:anywhere]">
          — <span className="font-en text-[13.5px] italic">{usage.documentTitle}</span>
        </p>
        <div className="flex h-5 shrink-0 items-center whitespace-nowrap empty:hidden max-sm:text-[13px]">
          {regen?.phase !== "limited" && (
            <RegenSlot
              state={regen}
              onRegenerate={onRegenerate}
              idle={<RegenIdleButton onRegenerate={onRegenerate} />}
            />
          )}
        </div>
      </div>
      {/* 한도 문구는 길어서 출처 아래 한 줄을 통째로 쓴다(C 화면 규칙 4.3) */}
      <p aria-live="polite" className="mt-1 empty:hidden">
        {regen?.phase === "limited" && <Limited className="text-[12.5px]">{regen.text}</Limited>}
      </p>
    </div>
  );
}

// Server Action이 아니라 fetch로 부른다: Server Action은 응답 저장(answerCard)과 한 줄로 실행되어 응답이 기다리게 된다.
async function requestRegeneration(occurrenceId: number): Promise<RegenerateUsageResult> {
  const res = await fetch("/api/usage-meaning", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ occurrenceId }),
  });
  return (await res.json()) as RegenerateUsageResult;
}

// hasCards: 이 사용자에게 카드가 하나라도 있는지. 큐가 비었을 때 "지금 없음"과 "아직 없음"을 나눈다.
export function StudySession({
  cards,
  autoSpeak,
  hasCards,
}: {
  cards: StudyCard[];
  autoSpeak: boolean;
  hasCards: boolean;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  // 큐를 바꾸는 곳은 모두 이 함수를 거친다: 응답이 끝나는 사이에 다시 만들기가 새 뜻을 넣었어도 최신 큐 위에서 갱신한다.
  // (클릭할 때 잡힌 queue로 갱신하면 새 뜻이 옛 뜻으로 되돌아간다)
  const queueRef = useRef(cards);
  const updateQueue = (change: (q: StudyCard[]) => StudyCard[]) => {
    queueRef.current = change(queueRef.current);
    setQueue(queueRef.current);
    return queueRef.current;
  };
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [lastDue, setLastDue] = useState<Map<number, number>>(new Map());
  const [soon, setSoon] = useState<Soon | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, startSaving] = useTransition();
  const [slowSaving, setSlowSaving] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  // 용례별 다시 만들기 상태. 결과 문구는 그 카드를 보는 동안만 남는다.
  const [regen, setRegen] = useState<Map<number, RegenState>>(new Map());
  const currentWordId = useRef<number | null>(null);
  // 이번 세션에서 다시 만든 뜻. 응답 뒤 큐에서 빠진 카드를 되돌릴 때도 새 뜻을 살린다.
  const meaningsRef = useRef(new Map<number, RegeneratedMeaning>());
  const locked = useRef(false);
  // 한 카드의 응답 시도 id. 저장이 실패해 다시 누를 때 같은 id를 보내, 서버가 저장했지만 응답만 유실된 경우에도 한 번만 적용되게 한다.
  const attempt = useRef<{ wordId: number; id: string } | null>(null);
  const [last, setLast] = useState<LastAnswer | null>(null);
  const [undoNote, setUndoNote] = useState<UndoNote>(null);

  const card = queue[0];

  // 뒷면 열기. 발음 자동 재생이 켜져 있으면 단어를 한 번 읽는다(설정 화면).
  const reveal = () => {
    // 저장·되돌리기 처리 중에는 열지 않는다(키보드는 이미 막혀 있고, 버튼 클릭도 같게 한다).
    if (!card || revealed || locked.current) return;
    setRevealed(true);
    // iOS는 사용자 동작(탭·키) 처리 안에서 시작한 음성만 허용한다: 미루지 않고 여기서 바로 읽는다(7.8).
    if (autoSpeak) speak(card.lemma);
    // 휴대폰: 뒷면이 길어 아래로 내려가 있었으면 카드 맨 위로 맞춘다(7.5).
    if (window.matchMedia("(max-width: 639px)").matches) {
      requestAnimationFrame(() => cardRef.current?.scrollIntoView({ block: "start" }));
    }
  };

  const answer = (choice: Answer) => {
    // saving(isPending)은 다음 렌더에야 버튼을 막으므로, 같은 순간의 두 번째 입력은 ref로 즉시 막는다.
    if (!card || locked.current) return;
    locked.current = true;
    startSaving(async () => {
      try {
        if (attempt.current?.wordId !== card.wordId) attempt.current = { wordId: card.wordId, id: newAttemptId() };
        const result = await answerCard(card.wordId, choice, attempt.current.id);
        if (result.error !== null) {
          setSaveFailed(true);
          return;
        }
        setSaveFailed(false);
        attempt.current = null;
        setAnswered((n) => n + 1);
        if (choice === "again") setAgainCount((n) => n + 1);
        setLast({ logId: result.logId, card, choice, prevDue: lastDue.get(card.wordId) });
        setUndoNote(null);
        const dues = new Map(lastDue).set(card.wordId, result.due);
        setLastDue(dues);
        const next = updateQueue((q) =>
          advanceQueue(q, choice).map((c) =>
            c.wordId === card.wordId ? { ...c, isNew: false, intervals: result.intervals } : c,
          ),
        );
        if (next.length === 0) {
          const now = Date.now();
          const pending = [...dues.values()].filter((due) => due > now && due - now <= SOON_WINDOW_MS);
          setSoon(
            pending.length > 0
              ? { count: pending.length, minutes: Math.max(1, Math.ceil((Math.min(...pending) - now) / 60_000)) }
              : null,
          );
        }
        setRevealed(false);
        // 다음 카드로 넘어가면 결과 문구를 지운다. 진행 중인 요청의 스피너는 그 카드가 다시 나올 때를 위해 둔다.
        setRegen((m) => new Map([...m].filter(([, s]) => s.phase === "busy")));
      } catch {
        // 망이 끊겨 Action 자체가 실패한 경우(휴대폰 망). 화면을 깨지 않고 다시 누르게 한다(C 화면 규칙 7.6).
        setSaveFailed(true);
      } finally {
        locked.current = false; // 실패해도 다시 누를 수 있게 푼다
      }
    });
  };

  // 직전 응답 되돌리기: 서버에서 카드 상태를 되돌리고, 그 카드를 앞면으로 큐 맨 앞에 다시 둔다.
  // 거부(다시 해도 같음)면 대상을 지우고, 그 밖의 실패면 대상을 남겨 다시 시도할 수 있게 한다.
  const undo = () => {
    if (!last || locked.current) return;
    locked.current = true;
    const target = last;
    startSaving(async () => {
      try {
        const result = await undoLastAnswer(target.logId);
        if (result.error !== null) {
          if (result.rejected) setLast(null);
          setUndoNote({ kind: "failed", text: result.rejected ? UNDO_REJECTED : UNDO_FAILED });
          return;
        }
        setAnswered((n) => n - 1);
        if (target.choice === "again") setAgainCount((n) => n - 1);
        setLastDue((m) => {
          const next = new Map(m);
          if (target.prevDue === undefined) next.delete(target.card.wordId);
          else next.set(target.card.wordId, target.prevDue);
          return next;
        });
        updateQueue((q) => {
          // "모름"이면 같은 카드가 큐 뒤에 다시 들어가 있다. 빼고 응답 전 카드를 맨 앞에 둔다(그 사이 다시 만든 뜻은 살린다).
          const restored = withMeanings(target.card, meaningsRef.current);
          return [restored, ...q.filter((c) => c.wordId !== target.card.wordId)];
        });
        setSoon(null);
        setRevealed(false);
        setRegen((m) => new Map([...m].filter(([, s]) => s.phase === "busy")));
        setLast(null);
        setUndoNote({ kind: "done", lemma: target.card.lemma });
      } catch {
        setUndoNote({ kind: "failed", text: UNDO_FAILED });
      } finally {
        locked.current = false;
      }
    });
  };

  useEffect(() => {
    currentWordId.current = card?.wordId ?? null;
  });

  // 저장이 SAVING_HINT_DELAY_MS보다 오래 걸릴 때만 "저장 중"을 보인다.
  useEffect(() => {
    if (!saving) return;
    const timer = setTimeout(() => setSlowSaving(true), SAVING_HINT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setSlowSaving(false);
    };
  }, [saving]);

  const setUsageRegen = (occurrenceId: number, state: RegenState | undefined) =>
    setRegen((m) => {
      const next = new Map(m);
      if (state) next.set(occurrenceId, state);
      else next.delete(occurrenceId);
      return next;
    });

  // 용례 하나의 뜻을 다시 받아 큐 안의 같은 용례를 모두 바꾼다. 기다리는 동안에도 1·2·3 응답은 된다.
  // 끝났을 때 이미 다음 카드로 넘어갔으면 결과 문구는 남기지 않는다(그 카드가 다시 나오면 새 뜻만 보인다).
  const regenerate = (wordId: number, occurrenceId: number) => {
    if (regen.get(occurrenceId)?.phase === "busy") return;
    setUsageRegen(occurrenceId, { phase: "busy" });
    const finish = (state: RegenState) =>
      setUsageRegen(occurrenceId, currentWordId.current === wordId ? state : undefined);
    requestRegeneration(occurrenceId)
      .then((result) => {
        if (result.error !== null) {
          finish(
            result.limitResetsOn
              ? { phase: "limited", text: LIMIT_CARD(result.limitResetsOn) }
              : { phase: "failed", text: result.error },
          );
          return;
        }
        meaningsRef.current.set(occurrenceId, { meaningKo: result.meaningKo, meaningStatus: result.meaningStatus });
        updateQueue((q) =>
          q.map((c) => ({
            ...c,
            usages: c.usages.map((u) =>
              u.occurrenceId === occurrenceId
                ? { ...u, meaningKo: result.meaningKo, meaningStatus: result.meaningStatus }
                : u,
            ),
          })),
        );
        finish(result.failed ? { phase: "failed", text: REGEN_FAILED } : { phase: "done" });
      })
      .catch(() => finish({ phase: "failed", text: REGEN_FAILED }));
  };

  // 키보드: Space/Enter 뒷면, 1·2·3 응답, P 발음, 완료 화면에서 Enter 홈. 입력칸에서는 끈다.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKey.current = (e) => {
      const target = e.target as HTMLInputElement | null;
      if (isTypingTarget(target) || e.ctrlKey || e.metaKey || e.altKey) return;
      // 포커스된 버튼·링크 위의 Space·Enter는 브라우저가 그것을 누르므로 여기서 또 처리하지 않는다.
      // (완료 화면의 "다시 확인" 링크에서 Enter가 링크 이동과 홈 이동을 함께 실행하던 문제)
      if (e.key === " " && isNativeSpaceTarget(target)) return;
      if (e.key === "Enter" && isNativeEnterTarget(target)) return;
      // 저장·되돌리기 처리 중에는 응답·뒷면·되돌리기 키를 무시한다.
      if (locked.current && ["1", "2", "3", " ", "Enter", "z", "Z"].includes(e.key)) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        undo();
        return;
      }
      if (!card) {
        // 카드가 하나도 없으면 문서로, 아니면 홈으로(빈 화면의 버튼과 같다)
        if (e.key === "Enter") router.push(answered === 0 && !hasCards ? "/documents" : "/");
        return;
      }
      if (e.key === "p" || e.key === "P") {
        speak(card.lemma);
      } else if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        reveal();
      } else if (revealed) {
        const hit = ANSWER_BUTTONS.find((b) => b.key === e.key);
        if (hit) {
          e.preventDefault();
          answer(hit.answer);
        }
      }
    };
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  if (!card && answered === 0) {
    // 이번 세션에 답한 것이 없다: 카드가 있으면 "지금 없음", 하나도 없으면 "아직 없음"(7.9)
    return (
      <div className="py-16 text-center max-sm:px-2 max-sm:pt-[72px] max-sm:pb-0">
        <p className="text-[22px] font-bold">{hasCards ? "지금 복습할 카드가 없습니다" : "아직 카드가 없습니다"}</p>
        <p className="mt-3 text-sm text-muted">
          {hasCards
            ? "오늘 나올 카드를 모두 봤습니다. 내일 다시 오세요."
            : "PC에서 논문 PDF를 올리고 단어를 저장하면 여기서 복습할 수 있습니다."}
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.push(hasCards ? "/" : "/documents")}
            className={buttonClass({ variant: "secondary" }, "tap max-sm:h-12 max-sm:w-full")}
          >
            {hasCards ? "홈으로" : "문서로"} <Kbd>Enter</Kbd>
          </button>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="py-16 text-center max-sm:px-2 max-sm:pt-[72px] max-sm:pb-0">
        <p className="text-[22px] font-bold">오늘 복습을 마쳤습니다</p>
        {answered > 0 && (
          <p className="mt-4 inline-flex gap-5 text-sm text-ink-2">
            <span>
              카드 <b className="tabular-nums">{lastDue.size}</b>장
            </span>
            <span>
              응답 <b className="tabular-nums">{answered}</b>번
            </span>
            <span>
              모름 <b className="text-again tabular-nums">{againCount}</b>
            </span>
          </p>
        )}
        {soon && (
          <p className="mt-3 text-sm text-muted">
            {soon.count}장은 약 {soon.minutes}분 뒤 다시 나옵니다 ·{" "}
            <a href="/study" className="font-semibold text-accent">
              다시 확인
            </a>
          </p>
        )}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className={buttonClass({ variant: "primary" }, "tap max-sm:h-12 max-sm:w-full")}
          >
            홈으로 <Kbd onAccent>Enter</Kbd>
          </button>
        </div>
        {(last || undoNote) && (
          <p className="mt-4 text-[13px] text-muted">
            <UndoControl last={last} note={undoNote} busy={saving} onUndo={undo} label="마지막 응답 되돌리기" />
          </p>
        )}
      </div>
    );
  }

  const total = answered + queue.length;
  const [first, second] = card.usages;
  const long = card.lemma.length >= LONG_WORD;
  // 휴대폰 고정 줄 위 칸: 저장 실패 > 저장 중 > 되돌리기(7.6). PC는 지금처럼 "P 발음 듣기 · 되돌리기".
  const mobileStatus = saveFailed ? (
    <span role="alert">
      <Failed>{SAVE_FAILED}</Failed>
    </span>
  ) : saving && slowSaving ? (
    <span className="inline-flex items-center gap-1.5">
      <Spinner /> 저장 중
    </span>
  ) : null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3.5 text-[13px] text-muted max-sm:pt-3.5">
        <span className="tabular-nums">
          {answered} / {total}
        </span>
        <span className="h-1 flex-1 overflow-hidden rounded-sm bg-sunken">
          <span className="block h-full bg-accent" style={{ width: `${(answered / total) * 100}%` }} />
        </span>
        <span>
          남은 <b className="text-ink tabular-nums">{queue.length}</b>
        </span>
      </div>

      {/* 앞면은 카드 어디를 눌러도 뒷면이 열린다(7.5). 키보드·읽기 프로그램은 "뒷면 보기" 버튼을 쓰므로 role을 주지 않는다 */}
      <section
        ref={cardRef}
        onClick={revealed ? undefined : reveal}
        className={`tap mt-5 flex min-h-[380px] scroll-mt-3 flex-col rounded-lg border border-line bg-surface px-12 pt-10 pb-8 shadow-1 max-[900px]:px-5 max-[900px]:pt-7 max-sm:mt-3 max-sm:mb-3 max-sm:min-h-0 max-sm:pt-[22px] max-sm:pb-5 ${
          revealed ? "" : "cursor-pointer max-sm:flex-1"
        }`}
      >
        {card.isNew && (
          <div>
            <Tag kind="new" />
          </div>
        )}
        <div className={`flex items-center gap-3 max-sm:items-start max-sm:gap-2.5 ${card.isNew ? "mt-4" : ""}`}>
          <h2
            className={`min-w-0 font-en leading-[1.1] font-bold tracking-[-0.01em] [overflow-wrap:anywhere] ${
              revealed
                ? `text-[40px] ${long ? "max-sm:text-[24px]" : "max-sm:text-[30px]"}`
                : `text-[52px] max-[900px]:text-[38px] ${long ? "max-sm:text-[28px]" : "max-sm:text-[36px]"}`
            }`}
          >
            {card.lemma}
          </h2>
          <SpeakButton text={card.lemma} />
        </div>

        {revealed ? (
          <>
            {/* 발음기호가 없을 때의 안내는 한글이라 영어 글꼴(Gentium)이 아닌 sans로 쓴다(개편안 3.3) */}
            <p
              className={`mt-1 text-muted ${card.phonetic ? "font-en text-[19px] max-sm:text-[17px]" : "font-sans text-[15px]"}`}
            >
              {card.phonetic ?? "발음기호 없음"}
            </p>
            {[first, second].map(
              (u, i) =>
                u && (
                  <UsageBlock
                    key={u.occurrenceId}
                    usage={u}
                    primary={i === 0}
                    regen={regen.get(u.occurrenceId)}
                    onRegenerate={() => regenerate(card.wordId, u.occurrenceId)}
                  />
                ),
            )}
          </>
        ) : (
          <p className="mt-auto pt-12 text-center text-sm text-muted">
            이 문서에서 어떤 뜻이었는지 떠올려 보세요
            <span className="mt-1 hidden text-[12.5px] max-sm:block">카드를 누르거나 아래 버튼</span>
          </p>
        )}
      </section>

      {/* 휴대폰: 화면 아래 고정 줄(상태 32px + 버튼). PC: 카드 아래 버튼 + 안내 줄(지금과 같음) */}
      <div className="flex flex-col max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-4 max-sm:mt-auto max-sm:border-t max-sm:border-line max-sm:bg-bg max-sm:px-4 max-sm:pt-2 max-sm:pb-[calc(12px+env(safe-area-inset-bottom))]">
        {revealed ? (
          <div className="mt-5 grid grid-cols-3 gap-3 max-sm:mt-0 max-sm:gap-2">
            {ANSWER_BUTTONS.map((b) => (
              <button
                key={b.answer}
                type="button"
                disabled={saving}
                onClick={() => answer(b.answer)}
                className={`tap grid justify-items-center gap-0.5 rounded-lg px-3.5 py-3.5 disabled:opacity-55 max-sm:h-[60px] max-sm:content-center max-sm:py-0 ${b.tone}`}
              >
                <b className="text-base">{b.label}</b>
                <span className="text-xs opacity-80">{formatInterval(card.intervals[b.answer])} 뒤</span>
                <span className="mt-1 touch:hidden">
                  <Kbd>{b.key}</Kbd>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={reveal}
            className="tap mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface p-3.5 text-[15px] font-semibold text-ink hover:bg-sunken active:bg-sunken max-sm:mt-0 max-sm:h-[52px] max-sm:text-base"
          >
            뒷면 보기 <Kbd>Space</Kbd>
          </button>
        )}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 text-[13px] text-muted max-sm:order-first max-sm:mt-0 max-sm:mb-1 max-sm:h-8 max-sm:flex-nowrap max-sm:overflow-hidden">
          {/* 휴대폰 전용 상태(저장 중·저장 실패). 되돌리기는 UndoControl이 따로 알린다 */}
          <span aria-live="polite" className="hidden empty:hidden max-sm:inline-flex">
            {mobileStatus}
          </span>
          <span className={`inline-flex flex-wrap items-center justify-center gap-x-2 ${mobileStatus ? "max-sm:hidden" : ""}`}>
            <span className="touch:hidden">
              <Kbd>P</Kbd> 발음 듣기
            </span>
            {(last || undoNote) && (
              <>
                <span aria-hidden className="mx-1 touch:hidden">
                  ·
                </span>
                <UndoControl last={last} note={undoNote} busy={saving} onUndo={undo} />
              </>
            )}
          </span>
        </div>
      </div>

      {saveFailed && (
        <p role="alert" className="mt-3 text-center text-sm max-sm:hidden">
          <Failed>{SAVE_FAILED}</Failed>
        </p>
      )}
    </div>
  );
}
