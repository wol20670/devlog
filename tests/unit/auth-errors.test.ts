import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "@/lib/auth-errors";

const DEFAULT = "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
const EXPIRED = "로그인 요청 시간이 만료되었습니다. 다시 로그인해 주세요.";
const DENIED = "GitHub 로그인 권한 요청이 취소되었습니다.";

describe("loginErrorMessage", () => {
  it("state_mismatch는 만료 메시지", () => {
    expect(loginErrorMessage("state_mismatch")).toBe(EXPIRED);
  });
  it("중복 키 배열에서도 state_mismatch를 찾는다", () => {
    expect(loginErrorMessage(["oauth", "state_mismatch"])).toBe(EXPIRED);
  });
  it("access_denied는 취소 메시지", () => {
    expect(loginErrorMessage("access_denied")).toBe(DENIED);
    expect(loginErrorMessage(["oauth", "access_denied"])).toBe(DENIED);
  });
  it("그 외는 기본 메시지", () => {
    expect(loginErrorMessage("oauth")).toBe(DEFAULT);
    expect(loginErrorMessage("")).toBe(DEFAULT);
    expect(loginErrorMessage(undefined)).toBe(DEFAULT);
    expect(loginErrorMessage([])).toBe(DEFAULT);
  });
});
