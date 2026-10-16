"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Failed, Status } from "@/components/ui/status";
import { effectiveStatus } from "@/lib/auth/display";
import type { UserRole, UserStatus } from "@/server/db/auth-schema";
import { setUserStatusAction } from "./actions";

export interface UserRowData {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  role: UserRole;
  joined: string;
  monthWords: number; // 이번 달(한국 시간) 뜻을 만든 단어 수
}

type NextStatus = "approved" | "blocked";

// 사용자 표(화면 규칙 6장). 처리한 뒤에도 행은 그 자리에 둔다: 처음 그려진 순서를 기억하고, 상태만 그 자리에서 바꾼다.
// 다음에 화면을 열 때 서버가 다시 정렬한다.
export function UserTable({ rows, selfId, wordLimit }: { rows: UserRowData[]; selfId: string; wordLimit: number }) {
  const [initial] = useState(() => ({
    order: rows.map((r) => r.id),
    pendingCount: rows.filter((r) => r.status === "pending").length,
  }));
  // 이 화면에서 바꾼 상태. 서버 값이 바꾸기 전 값 그대로인 동안만 보여 준다(effectiveStatus).
  const [statuses, setStatuses] = useState<Record<string, { from: UserStatus; to: UserStatus }>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [announcement, setAnnouncement] = useState("");
  const focusAfter = useRef<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = [
    ...initial.order.flatMap((id) => byId.get(id) ?? []),
    ...rows.filter((r) => !initial.order.includes(r.id)), // 화면을 연 뒤 새로 가입한 사람은 맨 아래
  ];

  // 처리가 끝나 버튼 모양이 바뀌면(승인 → 사용 중지) 그 행의 첫 버튼으로 포커스를 옮긴다(6.5).
  useEffect(() => {
    if (focusAfter.current === null) return;
    rowRefs.current[focusAfter.current]?.querySelector("button")?.focus();
    focusAfter.current = null;
  }, [statuses]);

  async function change(user: UserRowData, current: UserStatus, next: NextStatus) {
    setBusy((b) => ({ ...b, [user.id]: true }));
    setFailed((f) => ({ ...f, [user.id]: false }));
    let error: string | null = "failed";
    try {
      error = (await setUserStatusAction(user.id, next)).error;
    } catch {
      error = "failed";
    }
    setBusy((b) => ({ ...b, [user.id]: false }));
    if (error) {
      setFailed((f) => ({ ...f, [user.id]: true }));
      return;
    }
    const who = user.name.trim() || user.email;
    focusAfter.current = user.id;
    setStatuses((s) => ({ ...s, [user.id]: { from: user.status, to: next } }));
    setAnnouncement(
      next === "blocked"
        ? `${who} 님의 사용을 멈췄습니다`
        : current === "blocked"
          ? `${who} 님을 다시 허용했습니다`
          : `${who} 님을 승인했습니다`,
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-1">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-line text-left text-xs font-semibold text-muted">
            <th className="px-4 py-2.5 font-semibold">사용자</th>
            <th className="w-[130px] px-4 py-2.5 font-semibold">상태</th>
            <th className="w-[130px] px-4 py-2.5 text-right font-semibold">이번 달 단어</th>
            <th className="w-[120px] px-4 py-2.5 font-semibold">가입</th>
            <th className="w-[150px] px-4 py-2.5 text-right font-semibold">동작</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((user, index) => {
            const status = effectiveStatus(user.status, statuses[user.id]);
            const isSelf = user.id === selfId;
            const isBusy = busy[user.id] === true;
            const hasName = user.name.trim() !== "";
            const run = (next: NextStatus) => {
              if (!isBusy) void change(user, status, next);
            };
            const action = (variant: "primary" | "secondary" | "ghost", label: string, next: NextStatus) => (
              <button
                type="button"
                aria-disabled={isBusy}
                onClick={() => run(next)}
                className={buttonClass({ variant, size: "sm" }, "aria-disabled:cursor-not-allowed aria-disabled:opacity-55")}
              >
                {label}
              </button>
            );
            return (
              <FragmentRow key={user.id} divider={index === initial.pendingCount && initial.pendingCount > 0}>
                <tr
                  ref={(el) => {
                    rowRefs.current[user.id] = el;
                  }}
                  className="border-b border-line align-middle last:border-b-0 hover:bg-sunken"
                >
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-1.5 font-semibold">
                      {hasName ? user.name : user.email}
                      {isSelf && (
                        <span className="rounded-sm border border-line-strong px-1.5 py-px text-[11.5px] font-semibold whitespace-nowrap text-muted">
                          나
                        </span>
                      )}
                    </div>
                    {hasName && <div className="text-[13px] [overflow-wrap:anywhere] text-muted">{user.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {isBusy ? (
                      <Status tone="busy">바꾸는 중</Status>
                    ) : status === "pending" ? (
                      <Status tone="wait">승인 대기</Status>
                    ) : status === "blocked" ? (
                      <Status tone="idle">사용 중지</Status>
                    ) : (
                      <Status tone="ok">{user.role === "admin" ? "관리자" : "승인됨"}</Status>
                    )}
                    {failed[user.id] && !isBusy && (
                      <div role="alert" className="mt-1">
                        <Failed>바꾸지 못했습니다</Failed>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm whitespace-nowrap tabular-nums">
                    <MonthWords value={user.monthWords} limit={wordLimit} />
                  </td>
                  <td className="px-4 py-3 text-[13px] whitespace-nowrap text-ink-2 tabular-nums">{user.joined}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {!isSelf && (
                      <span className="inline-flex items-center gap-1.5">
                        {status === "pending" && action("primary", "승인", "approved")}
                        {status !== "blocked" && action("ghost", "사용 중지", "blocked")}
                        {status === "blocked" && action("secondary", "다시 허용", "approved")}
                      </span>
                    )}
                  </td>
                </tr>
              </FragmentRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// 대기 묶음과 나머지 사이의 2px 구분선(화면 규칙 6.3). 대기가 없으면 그리지 않는다.
function FragmentRow({ divider, children }: { divider: boolean; children: React.ReactNode }) {
  return (
    <>
      {divider && (
        <tr aria-hidden>
          <td colSpan={5} className="h-0 border-b-2 border-line-strong p-0" />
        </tr>
      )}
      {children}
    </>
  );
}

// "이번 달 단어" 칸(C 화면 규칙 5.3). 한도에 닿았으면 hard 점과 "한도"를 붙인다.
function MonthWords({ value, limit }: { value: number; limit: number }) {
  const text = value.toLocaleString("ko-KR");
  if (value === 0) return <span className="text-muted">0</span>;
  if (value < limit) return <span>{text}</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-[7px] rounded-full bg-hard" />
      {text} <span className="text-[13px] text-ink-2">한도</span>
    </span>
  );
}
