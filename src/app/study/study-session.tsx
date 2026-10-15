"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { Highlighted } from "@/components/ui/highlighted";
import { Kbd } from "@/components/ui/kbd";
import { Failed, Spinner } from "@/components/ui/status";
import { Tag } from "@/components/ui/tag";
import { formatInterval } from "@/lib/srs/interval";
import type { Answer } from "@/lib/srs/scheduler";
import { advanceQueue } from "@/lib/srs/session";
import { isNativeSpaceTarget, isTypingTarget } from "@/lib/ui/keys";
import type { StudyCard, Usage } from "@/server/repo/study";
import { answerCard } from "./actions";
import { SpeakButton, speak } from "./speak-button";

const ANSWER_BUTTONS: { answer: Answer; label: string; key: string; tone: string }[] = [
  { answer: "again", label: "모름", key: "1", tone: "bg-again-soft text-again" },
  { answer: "hard", label: "애매", key: "2", tone: "bg-hard-soft text-hard" },
  { answer: "good", label: "앎", key: "3", tone: "bg-good-soft text-good" },
];

// 세션을 마친 뒤 이 시간 안에 다시 나오는 카드(학습 단계)를 따로 알려 준다.
const SOON_WINDOW_MS = 60 * 60_000;

interface Soon {
  count: number;
  minutes: number;
}

function UsageBlock({ usage, primary }: { usage: Usage; primary: boolean }) {
  return (
    <div className={primary ? "mt-6 border-t border-line pt-5" : "mt-4 border-t border-dashed border-line pt-4"}>
      <div className={primary ? "text-[22px] leading-[1.45] font-bold" : "text-[17px] font-bold"}>
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
      <p className="mt-2 text-[12.5px] text-muted">
        — <span className="font-en text-[13.5px] italic">{usage.documentTitle}</span>
      </p>
    </div>
  );
}

export function StudySession({ cards }: { cards: StudyCard[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [lastDue, setLastDue] = useState<Map<number, number>>(new Map());
  const [soon, setSoon] = useState<Soon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const locked = useRef(false);

  const card = queue[0];

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
        const dues = new Map(lastDue).set(card.wordId, result.due);
        setLastDue(dues);
        const next = advanceQueue(queue, choice).map((c) =>
          c.wordId === card.wordId ? { ...c, isNew: false, intervals: result.intervals } : c,
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
        setQueue(next);
        setRevealed(false);
      } finally {
        locked.current = false; // 실패해도 다시 누를 수 있게 푼다
      }
    });
  };

  // 키보드: Space/Enter 뒷면, 1·2·3 응답, P 발음, 완료 화면에서 Enter 홈. 입력칸에서는 끈다.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKey.current = (e) => {
      const target = e.target as HTMLInputElement | null;
      if (isTypingTarget(target) || e.ctrlKey || e.metaKey || e.altKey) return;
      // 포커스된 버튼 위의 Space·Enter는 브라우저가 그 버튼을 누르므로 여기서 또 처리하지 않는다.
      if ((e.key === " " || e.key === "Enter") && isNativeSpaceTarget(target)) return;
      if (!card) {
        if (e.key === "Enter") router.push("/");
        return;
      }
      if (e.key === "p" || e.key === "P") {
        speak(card.lemma);
      } else if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
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
            {first && <UsageBlock usage={first} primary />}
            {second && <UsageBlock usage={second} primary={false} />}
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
          onClick={() => setRevealed(true)}
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface p-3.5 text-[15px] font-semibold text-ink hover:bg-sunken"
        >
          뒷면 보기 <Kbd>Space</Kbd>
        </button>
      )}
      <p className="mt-2.5 text-center text-[13px] text-muted">
        <Kbd>P</Kbd> 발음 듣기
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-again">
          {error}
        </p>
      )}
    </div>
  );
}
