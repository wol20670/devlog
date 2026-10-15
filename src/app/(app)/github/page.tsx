import type { Metadata } from "next";
import { Suspense } from "react";
import { GithubErrorNotice } from "@/components/github/GithubErrorNotice";
import { GithubEventList } from "@/components/github/GithubEventList";
import { GithubScopeNotice } from "@/components/github/GithubScopeNotice";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { formatDateKST, formatDateTimeKST } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { fetchGithubActivity } from "@/server/github";

export const metadata: Metadata = { title: "GitHub 활동" };

export default function GithubPage() {
  return (
    <Suspense
      fallback={
        <div>
          <PageHeader title="GitHub 활동" />
          <div className="h-24 max-w-3xl animate-pulse rounded-lg bg-border/30" />
        </div>
      }
    >
      <GithubContent />
    </Suspense>
  );
}

async function GithubContent() {
  const user = await requireUser();
  const result = await fetchGithubActivity(db, user.id);

  if (!result.ok) {
    return (
      <>
        <PageHeader title="GitHub 활동" />
        <GithubScopeNotice />
        <GithubErrorNotice error={result.error} />
      </>
    );
  }

  const { login, profileUrl, events, summary, fetchedAt } = result.data;
  const c = summary.counts;
  const stats = [
    { label: "푸시", value: c.push },
    { label: "PR", value: c.pull_request },
    { label: "리뷰", value: c.pull_request_review },
    { label: "이슈", value: c.issues },
    { label: "댓글", value: c.issue_comment },
    {
      label: "기타",
      value:
        c.create + c.delete + c.release + c.fork + c.watch + c.other,
    },
  ];

  return (
    <>
      <PageHeader
        title="GitHub 활동"
        actions={
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            @{login}
          </a>
        }
      />
      <GithubScopeNotice />
      {events.length === 0 ? (
        <EmptyState title="최근 30일간 공개 활동이 없습니다" />
      ) : (
        <div className="flex flex-col gap-6">
          <Card className="max-w-3xl">
            <h2 className="mb-3 text-sm font-semibold">유형별 이벤트 수</h2>
            <dl className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="text-xs text-muted">{s.label}</dt>
                  <dd className="text-lg font-semibold">{s.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted">
              총 {summary.total}건 · 조회 기간{" "}
              {summary.earliest && summary.latest
                ? `${formatDateKST(summary.earliest)} ~ ${formatDateKST(summary.latest)}`
                : "-"}{" "}
              · 조회 시각 {formatDateTimeKST(fetchedAt)}
            </p>
          </Card>
          <GithubEventList events={events} />
        </div>
      )}
    </>
  );
}
