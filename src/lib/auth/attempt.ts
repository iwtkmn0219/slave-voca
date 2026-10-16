// 로그인·로그아웃 같은 Better Auth 클라이언트 호출이 성공했는지. 오류 응답({ error })과 네트워크 예외를 모두 실패로 본다.
export async function succeeded(call: () => Promise<{ error?: unknown } | null | undefined>): Promise<boolean> {
  try {
    const result = await call();
    return !result?.error;
  } catch {
    return false;
  }
}
