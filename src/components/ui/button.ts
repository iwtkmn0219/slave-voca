// 버튼과 버튼처럼 보이는 링크가 같은 모양을 쓰도록 클래스만 만든다.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-accent bg-accent text-on-accent hover:bg-accent-hover hover:border-accent-hover",
  secondary: "border-line-strong bg-surface text-ink hover:bg-sunken",
  ghost: "border-transparent bg-transparent text-ink-2 hover:bg-sunken",
  danger: "border-again bg-again text-on-accent",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-[13px]",
  md: "px-3.5 py-2 text-sm",
};

export function buttonClass(
  { variant = "secondary", size = "md" }: { variant?: ButtonVariant; size?: ButtonSize } = {},
  extra = "",
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim();
}
