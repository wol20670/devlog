import { describe, expect, it, vi, afterEach } from "vitest";
import { redactLogValue } from "../../src/lib/log-redaction";
import { authLog } from "../../src/lib/auth-logger";

const SECRET = "secret-token-abc";
const QUERY = 'select "id" from "session" where "token" = $1';

function makeDbError() {
  const err = new Error(
    `Failed query: ${QUERY}\nparams: ${SECRET}`,
    { cause: new Error("Connection terminated due to connection timeout") },
  ) as Error & { query: string; params: string[] };
  err.query = QUERY;
  err.params = [SECRET];
  return err;
}

function dump(value: unknown): string {
  const parts: string[] = [];
  let cur: unknown = value;
  let guard = 0;
  while (cur instanceof Error && guard++ < 10) {
    parts.push(String(cur.message), String(cur.stack));
    parts.push(JSON.stringify(cur));
    cur = cur.cause;
  }
  return parts.join("\n");
}

describe("redactLogValue", () => {
  it("DB 오류에서 params를 제거하고 query와 cause는 유지한다", () => {
    const out = redactLogValue(makeDbError()) as Error & {
      query: string;
      params: unknown;
    };
    const text = dump(out);
    expect(text).not.toContain(SECRET);
    expect(out.params).toBe("[redacted]");
    expect(out.query).toBe(QUERY);
    expect(out.message).toContain(QUERY);
    expect((out.cause as Error).message).toBe(
      "Connection terminated due to connection timeout",
    );
  });

  it("원본 객체를 변경하지 않는다", () => {
    const err = makeDbError();
    redactLogValue(err);
    expect(err.message).toContain(SECRET);
    expect(err.params).toEqual([SECRET]);
  });

  it("순환 cause를 처리한다", () => {
    const a = new Error("a params: x") as Error & { cause?: unknown };
    const b = new Error("b") as Error & { cause?: unknown };
    a.cause = b;
    b.cause = a;
    expect(() => redactLogValue(a)).not.toThrow();
  });

  it("문자열 입력", () => {
    const out = redactLogValue(`Failed query\nparams: ${SECRET}\nnext`);
    expect(out).toBe("Failed query\nparams: [redacted]\nnext");
  });

  it("일반 객체의 params 키", () => {
    const out = redactLogValue({ params: [SECRET], query: QUERY, n: 1 });
    expect(out).toEqual({ params: "[redacted]", query: QUERY, n: 1 });
  });

  it("그 외 값은 그대로", () => {
    expect(redactLogValue(42)).toBe(42);
    expect(redactLogValue(null)).toBeNull();
  });
});

describe("authLog", () => {
  afterEach(() => vi.restoreAllMocks());

  it("console 출력에 비밀값이 없다", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    authLog("error", "INTERNAL_SERVER_ERROR", makeDbError());
    expect(spy).toHaveBeenCalledOnce();
    const printed = spy.mock.calls
      .flat()
      .map((v) => (v instanceof Error ? dump(v) : JSON.stringify(v)))
      .join("\n");
    expect(printed).not.toContain(SECRET);
    expect(printed).toContain("Connection terminated");
  });
});
