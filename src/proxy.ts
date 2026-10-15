import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// 낙관적 리다이렉트 전용이다. 쿠키 존재만 확인하며 보안 경계가 아니다.
// 실제 인증·인가는 서버(requireUser)에서 DB 세션으로 검증한다.
// 쿠키가 있어도 세션이 무효일 수 있으므로 /login → /dashboard 리다이렉트는
// 여기서 하지 않는다(루프 방지). /login 페이지가 DB 세션으로 판단한다.
const PROTECTED = ["/dashboard", "/projects", "/logs", "/reviews", "/github"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isProtected && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

// 보호 경로에만 실행한다(api, _next, 정적 파일은 자동 제외).
// 부정 lookahead 방식 matcher는 이 환경(dev)에서 동작하지 않아 명시 목록을 쓴다.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/logs/:path*",
    "/reviews/:path*",
    "/github/:path*",
  ],
};
