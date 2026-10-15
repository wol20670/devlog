// GitHub REST 응답 헤더·오류 분류. 순수 로직.

export type RateLimitInfo = {
  remaining: number | null;
  resetAt: Date | null;
  retryAfterSeconds: number | null;
};

type HeaderSource = { get(name: string): string | null };

function numHeader(headers: HeaderSource, name: string): number | null {
  const v = headers.get(name);
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseRateLimit(headers: HeaderSource): RateLimitInfo {
  const reset = numHeader(headers, "x-ratelimit-reset");
  return {
    remaining: numHeader(headers, "x-ratelimit-remaining"),
    resetAt: reset === null ? null : new Date(reset * 1000),
    retryAfterSeconds: numHeader(headers, "retry-after"),
  };
}

export type GithubErrorKind =
  | "unauthorized"
  | "rate_limited"
  | "forbidden"
  | "not_found"
  | "server"
  | "unknown";

export function classifyGithubError(
  status: number,
  headers: HeaderSource,
  now: Date = new Date(),
): { kind: GithubErrorKind; resetAt?: Date } {
  if (status === 401) return { kind: "unauthorized" };
  const rl = parseRateLimit(headers);
  const limited =
    status === 429 ||
    (status === 403 && (rl.remaining === 0 || rl.retryAfterSeconds !== null));
  if (limited) {
    const resetAt =
      rl.retryAfterSeconds !== null
        ? new Date(now.getTime() + rl.retryAfterSeconds * 1000)
        : (rl.resetAt ?? undefined);
    return resetAt ? { kind: "rate_limited", resetAt } : { kind: "rate_limited" };
  }
  if (status === 403) return { kind: "forbidden" };
  if (status === 404) return { kind: "not_found" };
  if (status >= 500) return { kind: "server" };
  return { kind: "unknown" };
}

/** Link 헤더에 rel="next"가 있는지 확인한다. */
export function hasNextPage(linkHeader: string | null | undefined): boolean {
  if (!linkHeader) return false;
  return /<[^>]*>\s*;[^,]*\brel="?next"?/.test(linkHeader);
}
