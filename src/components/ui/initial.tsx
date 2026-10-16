import { initialOf } from "@/lib/auth/display";

// 머리글자 원(화면 규칙 3.2, 5.2). 프로필 사진은 쓰지 않는다.
const SIZE = {
  sm: "size-6 text-xs",
  md: "size-8 text-sm",
} as const;

export function Initial({ name, email, size = "md" }: { name: string; email: string; size?: keyof typeof SIZE }) {
  return (
    <span
      aria-hidden
      className={`inline-grid flex-none place-items-center rounded-full bg-accent-soft font-bold text-accent ${SIZE[size]}`}
    >
      {initialOf(name, email)}
    </span>
  );
}
