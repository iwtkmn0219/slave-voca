import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Notice } from "@/components/ui/notice";
import { loginNoticeKind } from "@/lib/auth/display";
import { accessRedirect, devLoginEnabled, safeNextPath } from "@/lib/auth/policy";
import { getSessionUser } from "@/server/auth/current-user";
import { DevLoginForm, GoogleSignInButton } from "./login-buttons";

export const metadata: Metadata = { title: "로그인 · slave-voca" };

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <>
      <h1 className="text-2xl leading-[1.35] font-bold tracking-[-0.01em]">
        논문에서 만난 단어를<br className="max-sm:hidden" /> 그 문장의 뜻으로 외웁니다
      </h1>
      <p className="mt-2.5 mb-6 text-[15px] leading-[1.6] text-ink-2">
        PDF를 올리면 어려운 영어 단어를 골라 문장 속 뜻과 발음기호를 붙이고, 간격 반복으로 복습하게 합니다.
      </p>
      <p className="mb-1.5 text-xs font-semibold text-muted">이런 카드가 만들어집니다</p>
      {/* 이 앱이 만드는 카드 한 장. 장식이라 읽지 않고, DB를 읽지 않는 고정 HTML이다. */}
      <div aria-hidden className="mb-6 rounded-lg border border-line bg-surface px-5 pt-[18px] pb-4 shadow-1">
        <div className="font-en text-[26px] leading-[1.15] font-bold">ubiquitous</div>
        <div className="mt-1 font-en text-base text-muted">/juːˈbɪkwɪtəs/</div>
        <div className="mt-2.5 text-[17px] font-bold">어디서나 널리 쓰이는</div>
        <div className="mt-2 border-t border-line pt-2.5 font-en text-[14.5px] leading-[1.55] text-ink-2">
          Self-attention has become <mark>ubiquitous</mark> in sequence modeling tasks.
        </div>
      </div>
      <Suspense fallback={<div className="h-10" />}>
        <LoginActions searchParams={props.searchParams} />
      </Suspense>
      <p className="mt-3.5 text-[13px] text-muted">
        초대받은 분만 쓸 수 있습니다. 처음 로그인하면 관리자가 승인한 뒤부터 쓸 수 있습니다.
      </p>
    </>
  );
}

async function LoginActions({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  await connection();
  // 이미 로그인했으면 상태에 맞는 화면으로 보낸다.
  const { error, next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);
  const user = await getSessionUser();
  if (user) redirect(accessRedirect(user) ?? next);
  const notice = loginNoticeKind(error);
  return (
    <>
      {notice === "cancelled" && (
        <Notice tone="neutral" className="mb-3">
          로그인을 취소했습니다. 계속하려면 아래 버튼을 다시 눌러 주세요.
        </Notice>
      )}
      {notice === "error" && (
        <Notice tone="error" className="mb-3">
          로그인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.
        </Notice>
      )}
      <GoogleSignInButton next={next} />
      {devLoginEnabled(process.env) && <DevLoginForm next={next} />}
    </>
  );
}
