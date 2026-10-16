"use client";

import { useState } from "react";
import { Initial } from "@/components/ui/initial";
import { SignOutButton } from "./sign-out-button";

// 계정 버튼 + 네이티브 popover(화면 규칙 5.2). Esc·바깥 클릭으로 닫히고 포커스가 버튼으로 돌아오는 동작은
// 브라우저가 한다. role="menu"는 쓰지 않는다(화살표 키 이동을 만들지 않으므로). 버튼의 aria-expanded만 맞춘다.
export function AccountMenuButton({ name, fullName, email }: { name: string; fullName: string; email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span aria-hidden className="mr-2 ml-2 h-5 w-px bg-line" />
      <button
        type="button"
        popoverTarget="account-popover"
        aria-expanded={open}
        aria-label={`계정: ${name}`}
        className={`inline-flex items-center gap-2 rounded-md py-1 pr-2 pl-1 text-sm text-ink-2 hover:bg-sunken ${
          open ? "bg-sunken" : ""
        }`}
      >
        <Initial name={fullName} email={email} size="sm" />
        <span className="max-w-[140px] truncate max-sm:hidden">{name}</span>
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 text-muted">
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        id="account-popover"
        popover="auto"
        aria-label="계정"
        onToggle={(e) => setOpen((e.nativeEvent as ToggleEvent).newState === "open")}
        className="fixed top-12 right-4 left-auto m-0 w-[260px] rounded-lg border border-line bg-surface p-1.5 text-ink shadow-2"
      >
        <div className="mb-1.5 border-b border-line px-2.5 pt-2.5 pb-3">
          <b className="block text-sm font-semibold">{name}</b>
          <span className="block text-[13px] [overflow-wrap:anywhere] text-muted">{email}</span>
        </div>
        <SignOutButton variant="menu-item" />
      </div>
    </>
  );
}
