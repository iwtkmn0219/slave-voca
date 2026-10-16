"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function GoogleSignInButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        // 성공하면 Google에서 돌아와 홈(→ 상태에 맞는 화면)으로, 실패하면 이 화면에 error를 붙여 돌아온다.
        const { error } = await authClient.signIn.social({ provider: "google", callbackURL: next, errorCallbackURL: "/login" });
        if (error) setBusy(false);
      }}
      className="w-full rounded-md border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-sunken disabled:opacity-60"
    >
      Google로 계속하기
    </button>
  );
}

const DEV_PASSWORD = "dev-login-password";

// 개발 전용 로그인: 이 컴퓨터 주소에서 AUTH_DEV_LOGIN=1일 때만 서버가 그린다. 없는 이메일은 가입시킨다.
export function DevLoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  return (
    <form
      className="mt-6 grid gap-2 border-t border-line pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setMessage("");
        const signIn = await authClient.signIn.email({ email, password: DEV_PASSWORD });
        if (signIn.error) {
          const signUp = await authClient.signUp.email({ email, password: DEV_PASSWORD, name: email.split("@")[0] });
          if (signUp.error) return setMessage(signUp.error.message ?? "실패했습니다.");
        }
        // 사용자가 바뀌었으므로 화면을 통째로 다시 연다. 클라이언트 이동은 이전 화면이 겹쳐 남고,
        // 브라우저의 라우터 캐시에 다른 사용자의 화면이 남을 수 있다.
        window.location.assign(next);
      }}
    >
      <label htmlFor="dev-email" className="text-xs font-semibold text-muted">
        개발용 로그인(이 컴퓨터에서만)
      </label>
      <input
        id="dev-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
      />
      <button type="submit" className="rounded-md bg-sunken px-3 py-2 text-sm font-semibold">
        들어가기
      </button>
      {message && <p className="text-sm text-danger">{message}</p>}
    </form>
  );
}
