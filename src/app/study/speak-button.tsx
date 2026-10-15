"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function useCanSpeak(): boolean {
  return useSyncExternalStore(subscribe, canSpeak, () => false);
}

// 브라우저 내장 음성 합성(Web Speech API)으로 읽는다. 단축키(P)도 이 함수를 쓴다.
export function speak(text: string) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

// 지원하지 않으면 버튼을 숨긴다. 서버 렌더에서는 숨김으로 시작한다.
export function SpeakButton({ text }: { text: string }) {
  const supported = useCanSpeak();
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() => speak(text)}
      aria-label={`${text} 발음 듣기`}
      className="grid size-9 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink-2 hover:bg-sunken"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}
