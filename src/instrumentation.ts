import type { Instrumentation } from "next";

// 처리하지 못한 서버 오류를 관리자에게 알린다(C-1). 같은 오류는 10분에 한 번만 보낸다.
// redirect·notFound처럼 Next가 흐름 제어에 쓰는 예외(digest가 NEXT_로 시작)는 오류가 아니다.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : "";
  if (digest.startsWith("NEXT_")) return;
  const { notifyServerError } = await import("./server/alerts/notify");
  // 주소의 검색어(?…)는 넣지 않는다.
  await notifyServerError(`${request.method} ${request.path.split("?")[0]} · ${context.routeType}`, err);
};
