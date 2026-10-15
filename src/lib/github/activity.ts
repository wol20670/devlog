// GitHub 활동 조회 핵심 로직. DB·Better Auth에 의존하지 않아 fake fetch로 테스트할 수 있다.
// 토큰은 요청 헤더에만 쓰이며 반환값·오류 메시지에 포함하지 않는다.
import {
  normalizeEvent,
  summarizeEvents,
  type EventSummary,
  type NormalizedEvent,
} from "@/lib/github/events";
import {
  classifyGithubError,
  hasNextPage,
  type GithubErrorKind,
} from "@/lib/github/http";

const API_BASE = "https://api.github.com";
const PER_PAGE = 100;
const MAX_PAGES = 3;

export type GithubActivityErrorKind =
  | GithubErrorKind
  | "no_account"
  | "account_mismatch"
  | "network";

export type GithubActivityError = {
  kind: GithubActivityErrorKind;
  resetAt?: Date;
  message: string;
};

export type GithubActivityData = {
  login: string;
  profileUrl: string;
  events: NormalizedEvent[];
  summary: EventSummary;
  fetchedAt: Date;
  pagesFetched: number;
};

export type GithubActivityResult =
  | { ok: true; data: GithubActivityData }
  | { ok: false; error: GithubActivityError };

type FetchImpl = typeof fetch;

const MESSAGES: Record<GithubActivityErrorKind, string> = {
  no_account: "연결된 GitHub 계정이 없습니다.",
  unauthorized: "GitHub 인증에 실패했습니다.",
  account_mismatch: "GitHub 계정 정보가 일치하지 않습니다.",
  rate_limited: "GitHub API 요청 한도를 초과했습니다.",
  forbidden: "GitHub 요청이 거부되었습니다.",
  not_found: "GitHub 사용자를 찾을 수 없습니다.",
  server: "GitHub 서버 오류가 발생했습니다.",
  network: "GitHub에 연결할 수 없습니다.",
  unknown: "GitHub 요청 중 알 수 없는 오류가 발생했습니다.",
};

export function githubFailure(
  kind: GithubActivityErrorKind,
  resetAt?: Date,
): GithubActivityResult {
  return {
    ok: false,
    error: resetAt
      ? { kind, resetAt, message: MESSAGES[kind] }
      : { kind, message: MESSAGES[kind] },
  };
}

function githubHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`,
    "User-Agent": "DevLog",
  };
}

/**
 * 토큰으로 /user를 검증(GitHub user id == account.accountId)한 뒤
 * 공개 이벤트를 최대 3페이지 조회한다.
 */
export async function fetchGithubActivityWithToken(
  token: string,
  githubUserId: string,
  fetchImpl: FetchImpl = fetch,
): Promise<GithubActivityResult> {
  const get = (url: string) =>
    fetchImpl(url, { headers: githubHeaders(token), cache: "no-store" });

  try {
    const userRes = await get(`${API_BASE}/user`);
    if (!userRes.ok) {
      const c = classifyGithubError(userRes.status, userRes.headers);
      return githubFailure(c.kind, c.resetAt);
    }
    const body: unknown = await userRes.json();
    const rec = (
      typeof body === "object" && body !== null ? body : {}
    ) as Record<string, unknown>;
    const login = typeof rec.login === "string" ? rec.login : null;
    if (rec.id === undefined || String(rec.id) !== githubUserId || !login) {
      return githubFailure("account_mismatch");
    }

    const raw: unknown[] = [];
    let pagesFetched = 0;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await get(
        `${API_BASE}/users/${encodeURIComponent(login)}/events/public?per_page=${PER_PAGE}&page=${page}`,
      );
      if (!res.ok) {
        const c = classifyGithubError(res.status, res.headers);
        return githubFailure(c.kind, c.resetAt);
      }
      const items: unknown = await res.json();
      pagesFetched += 1;
      const list = Array.isArray(items) ? items : [];
      raw.push(...list);
      if (list.length < PER_PAGE || !hasNextPage(res.headers.get("link"))) break;
    }

    const seen = new Set<string>();
    const events: NormalizedEvent[] = [];
    for (const r of raw) {
      const e = normalizeEvent(r);
      if (!e || seen.has(e.id)) continue;
      seen.add(e.id);
      events.push(e);
    }
    events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      ok: true,
      data: {
        login,
        profileUrl: `https://github.com/${login}`,
        events,
        summary: summarizeEvents(events),
        fetchedAt: new Date(),
        pagesFetched,
      },
    };
  } catch {
    return githubFailure("network");
  }
}
