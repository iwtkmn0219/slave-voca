import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db/client";
import { defaultMeaningModel } from "@/server/services/enrich";
import { regenerateUsageMeaning } from "@/server/services/usage-meaning";

// 복습 카드 뒷면의 "뜻 다시 만들기". Server Action이 아닌 Route Handler인 이유: 한 클라이언트의 Server Action은
// 차례로 실행되어, 뜻을 만드는 몇 초 동안 1·2·3 응답 저장이 줄을 서 버린다. fetch는 그 줄에 들어가지 않는다.
export async function POST(request: Request) {
  // 다른 사이트가 보낸 폼 전송을 거르려고 JSON 본문만 받는다(교차 출처 JSON 요청은 사전 확인을 거친다).
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 415 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const occurrenceId = typeof body === "object" && body !== null ? (body as { occurrenceId?: unknown }).occurrenceId : undefined;
  const result = await regenerateUsageMeaning(getDb(), occurrenceId, defaultMeaningModel());
  if (result.error === null) revalidatePath("/documents", "layout"); // 문서 단어 목록에도 새 뜻이 보이게 한다
  return Response.json(result);
}
