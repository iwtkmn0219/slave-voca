"use client";

import { useState, useTransition } from "react";
import { highlight } from "@/lib/text/highlight";
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

export function CandidateTable({
  documentId,
  candidates,
}: {
  documentId: number;
  candidates: CandidateView[];
}) {
  // 사전에 없는 단어(약칭·기호일 가능성이 큼)는 기본으로 체크 해제한다.
  const [selected, setSelected] = useState(
    () => new Set(candidates.filter((c) => c.inDictionary).map((c) => c.id)),
  );
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

  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = () =>
    startSaving(async () => {
      const result = await saveReview(documentId, [...selected]);
      if (result?.error) setError(result.error);
    });

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
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="ml-auto rounded bg-black px-4 py-1 text-white disabled:opacity-50"
        >
          {saving ? "뜻과 발음을 채우는 중…" : "저장"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
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
                {!c.inDictionary && (
                  <span className="ml-2 rounded bg-yellow-100 px-1 text-xs">사전에 없음</span>
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
