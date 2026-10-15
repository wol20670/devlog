import { describe, expect, it } from "vitest";
import { classifyGithubError, hasNextPage, parseRateLimit } from "@/lib/github/http";

const h = (o: Record<string, string>) => new Headers(o);

describe("parseRateLimit", () => {
  it("헤더 파싱", () => {
    const r = parseRateLimit(
      h({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1760000000", "retry-after": "30" }),
    );
    expect(r.remaining).toBe(0);
    expect(r.resetAt?.getTime()).toBe(1760000000 * 1000);
    expect(r.retryAfterSeconds).toBe(30);
  });
  it("없으면 null", () => {
    expect(parseRateLimit(h({}))).toEqual({
      remaining: null,
      resetAt: null,
      retryAfterSeconds: null,
    });
  });
});

describe("classifyGithubError", () => {
  it("401 -> unauthorized", () => {
    expect(classifyGithubError(401, h({})).kind).toBe("unauthorized");
  });
  it("403 + remaining 0 -> rate_limited with resetAt", () => {
    const c = classifyGithubError(
      403,
      h({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1760000000" }),
    );
    expect(c.kind).toBe("rate_limited");
    expect(c.resetAt?.getTime()).toBe(1760000000 * 1000);
  });
  it("403 + remaining > 0 -> forbidden", () => {
    expect(classifyGithubError(403, h({ "x-ratelimit-remaining": "10" })).kind).toBe("forbidden");
  });
  it("429 + retry-after -> rate_limited, now + retry-after", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    const c = classifyGithubError(429, h({ "retry-after": "60" }), now);
    expect(c.kind).toBe("rate_limited");
    expect(c.resetAt?.toISOString()).toBe("2026-10-15T00:01:00.000Z");
  });
  it("404 / 500 / 기타", () => {
    expect(classifyGithubError(404, h({})).kind).toBe("not_found");
    expect(classifyGithubError(500, h({})).kind).toBe("server");
    expect(classifyGithubError(418, h({})).kind).toBe("unknown");
  });
});

describe("hasNextPage", () => {
  it("rel=next 존재", () => {
    expect(
      hasNextPage(
        '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=3>; rel="last"',
      ),
    ).toBe(true);
  });
  it("next 없음", () => {
    expect(hasNextPage('<https://api.github.com/x?page=1>; rel="prev"')).toBe(false);
    expect(hasNextPage(null)).toBe(false);
    expect(hasNextPage("")).toBe(false);
  });
});
