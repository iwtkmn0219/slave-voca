"use client";

import { useState } from "react";
import { highlight } from "@/lib/text/highlight";

export interface CandidateView {
  id: number;
  lemma: string;
  surface: string;
  sentence: string;
  count: number;
  isExisting: boolean;
}

export function CandidateTable({ candidates }: { candidates: CandidateView[] }) {
  const [selected, setSelected] = useState(() => new Set(candidates.map((c) => c.id)));
  const allSelected = selected.size === candidates.length;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(candidates.map((c) => c.id)));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <button type="button" onClick={toggleAll} className="rounded border px-3 py-1">
          {allSelected ? "전체 해제" : "전체 선택"}
        </button>
        <span>
          {candidates.length}개 중 {selected.size}개 선택 · 체크를 해제한 단어는 아는 단어로
          처리됩니다
        </span>
        {/* 저장은 마일스톤 2에서 연결한다. */}
        <button
          type="button"
          disabled
          title="마일스톤 2에서 연결됩니다"
          className="ml-auto rounded bg-black px-4 py-1 text-white opacity-50"
        >
          저장
        </button>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="w-8 py-2" />
            <th>단어</th>
            <th>횟수</th>
            <th>원문 문장</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id} className="border-b align-top">
              <td className="py-2">
                <input
                  type="checkbox"
                  aria-label={`${c.lemma} 선택`}
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
              </td>
              <td className="py-2 font-medium">
                {c.lemma}
                {c.isExisting && (
                  <span className="ml-2 rounded bg-gray-200 px-1 text-xs">이미 학습 중</span>
                )}
              </td>
              <td className="py-2">{c.count}</td>
              <td className="py-2">
                {highlight(c.sentence, c.surface).map((seg, i) =>
                  seg.match ? (
                    <mark key={i}>{seg.text}</mark>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
