"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { Highlighted } from "@/components/ui/highlighted";
import { Kbd } from "@/components/ui/kbd";
import { RegenIdleButton, RegenSlot, type RegenState } from "@/components/ui/regen-slot";
import { REGEN_FAILED } from "@/lib/regen-messages";
import { Failed, Spinner } from "@/components/ui/status";
import { Tag } from "@/components/ui/tag";
import { formatInterval } from "@/lib/srs/interval";
import type { Answer } from "@/lib/srs/scheduler";
import { advanceQueue } from "@/lib/srs/session";
import { isNativeEnterTarget, isNativeSpaceTarget, isTypingTarget, keepFocus } from "@/lib/ui/keys";
import type { StudyCard, Usage } from "@/server/repo/study";
import type { RegenerateUsageResult } from "@/server/services/usage-meaning";
import { answerCard, undoLastAnswer } from "./actions";
import { SpeakButton, speak } from "./speak-button";

const ANSWER_BUTTONS: { answer: Answer; label: string; key: string; tone: string; text: string }[] = [
  { answer: "again", label: "모름", key: "1", tone: "bg-again-soft text-again", text: "text-again" },
  { answer: "hard", label: "애매", key: "2", tone: "bg-hard-soft text-hard", text: "text-hard" },
  { answer: "good", label: "앎", key: "3", tone: "bg-good-soft text-good", text: "text-good" },
];

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
  "text-muted underline decoration-dotted underline-offset-[3px] hover:text-accent hover:decoration-solid focus-visible:text-accent focus-visible:decoration-solid disabled:opacity-55";

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
    <div className={primary ? "mt-6 border-t border-line pt-5" : "mt-4 border-t border-dashed border-line pt-4"}>
      {/* 다시 만드는 동안 원래 뜻을 제자리에 흐리게 둔다: 카드 높이와 아래 답 버튼 위치가 변하지 않는다 */}
      <div
        className={`${primary ? "text-[22px] leading-[1.45] font-bold" : "text-[17px] font-bold"} ${
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
      <p className={`mt-2.5 font-en text-ink-2 ${primary ? "text-lg leading-[1.6]" : "text-base leading-[1.6]"}`}>
        <Highlighted sentence={usage.sentence} word={usage.surface} />
      </p>
      {/* 출처는 왼쪽, 다시 만들기는 오른쪽 끝: 제목 길이와 상관없이 용례마다 같은 자리다 */}
      <div className="mt-2 flex items-start justify-between gap-4 text-[12.5px] leading-5 text-muted">
        <p>
          — <span className="font-en text-[13.5px] italic">{usage.documentTitle}</span>
        </p>
        <div className="flex h-5 shrink-0 items-center whitespace-nowrap">
          <RegenSlot
            state={regen}
            onRegenerate={onRegenerate}
            idle={<RegenIdleButton onRegenerate={onRegenerate} />}
          />
        </div>
      </div>
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

export function StudySession({ cards, autoSpeak }: { cards: StudyCard[]; autoSpeak: boolean }) {
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
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  // 용례별 다시 만들기 상태. 결과 문구는 그 카드를 보는 동안만 남는다.
  const [regen, setRegen] = useState<Map<number, RegenState>>(new Map());
  const currentWordId = useRef<number | null>(null);
  const locked = useRef(false);
  const [last, setLast] = useState<LastAnswer | null>(null);
  const [undoNote, setUndoNote] = useState<UndoNote>(null);

  const card = queue[0];

  // 뒷면 열기. 발음 자동 재생이 켜져 있으면 단어를 한 번 읽는다(설정 화면).
  const reveal = () => {
    if (!card || revealed) return;
    setRevealed(true);
    if (autoSpeak) speak(card.lemma);
  };

  const answer = (choice: Answer) => {
    // saving(isPending)은 다음 렌더에야 버튼을 막으므로, 같은 순간의 두 번째 입력은 ref로 즉시 막는다.
    if (!card || locked.current) return;
    locked.current = true;
    startSaving(async () => {
      try {
        const result = await answerCard(card.wordId, choice);
        if (result.error !== null) {
          setError(result.error);
          return;
        }
        setError(null);
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
          // "모름"이면 같은 카드가 큐 뒤에 다시 들어가 있다. 빼고 응답 전 카드를 맨 앞에 둔다(그 사이 바뀐 뜻은 살린다).
          const later = q.find((c) => c.wordId === target.card.wordId);
          const restored = { ...target.card, usages: later?.usages ?? target.card.usages };
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
          finish({ phase: "failed", text: result.error });
          return;
        }
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
        if (e.key === "Enter") router.push("/");
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

  if (!card) {
    return (
      <div className="py-16 text-center">
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
          <button type="button" onClick={() => router.push("/")} className={buttonClass({ variant: "primary" })}>
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

  return (
    <div>
      <div className="flex items-center gap-3.5 text-[13px] text-muted">
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

      <section className="mt-5 flex min-h-[380px] flex-col rounded-lg border border-line bg-surface px-12 pt-10 pb-8 shadow-1 max-[900px]:px-5 max-[900px]:pt-7">
        {card.isNew && (
          <div>
            <Tag kind="new" />
          </div>
        )}
        <div className={`flex items-center gap-3 ${card.isNew ? "mt-4" : ""}`}>
          <h2
            className={`font-en leading-[1.1] font-bold tracking-[-0.01em] ${
              revealed ? "text-[40px]" : "text-[52px] max-[900px]:text-[38px]"
            }`}
          >
            {card.lemma}
          </h2>
          <SpeakButton text={card.lemma} />
        </div>

        {revealed ? (
          <>
            <p className={`mt-1 font-en text-[19px] ${card.phonetic ? "text-muted" : "text-[15px] text-muted"}`}>
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
          <p className="mt-auto pt-12 text-center text-sm text-muted">이 문서에서 어떤 뜻이었는지 떠올려 보세요</p>
        )}
      </section>

      {revealed ? (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {ANSWER_BUTTONS.map((b) => (
            <button
              key={b.answer}
              type="button"
              disabled={saving}
              onClick={() => answer(b.answer)}
              className={`grid justify-items-center gap-0.5 rounded-lg px-3.5 py-3.5 disabled:opacity-55 ${b.tone}`}
            >
              <b className="text-base">{b.label}</b>
              <span className="text-xs opacity-80">{formatInterval(card.intervals[b.answer])} 뒤</span>
              <span className="mt-1">
                <Kbd>{b.key}</Kbd>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={reveal}
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface p-3.5 text-[15px] font-semibold text-ink hover:bg-sunken"
        >
          뒷면 보기 <Kbd>Space</Kbd>
        </button>
      )}
      <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 text-[13px] text-muted">
        <span>
          <Kbd>P</Kbd> 발음 듣기
        </span>
        {(last || undoNote) && (
          <>
            <span aria-hidden className="mx-1">
              ·
            </span>
            <UndoControl last={last} note={undoNote} busy={saving} onUndo={undo} />
          </>
        )}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-again">
          {error}
        </p>
      )}
    </div>
  );
}
