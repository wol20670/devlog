// GitHub 공개 이벤트(/users/{login}/events/public) 정규화. 순수 로직이며 payload는 모두 방어적으로 다룬다.
// PushEvent payload에는 커밋 목록·개수가 없으므로 커밋 수는 계산하지 않는다.

export type EventKind =
  | "push"
  | "pull_request"
  | "pull_request_review"
  | "issues"
  | "issue_comment"
  | "create"
  | "delete"
  | "release"
  | "fork"
  | "watch"
  | "other";

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  push: "푸시",
  pull_request: "풀 리퀘스트",
  pull_request_review: "리뷰",
  issues: "이슈",
  issue_comment: "댓글",
  create: "생성",
  delete: "삭제",
  release: "릴리스",
  fork: "포크",
  watch: "스타",
  other: "기타",
};

export type NormalizedEvent = {
  id: string;
  kind: EventKind;
  kindLabel: string;
  action?: string;
  repo: { name: string; url: string };
  title: string;
  url: string;
  ref?: string;
  createdAt: Date;
};

export type EventSummary = {
  total: number;
  counts: Record<EventKind, number>;
  earliest: Date | null;
  latest: Date | null;
};

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function rec(v: unknown): Rec {
  return isRec(v) ? v : {};
}

const ZERO_SHA = /^0+$/;

function shortRef(ref: string | undefined): string | undefined {
  return ref?.replace(/^refs\/(heads|tags)\//, "");
}

const KIND_BY_TYPE: Record<string, EventKind> = {
  PushEvent: "push",
  PullRequestEvent: "pull_request",
  PullRequestReviewEvent: "pull_request_review",
  PullRequestReviewCommentEvent: "pull_request_review",
  IssuesEvent: "issues",
  IssueCommentEvent: "issue_comment",
  CreateEvent: "create",
  DeleteEvent: "delete",
  ReleaseEvent: "release",
  ForkEvent: "fork",
  WatchEvent: "watch",
};

export function normalizeEvent(raw: unknown): NormalizedEvent | null {
  if (!isRec(raw)) return null;
  const idRaw = raw.id;
  const id = typeof idRaw === "number" ? String(idRaw) : str(idRaw);
  const type = str(raw.type);
  const repoName = str(rec(raw.repo).name);
  const createdAtStr = str(raw.created_at);
  if (!id || !type || !repoName || !createdAtStr) return null;
  const createdAt = new Date(createdAtStr);
  if (Number.isNaN(createdAt.getTime())) return null;

  const repoUrl = `https://github.com/${repoName}`;
  const payload = rec(raw.payload);
  const action = str(payload.action);
  const kind = KIND_BY_TYPE[type] ?? "other";

  let title = type;
  let url = repoUrl;
  let ref: string | undefined;

  switch (kind) {
    case "push": {
      ref = shortRef(str(payload.ref));
      const head = str(payload.head);
      const before = str(payload.before);
      title = ref ? `${ref} 브랜치에 푸시` : "푸시";
      if (head) {
        url =
          before && !ZERO_SHA.test(before)
            ? `${repoUrl}/compare/${before}...${head}`
            : `${repoUrl}/commit/${head}`;
      }
      break;
    }
    case "pull_request":
    case "pull_request_review": {
      const pr = rec(payload.pull_request);
      const n = num(payload.number) ?? num(pr.number);
      const prTitle = str(pr.title);
      const label = n !== undefined ? `PR #${n}` : "PR";
      title = prTitle ? `${label} ${prTitle}` : label;
      url =
        str(pr.html_url) ??
        (n !== undefined ? `${repoUrl}/pull/${n}` : repoUrl);
      if (type === "PullRequestReviewEvent") {
        url = str(rec(payload.review).html_url) ?? url;
      } else if (type === "PullRequestReviewCommentEvent") {
        url = str(rec(payload.comment).html_url) ?? url;
      }
      break;
    }
    case "issues":
    case "issue_comment": {
      const issue = rec(payload.issue);
      const n = num(issue.number);
      const issueTitle = str(issue.title);
      const label = n !== undefined ? `#${n}` : "이슈";
      title = issueTitle ? `${label} ${issueTitle}` : label;
      url =
        str(issue.html_url) ??
        (n !== undefined ? `${repoUrl}/issues/${n}` : repoUrl);
      if (kind === "issue_comment") {
        url = str(rec(payload.comment).html_url) ?? url;
      }
      break;
    }
    case "create":
    case "delete": {
      ref = str(payload.ref);
      const refType = str(payload.ref_type);
      const target =
        refType === "repository" || !ref ? "저장소" : `${refType ?? "ref"} ${ref}`;
      title = kind === "create" ? `${target} 생성` : `${target} 삭제`;
      break;
    }
    case "release": {
      const rel = rec(payload.release);
      title = str(rel.name) ?? str(rel.tag_name) ?? "릴리스";
      url = str(rel.html_url) ?? repoUrl;
      break;
    }
    case "fork": {
      const forkee = rec(payload.forkee);
      const fullName = str(forkee.full_name);
      title = fullName ? `${fullName}로 포크` : "저장소 포크";
      url = str(forkee.html_url) ?? repoUrl;
      break;
    }
    case "watch":
      title = "저장소에 스타";
      break;
    case "other":
      title = type === "PublicEvent" ? "저장소 공개 전환" : type;
      break;
  }

  return {
    id,
    kind,
    kindLabel: EVENT_KIND_LABELS[kind],
    action,
    repo: { name: repoName, url: repoUrl },
    title,
    url,
    ref,
    createdAt,
  };
}

export function summarizeEvents(events: NormalizedEvent[]): EventSummary {
  const counts = Object.fromEntries(
    (Object.keys(EVENT_KIND_LABELS) as EventKind[]).map((k) => [k, 0]),
  ) as Record<EventKind, number>;
  let earliest: Date | null = null;
  let latest: Date | null = null;
  for (const e of events) {
    counts[e.kind] += 1;
    if (!earliest || e.createdAt < earliest) earliest = e.createdAt;
    if (!latest || e.createdAt > latest) latest = e.createdAt;
  }
  return { total: events.length, counts, earliest, latest };
}
