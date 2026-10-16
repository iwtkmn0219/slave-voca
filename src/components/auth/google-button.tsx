// Google 로그인 버튼(화면 규칙 2.2, Google 브랜드 가이드: 높이 40px, 모서리 4px, 안쪽 1px 테두리,
// 로고 왼쪽 12px, 글자 14/20 Medium). 색은 --g-* 토큰(라이트/다크)만 쓰고 앱 토큰을 섞지 않는다.
// 로고는 Google이 배포하는 표준 색 "G"(48×48)이며 모양과 색을 고치지 않는다.
function GoogleG() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="absolute top-2.5 left-3 size-5">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

// busy: Google로 넘어가는 동안. disabled + aria-busy로 두 번 눌러도 요청은 한 번만 간다.
export function GoogleButton({ busy = false, onClick }: { busy?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={onClick}
      className="relative flex h-10 w-full items-center justify-center rounded-[4px] bg-(--g-fill) pr-3 pl-[42px] text-sm leading-5 font-medium text-(--g-text) shadow-[inset_0_0_0_1px_var(--g-stroke)] [font-family:'Google_Sans',var(--font-sans)] hover:bg-[color-mix(in_srgb,var(--g-text)_8%,var(--g-fill))] disabled:cursor-progress"
    >
      <GoogleG />
      <span className={busy ? "opacity-60" : ""}>Google 계정으로 계속하기</span>
    </button>
  );
}
