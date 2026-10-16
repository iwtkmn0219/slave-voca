"use client";

import { useState } from "react";
import { GoogleButton } from "@/components/auth/google-button";
import { buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { succeeded } from "@/lib/auth/attempt";
import { authClient } from "@/lib/auth/client";

export function GoogleSignInButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      {failed && (
        <Notice tone="error" className="mb-3">
          로그인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.
        </Notice>
      )}
      <GoogleButton
        busy={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          // 성공하면 Google로 넘어가고, Google에서 실패하면 이 화면에 error를 붙여 돌아온다.
          // Google로 넘어가기 전의 실패(네트워크, 서버 오류)는 여기서 알리고 버튼을 다시 쓸 수 있게 한다.
          const ok = await succeeded(() =>
            authClient.signIn.social({ provider: "google", callbackURL: next, errorCallbackURL: "/login" }),
          );
          if (!ok) {
            setBusy(false);
            setFailed(true);
          }
        }}
      />
    </>
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
        className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm"
      />
      <button type="submit" className={buttonClass({ variant: "secondary" })}>
        들어가기
      </button>
      {message && <p className="text-sm text-again">{message}</p>}
    </form>
  );
}
