import { revalidatePath } from "next/cache";
import { isId, isJsonContentType } from "@/lib/validate";
import { getDb } from "@/server/db/client";
import { defaultMeaningModel } from "@/server/services/enrich";
import { regenerateUsageMeaning } from "@/server/services/usage-meaning";

// 복습 카드 뒷면의 "뜻 다시 만들기". Server Action이 아닌 Route Handler인 이유: 한 클라이언트의 Server Action은
// 차례로 실행되어, 뜻을 만드는 몇 초 동안 1·2·3 응답 저장이 줄을 서 버린다. fetch는 그 줄에 들어가지 않는다.
export async function POST(request: Request) {
  // 다른 사이트가 보낸 요청을 거르려고 Content-Type이 정확히 application/json인 것만 받는다(그 형식의 교차 출처
  // 요청은 브라우저가 사전 확인(preflight)을 거치고, 이 앱은 CORS를 열지 않는다).
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 415 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const occurrenceId = typeof body === "object" && body !== null ? (body as { occurrenceId?: unknown }).occurrenceId : undefined;
  // DB를 열기 전에 형태부터 거른다.
  if (!isId(occurrenceId)) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const result = await regenerateUsageMeaning(getDb(), occurrenceId, defaultMeaningModel());
  if (result.error === null) revalidatePath("/documents", "layout"); // 문서 단어 목록에도 새 뜻이 보이게 한다
  return Response.json(result);
}
