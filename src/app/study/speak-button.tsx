"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

// 브라우저 내장 음성 합성(Web Speech API)으로 단어를 읽는다. 지원하지 않으면 버튼을 숨긴다.
export function SpeakButton({ text }: { text: string }) {
  const supported = useSyncExternalStore(subscribe, canSpeak, () => false);
  if (!supported) return null;

  const speak = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={`${text} 발음 듣기`}
      className="rounded border px-2 py-1 text-sm"
    >
      🔊 듣기
    </button>
  );
}
