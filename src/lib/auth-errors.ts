const DEFAULT_MESSAGE = "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
const EXPIRED_MESSAGE = "로그인 요청 시간이 만료되었습니다. 다시 로그인해 주세요.";
const DENIED_MESSAGE = "GitHub 로그인 권한 요청이 취소되었습니다.";

// error 쿼리는 중복 키로 배열이 될 수 있다(예: ?error=oauth&error=state_mismatch).
export function loginErrorMessage(
  error: string | string[] | undefined,
): string {
  const codes = (Array.isArray(error) ? error : [error])
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.toLowerCase());

  if (codes.some((c) => c.includes("state"))) return EXPIRED_MESSAGE;
  if (codes.includes("access_denied")) return DENIED_MESSAGE;
  return DEFAULT_MESSAGE;
}
