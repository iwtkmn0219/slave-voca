"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { isNativeSpaceTarget, isTypingTarget } from "@/lib/ui/keys";

// 홈의 "복습 시작". 화면 어디서나 Enter로도 시작한다(입력칸·버튼 위에서는 그 요소가 Enter를 받는다).
export function StartStudyButton() {
  const router = useRouter();
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLInputElement | null;
      if (e.key !== "Enter" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(target) || isNativeSpaceTarget(target) || target?.tagName === "A") return;
      router.push("/study");
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [router]);

  return (
    <Link href="/study" className={buttonClass({ variant: "primary" })}>
      복습 시작 <Kbd onAccent>Enter</Kbd>
    </Link>
  );
}
