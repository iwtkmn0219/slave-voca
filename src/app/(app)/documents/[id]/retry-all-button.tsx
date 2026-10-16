"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/status";
import { regenerateDocumentMeanings } from "./actions";

// 안내 줄의 "모두 다시 시도": 이 문서의 실패한 뜻을 한 번에 다시 만든다.
export function RetryAllButton({ documentId }: { documentId: number }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const retry = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await regenerateDocumentMeanings(documentId, []);
      if (result.error !== null) setMessage(result.error);
      else if (result.failed > 0) setMessage(`${result.done}개를 채웠고 ${result.failed}개는 다시 실패했습니다.`);
    });

  return (
    <>
      <button
        type="button"
        onClick={retry}
        disabled={pending}
        className="ml-1.5 inline-flex items-center gap-1.5 font-semibold text-accent hover:underline disabled:opacity-55"
      >
        {pending && <Spinner />}
        {pending ? "다시 만드는 중…" : "모두 다시 시도"}
      </button>
      {message && (
        <span role="alert" className="ml-2 text-again">
          {message}
        </span>
      )}
    </>
  );
}
