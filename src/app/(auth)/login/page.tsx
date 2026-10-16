import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { accessRedirect, devLoginEnabled, safeNextPath } from "@/lib/auth/policy";
import { getSessionUser } from "@/server/auth/current-user";
import { DevLoginForm, GoogleSignInButton } from "./login-buttons";

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <>
      <h1 className="text-[22px] font-bold">slave-voca</h1>
      <p className="mt-2 text-sm text-muted">논문 PDF에서 어려운 단어를 뽑아 문맥 뜻 카드로 외웁니다.</p>
      <Suspense fallback={<div className="mt-6 h-10" />}>
        <LoginActions searchParams={props.searchParams} />
      </Suspense>
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
  return (
    <>
      {error !== undefined && (
        <p role="alert" className="mt-4 text-sm text-danger">
          로그인하지 못했습니다. 다시 시도해 주세요.
        </p>
      )}
      <div className="mt-6">
        <GoogleSignInButton next={next} />
      </div>
      {devLoginEnabled(process.env) && <DevLoginForm next={next} />}
    </>
  );
}
