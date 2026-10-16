"use client";

import { useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { Highlighted } from "@/components/ui/highlighted";
import { Kbd } from "@/components/ui/kbd";
import { RegenIdleButton, RegenSlot, type RegenState } from "@/components/ui/regen-slot";
import { LIMIT_SLOT, REGEN_FAILED } from "@/lib/regen-messages";
import { Failed, Spinner } from "@/components/ui/status";
import { keepFocus } from "@/lib/ui/keys";
import type { OccurrenceView } from "@/server/repo/cards";
import { regenerateDocumentMeanings, removeCard } from "./actions";

export interface WordRow extends OccurrenceView {
  usageCount: number; // 이 카드의 용례 수(모든 문서)
}

const linkClass = "font-semibold text-accent hover:underline focus-visible:underline";

function MeaningText({ row, busy }: { row: WordRow; busy: boolean }) {
  if (row.meaningStatus === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
        <Spinner /> 뜻 만드는 중
      </span>
    );
  }
  // 다시 만드는 동안 원래 뜻(또는 실패 표시)을 제자리에 흐리게 둔다: 행 높이가 변하지 않는다.
  return (
    <span className={busy ? "opacity-50" : undefined}>
      {row.meaningStatus === "done" ? (
        <span className="text-[15px] font-semibold text-ink">{row.meaningKo}</span>
      ) : (
        <Failed>생성 실패</Failed>
      )}
    </span>
  );
}

// 문서 단어 목록 표. 행에 마우스를 올리거나 포커스가 들어오면 "뜻 다시 만들기 · 카드 삭제"가 바로 나온다
// (192행에 늘 떠 있으면 시끄럽다. 실패한 뜻 일괄 처리는 안내 줄의 "모두 다시 시도"가 맡는다).
// 다시 만들기의 진행·결과는 그 자리에 보이고, 다른 행에 마우스를 올리거나 페이지를 옮길 때까지 남는다.
// 뜻을 직접 고치는 기능은 두지 않는다: 모르는 단어를 공부하는 사람은 맞는 뜻을 알지 못하므로,
// 이상한 뜻은 다시 만들게 한다(2026-10-16 사용자 결정).
export function WordTable({ documentId, rows }: { documentId: number; rows: WordRow[] }) {
  const [regen, setRegen] = useState<Map<number, RegenState>>(new Map());
  const [rowMessage, setRowMessage] = useState<{ id: number; text: string } | null>(null);
  const [deleting, setDeleting] = useState<WordRow | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);

  const setRowRegen = (id: number, state: RegenState | undefined) =>
    setRegen((m) => {
      const next = new Map(m);
      if (state) next.set(id, state);
      else next.delete(id);
      return next;
    });

  // 다른 행에 마우스를 올리면 끝난 결과 문구를 지운다(진행 중인 것은 둔다).
  const clearOutcomes = (exceptId: number) =>
    setRegen((m) => {
      const stale = [...m].filter(([id, s]) => id !== exceptId && s.phase !== "busy");
      if (stale.length === 0) return m;
      const next = new Map(m);
      for (const [id] of stale) next.delete(id);
      return next;
    });

  const regenerate = (row: WordRow) => {
    if (regen.get(row.id)?.phase === "busy") return;
    setRowRegen(row.id, { phase: "busy" });
    regenerateDocumentMeanings(documentId, [row.id])
      .then((result) => {
        if (result.error !== null && result.limitResetsOn) setRowRegen(row.id, { phase: "limited", text: LIMIT_SLOT });
        else if (result.error !== null) setRowRegen(row.id, { phase: "failed", text: result.error });
        else if (result.failed > 0) setRowRegen(row.id, { phase: "failed", text: REGEN_FAILED });
        else setRowRegen(row.id, { phase: "done" });
      })
      .catch(() => setRowRegen(row.id, { phase: "failed", text: REGEN_FAILED }));
  };

  const openDelete = (row: WordRow) => {
    setDeleting(row);
    setRowMessage(null);
    dialog.current?.showModal();
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const row = deleting;
    startTransition(async () => {
      const result = await removeCard(documentId, row.wordId);
      if (result.error) setRowMessage({ id: row.id, text: result.error });
      else dialog.current?.close();
    });
  };

  return (
    <>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line-strong text-left text-xs font-semibold whitespace-nowrap text-muted">
              <th className="w-[200px] px-3 py-2">단어</th>
              <th className="w-[260px] px-3 py-2">문맥 뜻</th>
              <th className="px-3 py-2">원문 문장</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onMouseEnter={() => clearOutcomes(r.id)}
                className="group border-b border-line align-top hover:bg-sunken/60 focus-within:bg-sunken/60"
              >
                <td className="px-3 py-2.5">
                  <div className="font-en text-[17px] font-bold">{r.lemma}</div>
                  {r.phonetic ? (
                    <div className="font-en text-sm text-muted">{r.phonetic}</div>
                  ) : (
                    <div className="text-[15px] text-muted">발음기호 없음</div>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <MeaningText row={r} busy={regen.get(r.id)?.phase === "busy"} />
                  {rowMessage?.id === r.id && !deleting && (
                    <p role="alert" className="mt-1 text-[13px] text-again">
                      {rowMessage.text}
                    </p>
                  )}
                  {/* opacity-0: 자리는 늘 차지해 행 높이가 변하지 않고, invisible과 달리 Tab으로 닿는다(포커스가 들어오면 보인다). 상태가 있거나 삭제 확인 중이면 늘 보인다 */}
                  <div
                    className={`mt-1.5 flex min-h-5 items-center text-[13px] ${
                      regen.has(r.id) || deleting?.id === r.id
                        ? ""
                        : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    }`}
                  >
                    <RegenSlot
                      state={regen.get(r.id)}
                      onRegenerate={() => regenerate(r)}
                      buttonClassName={linkClass}
                      idle={
                        <span className="inline-flex gap-3">
                          <RegenIdleButton onRegenerate={() => regenerate(r)} className={linkClass} />
                          <button
                            type="button"
                            className="font-semibold text-muted hover:underline focus-visible:underline"
                            onMouseDown={keepFocus}
                            onClick={() => openDelete(r)}
                          >
                            카드 삭제
                          </button>
                        </span>
                      }
                    />
                  </div>
                </td>
                <td className="px-3 py-2.5 font-en text-[15.5px] leading-[1.55] text-ink-2">
                  <Highlighted sentence={r.sentence} word={r.surface} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 브라우저 기본 <dialog>: 포커스 가두기와 Esc 닫기를 기본으로 한다(개편안 4.2) */}
      <dialog
        ref={dialog}
        onClose={() => setDeleting(null)}
        className="m-auto w-[400px] max-w-[calc(100%-32px)] rounded-lg border border-line bg-surface p-[22px] text-ink shadow-2 backdrop:bg-ink/30"
      >
        {deleting && (
          <>
            <h2 className="mb-1.5 text-[17px] font-bold">카드를 삭제할까요?</h2>
            <p className="mb-[18px] text-sm text-ink-2">
              <b className="font-en text-base">{deleting.lemma}</b> 카드와 용례 {deleting.usageCount}개, 복습 기록이 모두
              지워집니다.{deleting.usageCount > 1 && " 다른 문서의 용례도 함께 지워집니다."} 되돌릴 수 없습니다.
            </p>
            {rowMessage?.id === deleting.id && (
              <p role="alert" className="mb-3 text-[13px] text-again">
                {rowMessage.text}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className={buttonClass()} onClick={() => dialog.current?.close()}>
                취소 <Kbd>Esc</Kbd>
              </button>
              <button
                type="button"
                className={buttonClass({ variant: "danger" })}
                disabled={pending}
                onClick={confirmDelete}
              >
                삭제
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
