import { createAuthClient } from "better-auth/react";

// 브라우저에서 쓰는 Better Auth 클라이언트. 같은 주소의 /api/auth를 부른다.
export const authClient = createAuthClient();
