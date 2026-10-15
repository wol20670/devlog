import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// runtime을 명시하지 않는다. Next 16 기본값이 Node.js이고,
// cacheComponents 활성 시 `export const runtime`은 빌드 에러가 난다.
export const { GET, POST } = toNextJsHandler(auth);
