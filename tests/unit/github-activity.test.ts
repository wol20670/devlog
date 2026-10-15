import { describe, expect, it, vi } from "vitest";
import { fetchGithubActivityWithToken } from "@/lib/github/activity";

const TOKEN = "gho_SECRET_TOKEN_VALUE";
const NEXT = '<https://api.github.com/x?page=2>; rel="next"';

function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

let seq = 0;
function events(n: number) {
  return Array.from({ length: n }, () => {
    seq += 1;
    return {
      id: String(seq),
      type: "WatchEvent",
      repo: { id: 1, name: "me/app", url: "u" },
      payload: { action: "started" },
      created_at: new Date(Date.UTC(2026, 9, 1, 0, 0, seq)).toISOString(),
    };
  });
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;
function fakeFetch(handler: Handler) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    handler(String(url), init ?? {}),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const user = (id = 42) => json({ id, login: "me", name: "Not Login" });

describe("fetchGithubActivityWithToken", () => {
  it("/user id가 accountId와 다르면 account_mismatch, 이벤트는 조회하지 않음", async () => {
    const f = fakeFetch(() => user(999));
    const r = await fetchGithubActivityWithToken(TOKEN, "42", f);
    expect(r).toMatchObject({ ok: false, error: { kind: "account_mismatch" } });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("100,100,40 -> 3페이지 240건", async () => {
    const pages = [events(100), events(100), events(40)];
    const f = fakeFetch((url) => {
      if (url.endsWith("/user")) return user();
      const page = Number(new URL(url).searchParams.get("page"));
      return json(pages[page - 1], { headers: page < 3 ? { link: NEXT } : {} });
    });
    const r = await fetchGithubActivityWithToken(TOKEN, "42", f);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.pagesFetched).toBe(3);
    expect(r.data.events).toHaveLength(240);
    expect(r.data.login).toBe("me");
    expect(r.data.profileUrl).toBe("https://github.com/me");
    const times = r.data.events.map((e) => e.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(r.data.summary.total).toBe(240);
  });

  it("100,30 -> 2페이지에서 중단", async () => {
    const pages = [events(100), events(30)];
    const f = fakeFetch((url) => {
      if (url.endsWith("/user")) return user();
      const page = Number(new URL(url).searchParams.get("page"));
      return json(pages[page - 1] ?? [], { headers: page === 1 ? { link: NEXT } : {} });
    });
    const r = await fetchGithubActivityWithToken(TOKEN, "42", f);
    expect(r.ok && r.data.pagesFetched).toBe(2);
    expect(f).toHaveBeenCalledTimes(3); // /user + 2 pages
  });

  it("Link에 next가 없으면 100건이어도 중단", async () => {
    const f = fakeFetch((url) => (url.endsWith("/user") ? user() : json(events(100))));
    const r = await fetchGithubActivityWithToken(TOKEN, "42", f);
    expect(r.ok && r.data.pagesFetched).toBe(1);
  });

  it("항상 100건+next여도 최대 3페이지만 요청, 중복 id 제거", async () => {
    const same = events(100);
    const f = fakeFetch((url) =>
      url.endsWith("/user") ? user() : json(same, { headers: { link: NEXT } }),
    );
    const r = await fetchGithubActivityWithToken(TOKEN, "42", f);
    expect(f).toHaveBeenCalledTimes(4);
    expect(r.ok && r.data.pagesFetched).toBe(3);
    expect(r.ok && r.data.events.length).toBe(100);
  });

  it("no-store, Authorization 등 요청 옵션", async () => {
    const f = fakeFetch((url) => (url.endsWith("/user") ? user() : json([])));
    await fetchGithubActivityWithToken(TOKEN, "42", f);
    const calls = (f as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(2);
    for (const [url, init] of calls) {
      expect(init.cache).toBe("no-store");
      expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(init.headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
      expect(String(url).startsWith("https://api.github.com/")).toBe(true);
    }
    expect(String(calls[1][0])).toContain("/users/me/events/public?per_page=100&page=1");
  });

  it("401 -> unauthorized", async () => {
    const f = fakeFetch(() => json({}, { status: 401 }));
    const r = await fetchGithubActivityWithToken(TOKEN, "42", f);
    expect(r).toMatchObject({ ok: false, error: { kind: "unauthorized" } });
  });

  it("429 -> rate_limited + resetAt", async () => {
    const f = fakeFetch((url) =>
      url.endsWith("/user")
        ? user()
        : json({}, { status: 429, headers: { "x-ratelimit-reset": "1760000000" } }),
    );
    const r = await fetchGithubActivityWithToken(TOKEN, "42", f);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("rate_limited");
    expect(r.error.resetAt?.getTime()).toBe(1760000000 * 1000);
  });

  it("fetch throw -> network (토큰이 메시지에 없음)", async () => {
    const f = fakeFetch(() => {
      throw new Error(`boom ${TOKEN}`);
    });
    const r = await fetchGithubActivityWithToken(TOKEN, "42", f);
    expect(r).toMatchObject({ ok: false, error: { kind: "network" } });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
  });

  it("반환 객체에 토큰이 포함되지 않음", async () => {
    const f = fakeFetch((url) => (url.endsWith("/user") ? user() : json(events(3))));
    const r = await fetchGithubActivityWithToken(TOKEN, "42", f);
    expect(JSON.stringify(r)).not.toContain(TOKEN);
  });
});
