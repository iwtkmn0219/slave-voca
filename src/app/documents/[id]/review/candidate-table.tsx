"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { Highlighted } from "@/components/ui/highlighted";
import { Kbd } from "@/components/ui/kbd";
import { Status } from "@/components/ui/status";
import { Tag } from "@/components/ui/tag";
import {
  filterCounts,
  matchesFilter,
  selectRange,
  toggleOne,
  type ReviewFilter,
} from "@/lib/review/selection";
import { isNativeSpaceTarget, isTypingTarget } from "@/lib/ui/keys";
import { saveReview } from "./actions";

export interface CandidateView {
  id: number;
  lemma: string;
  surface: string;
  sentence: string;
  count: number;
  isExisting: boolean;
  inDictionary: boolean;
}

const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "learning", label: "이미 학습 중" },
  { value: "nodict", label: "사전에 없음" },
  { value: "off", label: "해제함" },
];

export function CandidateTable({
  documentId,
  candidates,
}: {
  documentId: number;
  candidates: CandidateView[];
}) {
  // 사전에 없는 단어(약칭·기호일 가능성이 큼)는 기본으로 체크 해제한다.
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(candidates.filter((c) => c.inDictionary).map((c) => c.id)),
  );
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [focus, setFocus] = useState(0);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());

  const visible = candidates.filter((c) => matchesFilter(c, filter, selected));
  const counts = filterCounts(candidates, selected);
  const focusedId = visible[Math.min(focus, visible.length - 1)]?.id;
  const allVisibleOn = visible.length > 0 && visible.every((c) => selected.has(c.id));

  const check = (id: number, shift: boolean) => {
    setSelected((prev) =>
      shift && anchor !== null ? selectRange(prev, visible.map((c) => c.id), anchor, id) : toggleOne(prev, id),
    );
    setAnchor(id);
  };

  const toggleVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of visible) {
        if (allVisibleOn) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });

  const save = () => {
    if (saving) return;
    startSaving(async () => {
      const result = await saveReview(documentId, [...selected]);
      if (result?.error) setError(result.error);
    });
  };

  // 키보드: J/K(↓/↑) 이동, Space/X 체크, Ctrl+Enter 저장(제안서 5.3)
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKey.current = (e) => {
      const target = e.target as HTMLInputElement | null;
      if (saving || isTypingTarget(target)) return;
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        save();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocus((f) => Math.min(f + 1, visible.length - 1));
      } else if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocus((f) => Math.max(f - 1, 0));
      } else if ((e.key === " " && !isNativeSpaceTarget(target)) || e.key === "x" || e.key === "X") {
        if (focusedId === undefined) return;
        e.preventDefault();
        check(focusedId, e.shiftKey);
      }
    };
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    if (focusedId !== undefined) rowRefs.current.get(focusedId)?.scrollIntoView({ block: "nearest" });
  }, [focusedId]);

  const savedCount = selected.size;
  const offCount = candidates.length - savedCount;

  return (
    <div>
      <div
        aria-live="polite"
        className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-bg/92 px-10 py-2.5 backdrop-blur max-[900px]:px-4"
      >
        {saving ? (
          <>
            <Status tone="busy" className="text-sm text-ink">
              뜻과 발음을 채우는 중 · {savedCount}개
            </Status>
            <span className="relative h-[3px] w-40 overflow-hidden rounded-sm bg-sunken">
              <span className="absolute inset-y-0 w-2/5 animate-[indeterminate_1.2s_ease-in-out_infinite_alternate] bg-accent" />
            </span>
            <span className="text-[13px] text-muted">보통 10초 안팎 걸립니다. 끝나면 단어 목록으로 이동합니다.</span>
          </>
        ) : (
          <>
            <span className="text-sm">
              <b className="tabular-nums">{candidates.length}</b>개 중{" "}
              <b className="text-accent tabular-nums">{savedCount}</b>개 저장 · 해제한{" "}
              <span className="tabular-nums">{offCount}</span>개는 아는 단어로
            </span>
            <span className="inline-flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filter === f.value}
                  onClick={() => {
                    setFilter(f.value);
                    setFocus(0);
                  }}
                  className={`rounded-full border bg-surface px-2.5 py-1 text-[12.5px] ${
                    filter === f.value ? "border-ink font-semibold text-ink" : "border-line-strong text-ink-2"
                  }`}
                >
                  {f.label}
                  <i className="ml-1 text-muted not-italic tabular-nums">{counts[f.value]}</i>
                </button>
              ))}
            </span>
          </>
        )}
        <span className="flex-1" />
        {!saving && (
          <button type="button" onClick={toggleVisible} className={buttonClass({ variant: "ghost", size: "sm" })}>
            {allVisibleOn ? "보이는 행 모두 해제" : "보이는 행 모두 선택"}
          </button>
        )}
        <button type="button" onClick={save} disabled={saving} className={buttonClass({ variant: "primary" })}>
          {saving ? "저장 중…" : "저장"} {!saving && <Kbd onAccent>Ctrl Enter</Kbd>}
        </button>
      </div>

      {error && (
        <p role="alert" className="px-10 pt-3 text-sm text-again">
          {error}
        </p>
      )}

      <div className={`overflow-x-auto px-7 max-[900px]:px-2 ${saving ? "pointer-events-none opacity-45" : ""}`} aria-busy={saving}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line-strong text-left text-xs font-semibold whitespace-nowrap text-muted">
              <th className="w-11 px-3 py-2" />
              <th className="w-[300px] px-3 py-2">단어</th>
              <th className="w-14 px-3 py-2 text-right">횟수</th>
              <th className="px-3 py-2">원문 문장</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const on = selected.has(c.id);
              const focused = c.id === focusedId;
              return (
                <tr
                  key={c.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(c.id, el);
                    else rowRefs.current.delete(c.id);
                  }}
                  className={`border-b border-line align-top ${focused ? "bg-accent-soft" : "hover:bg-sunken/60"}`}
                >
                  <td className={`px-3 py-[7px] ${focused ? "shadow-[inset_3px_0_0_var(--accent)]" : ""}`}>
                    <input
                      type="checkbox"
                      aria-label={`${c.lemma} 선택`}
                      checked={on}
                      onChange={(e) => check(c.id, (e.nativeEvent as MouseEvent).shiftKey === true)}
                      onFocus={() => setFocus(visible.indexOf(c))}
                      className="mt-1 size-[18px] accent-accent"
                    />
                  </td>
                  <td className="px-3 py-[7px]">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className={`font-en text-base ${on ? "font-bold text-ink" : "text-faint"}`}>{c.lemma}</span>
                      {c.isExisting && <Tag kind="learning" />}
                      {!c.inDictionary && <Tag kind="nodict" />}
                    </div>
                  </td>
                  <td className="px-3 py-[7px] text-right text-sm text-muted tabular-nums">{c.count}</td>
                  <td
                    className={`px-3 py-[7px] font-en text-[15px] leading-[1.55] ${
                      on ? "text-ink-2" : "text-faint [&_mark]:font-normal [&_mark]:opacity-55"
                    }`}
                  >
                    <Highlighted sentence={c.sentence} word={c.surface} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="px-3 py-6 text-sm text-muted">이 조건에 맞는 단어가 없습니다.</p>}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-[18px] gap-y-1 border-t border-line bg-surface px-10 py-3 text-[12.5px] text-muted max-[900px]:px-4">
        <span>
          <Kbd>J</Kbd> <Kbd>K</Kbd> 아래·위
        </span>
        <span>
          <Kbd>Space</Kbd> 체크 바꾸기
        </span>
        <span>
          <Kbd>Shift</Kbd>+클릭 범위 선택
        </span>
        <span>
          <Kbd>Ctrl Enter</Kbd> 저장
        </span>
        <span>체크 해제 = 아는 단어(다음 문서부터 제외)</span>
      </div>
    </div>
  );
}
