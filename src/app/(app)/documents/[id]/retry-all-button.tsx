"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/ui/notice";
import { Failed, Spinner } from "@/components/ui/status";
import { LIMIT_REGEN } from "@/lib/regen-messages";
import { regenerateDocumentMeanings } from "./actions";

type Outcome = { kind: "failed"; text: string } | { kind: "limit"; resetsOn: string };

// 실패한 뜻 안내 줄과 "모두 다시 시도". 이 문서의 실패한 뜻을 한 번에 다시 만든다.
// 한도에 걸리면 안내 줄 아래에 따로 Notice로 알린다(C 화면 규칙 4.2. 실패 표시가 아니다).
export function FailedMeaningsNotice({
  documentId,
  failed,
  missingKey,
}: {
  documentId: number;
  failed: number;
  missingKey: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const retry = () =>
    startTransition(async () => {
      setOutcome(null);
      const result = await regenerateDocumentMeanings(documentId, []);
      if (result.error !== null) {
        setOutcome(
          result.limitResetsOn ? { kind: "limit", resetsOn: result.limitResetsOn } : { kind: "failed", text: result.error },
        );
      } else if (result.failed > 0) {
        setOutcome({ kind: "failed", text: `${result.done}개를 채웠고 ${result.failed}개는 다시 실패했습니다.` });
      }
    });

  return (
    <>
      <Notice className="mt-4">
        뜻 <span className="tabular-nums">{failed}</span>개를 만들지 못했습니다
        {missingKey ? (
          <>
            {" "}
            · GEMINI_API_KEY 없음. <span className="text-muted">.env.local에 키를 넣고 서버를 다시 시작하세요.</span>
          </>
        ) : (
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
            {outcome?.kind === "failed" && (
              <span role="alert" className="ml-2">
                <Failed>{outcome.text}</Failed>
              </span>
            )}
          </>
        )}
      </Notice>
      {outcome?.kind === "limit" && <Notice className="mt-2">{LIMIT_REGEN(outcome.resetsOn)}</Notice>}
    </>
  );
}
