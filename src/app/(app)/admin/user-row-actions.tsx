"use client";

import { useState, useTransition } from "react";
import { setUserStatusAction } from "./actions";

// 행마다 할 수 있는 동작: 대기 → 승인/차단, 승인됨 → 차단, 차단됨 → 차단 해제. 자기 자신은 차단할 수 없다.
export function UserRowActions({ userId, status, isSelf }: { userId: string; status: string; isSelf: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (next: "approved" | "blocked") =>
    start(async () => {
      setError((await setUserStatusAction(userId, next)).error);
    });
  const button = "rounded-md px-3 py-1 text-sm font-semibold hover:bg-sunken disabled:opacity-60";
  return (
    <span className="inline-flex items-center gap-1">
      {status !== "approved" && (
        <button type="button" disabled={pending} onClick={() => run("approved")} className={button}>
          {status === "blocked" ? "차단 해제" : "승인"}
        </button>
      )}
      {status !== "blocked" && !isSelf && (
        <button type="button" disabled={pending} onClick={() => run("blocked")} className={`${button} text-danger`}>
          차단
        </button>
      )}
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
