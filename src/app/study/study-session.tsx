"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type { Answer } from "@/lib/srs/scheduler";
import { advanceQueue } from "@/lib/srs/session";
import { highlight } from "@/lib/text/highlight";
import type { StudyCard } from "@/server/repo/study";
import { answerCard } from "./actions";
import { SpeakButton } from "./speak-button";

const ANSWER_BUTTONS: { answer: Answer; label: string; className: string }[] = [
  { answer: "again", label: "모름", className: "bg-red-600" },
  { answer: "hard", label: "애매", className: "bg-yellow-600" },
  { answer: "good", label: "앎", className: "bg-green-700" },
];

export function StudySession({ cards }: { cards: StudyCard[] }) {
  const [queue, setQueue] = useState(cards);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const locked = useRef(false);

  if (queue.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-lg">오늘 복습을 마쳤습니다. {answered > 0 && `(응답 ${answered}번)`}</p>
        <Link href="/" className="underline">
          홈으로
        </Link>
      </div>
    );
  }

  const card = queue[0];
  const answer = (choice: Answer) => {
    // saving(isPending)은 다음 렌더에야 버튼을 막으므로, 같은 순간의 두 번째 클릭은 ref로 즉시 막는다.
    if (locked.current) return;
    locked.current = true;
    startSaving(async () => {
      try {
        const result = await answerCard(card.wordId, choice);
        if (result.error) {
          setError(result.error);
          return;
        }
        setError(null);
        setAnswered((n) => n + 1);
        setQueue((q) => advanceQueue(q, choice));
        setRevealed(false);
      } finally {
        locked.current = false; // 실패해도 다시 누를 수 있게 푼다
      }
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">남은 카드 {queue.length}장</p>

      <section className="space-y-2 rounded border p-6">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-semibold">{card.lemma}</h2>
          <SpeakButton text={card.lemma} />
          {card.isNew && <span className="rounded bg-blue-100 px-2 text-xs">새 카드</span>}
        </div>

        {revealed ? (
          <div className="space-y-4 pt-2">
            <p className="text-gray-600">{card.phonetic ?? "발음기호 없음"}</p>
            {card.usages.map((u, i) => (
              <div key={i} className="space-y-1">
                <p className="text-lg">
                  {u.meaningStatus === "done"
                    ? u.meaningKo
                    : u.meaningStatus === "failed"
                      ? "뜻 없음 (생성 실패)"
                      : "뜻 생성 중"}
                </p>
                <p className="text-sm">
                  {highlight(u.sentence, u.surface).map((seg, j) =>
                    seg.match ? <mark key={j}>{seg.text}</mark> : <span key={j}>{seg.text}</span>,
                  )}
                </p>
                <p className="text-xs text-gray-500">{u.documentTitle}</p>
              </div>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="rounded border px-4 py-2"
          >
            뒷면 보기
          </button>
        )}
      </section>

      {revealed && (
        <div className="flex gap-3">
          {ANSWER_BUTTONS.map((b) => (
            <button
              key={b.answer}
              type="button"
              disabled={saving}
              onClick={() => answer(b.answer)}
              className={`rounded px-6 py-2 text-white disabled:opacity-50 ${b.className}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
