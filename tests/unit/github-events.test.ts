import { describe, expect, it } from "vitest";
import { normalizeEvent, summarizeEvents } from "@/lib/github/events";

const base = {
  id: "100",
  actor: { id: 1, login: "me" },
  repo: { id: 5, name: "me/app", url: "https://api.github.com/repos/me/app" },
  public: true,
  created_at: "2026-10-10T03:00:00Z",
};
const ev = (type: string, payload: unknown, over: object = {}) => ({
  ...base,
  type,
  payload,
  ...over,
});

describe("normalizeEvent", () => {
  it("PushEvent: 커밋 수 없이 브랜치명과 compare 링크", () => {
    const e = normalizeEvent(
      ev("PushEvent", {
        repository_id: 5,
        push_id: 9,
        ref: "refs/heads/main",
        head: "bbb",
        before: "aaa",
      }),
    )!;
    expect(e.kind).toBe("push");
    expect(e.kindLabel).toBe("푸시");
    expect(e.ref).toBe("main");
    expect(e.title).toContain("main");
    expect(e.url).toBe("https://github.com/me/app/compare/aaa...bbb");
    expect(e.createdAt.toISOString()).toBe("2026-10-10T03:00:00.000Z");
  });

  it("PushEvent: before가 0000이면 commit 링크", () => {
    const e = normalizeEvent(
      ev("PushEvent", {
        ref: "refs/heads/new",
        head: "bbb",
        before: "0000000000000000000000000000000000000000",
      }),
    )!;
    expect(e.url).toBe("https://github.com/me/app/commit/bbb");
  });

  it("PullRequestEvent: 전체 필드", () => {
    const e = normalizeEvent(
      ev("PullRequestEvent", {
        action: "opened",
        number: 3,
        pull_request: { title: "Add x", html_url: "https://github.com/me/app/pull/3" },
      }),
    )!;
    expect(e.kind).toBe("pull_request");
    expect(e.action).toBe("opened");
    expect(e.title).toBe("PR #3 Add x");
    expect(e.url).toBe("https://github.com/me/app/pull/3");
  });

  it("PullRequestEvent: 축약형이면 fallback", () => {
    const e = normalizeEvent(
      ev("PullRequestEvent", { action: "closed", number: 7, pull_request: { url: "x" } }),
    )!;
    expect(e.title).toBe("PR #7");
    expect(e.url).toBe("https://github.com/me/app/pull/7");
  });

  it("PullRequestReview(Comment)Event는 리뷰로 분류", () => {
    const a = normalizeEvent(
      ev("PullRequestReviewEvent", {
        action: "created",
        pull_request: { number: 2, title: "T" },
        review: { html_url: "https://github.com/me/app/pull/2#r1" },
      }),
    )!;
    expect(a.kind).toBe("pull_request_review");
    expect(a.url).toBe("https://github.com/me/app/pull/2#r1");
    const b = normalizeEvent(ev("PullRequestReviewCommentEvent", {}))!;
    expect(b.kind).toBe("pull_request_review");
  });

  it("IssuesEvent / IssueCommentEvent", () => {
    const i = normalizeEvent(
      ev("IssuesEvent", {
        action: "opened",
        issue: { number: 4, title: "Bug", html_url: "https://github.com/me/app/issues/4" },
      }),
    )!;
    expect(i.kind).toBe("issues");
    expect(i.title).toBe("#4 Bug");
    const c = normalizeEvent(
      ev("IssueCommentEvent", {
        action: "created",
        issue: { number: 4, title: "Bug" },
        comment: { html_url: "https://github.com/me/app/issues/4#c1" },
      }),
    )!;
    expect(c.kind).toBe("issue_comment");
    expect(c.url).toBe("https://github.com/me/app/issues/4#c1");
  });

  it("Create/Delete/Release/Fork/Watch", () => {
    const create = normalizeEvent(ev("CreateEvent", { ref: "feat", ref_type: "branch" }))!;
    expect(create.kind).toBe("create");
    expect(create.title).toContain("feat");
    const repoCreate = normalizeEvent(ev("CreateEvent", { ref: null, ref_type: "repository" }))!;
    expect(repoCreate.title).toBe("저장소 생성");
    expect(normalizeEvent(ev("DeleteEvent", { ref: "feat", ref_type: "branch" }))!.kind).toBe(
      "delete",
    );
    const rel = normalizeEvent(
      ev("ReleaseEvent", {
        action: "published",
        release: { tag_name: "v1", html_url: "https://github.com/me/app/releases/v1" },
      }),
    )!;
    expect(rel.title).toBe("v1");
    const fork = normalizeEvent(
      ev("ForkEvent", { forkee: { full_name: "me/fork", html_url: "https://github.com/me/fork" } }),
    )!;
    expect(fork.kind).toBe("fork");
    expect(fork.url).toBe("https://github.com/me/fork");
    expect(normalizeEvent(ev("WatchEvent", { action: "started" }))!.kind).toBe("watch");
  });

  it("알 수 없는 type과 PublicEvent는 other", () => {
    const e = normalizeEvent(ev("SomethingNewEvent", {}))!;
    expect(e.kind).toBe("other");
    expect(e.kindLabel).toBe("기타");
    expect(normalizeEvent(ev("PublicEvent", {}))!.kind).toBe("other");
  });

  it("payload가 비정상이어도 예외 없이 fallback", () => {
    const e = normalizeEvent(ev("PullRequestEvent", null))!;
    expect(e.title).toBe("PR");
    expect(e.url).toBe("https://github.com/me/app");
  });

  it("필수 필드 누락 시 null", () => {
    expect(normalizeEvent(null)).toBeNull();
    expect(normalizeEvent("x")).toBeNull();
    expect(normalizeEvent(ev("PushEvent", {}, { id: undefined }))).toBeNull();
    expect(normalizeEvent(ev("PushEvent", {}, { type: undefined }))).toBeNull();
    expect(normalizeEvent(ev("PushEvent", {}, { repo: undefined }))).toBeNull();
    expect(normalizeEvent(ev("PushEvent", {}, { created_at: undefined }))).toBeNull();
    expect(normalizeEvent(ev("PushEvent", {}, { created_at: "garbage" }))).toBeNull();
  });
});

describe("summarizeEvents", () => {
  it("kind별 개수, 총계, 기간", () => {
    const events = [
      normalizeEvent(ev("PushEvent", {}, { id: "1", created_at: "2026-10-12T00:00:00Z" }))!,
      normalizeEvent(ev("PushEvent", {}, { id: "2", created_at: "2026-10-01T00:00:00Z" }))!,
      normalizeEvent(ev("WatchEvent", {}, { id: "3", created_at: "2026-10-05T00:00:00Z" }))!,
    ];
    const s = summarizeEvents(events);
    expect(s.total).toBe(3);
    expect(s.counts.push).toBe(2);
    expect(s.counts.watch).toBe(1);
    expect(s.counts.issues).toBe(0);
    expect(s.earliest?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(s.latest?.toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });

  it("빈 목록", () => {
    const s = summarizeEvents([]);
    expect(s.total).toBe(0);
    expect(s.earliest).toBeNull();
    expect(s.latest).toBeNull();
  });
});
