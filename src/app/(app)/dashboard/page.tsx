import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { GithubErrorNotice } from "@/components/github/GithubErrorNotice";
import { GithubEventList } from "@/components/github/GithubEventList";
import { StatusBadge } from "@/components/projects/StatusBadge";
import { WeeklyStatsCard } from "@/components/reviews/WeeklyStatsCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { currentWeekStartKST, weekRange } from "@/lib/date";
import { formatDateKST } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { listDevLogs } from "@/server/dev-logs";
import { fetchGithubActivity } from "@/server/github";
import { listProjects } from "@/server/projects";
import { getWeeklyStats } from "@/server/stats";
import { listWeeklyReviews } from "@/server/weekly-reviews";

export const metadata: Metadata = { title: "대시보드" };

function Section({
  title,
  href,
  hrefLabel = "전체 보기",
  children,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {href ? (
          <Link href={href} className="text-sm text-accent hover:underline">
            {hrefLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyCard({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-start gap-2">
      <p className="text-sm text-muted">{message}</p>
      {action}
    </Card>
  );
}

async function DashboardPageContent() {
  const user = await requireUser();
  const thisWeek = currentWeekStartKST();
  const range = weekRange(thisWeek);

  const [{ stats }, logs, projects, reviews] = await Promise.all([
    getWeeklyStats(db, user.id, thisWeek),
    listDevLogs(db, user.id, { limit: 5 }),
    listProjects(db, user.id),
    listWeeklyReviews(db, user.id, { limit: 3 }),
  ]);
  const shownProjects = projects.slice(0, 6);

  return (
    <>
      <PageHeader
        title="대시보드"
        description={`${user.name}님의 개발 기록`}
        actions={
          <ButtonLink href="/logs/new" variant="primary">
            새 기록
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title={`이번 주 개발 통계 (${formatDateKST(range.start)} ~ ${formatDateKST(range.end)})`}
        >
          <WeeklyStatsCard stats={stats} />
          <Link
            href={`/reviews/${thisWeek}`}
            className="text-sm text-accent hover:underline"
          >
            주간 회고 보기/작성
          </Link>
        </Section>

        <Section title="최근 개발 기록" href="/logs">
          {logs.length === 0 ? (
            <EmptyCard
              message="아직 개발 기록이 없습니다."
              action={
                <ButtonLink href="/logs/new" variant="primary">
                  기록 작성
                </ButtonLink>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {logs.map((log) => (
                <li key={log.id} className="min-w-0">
                  <Link href={`/logs/${log.id}`} className="block">
                    <Card className="flex flex-col gap-1 transition-colors hover:bg-border/20">
                      <span className="text-xs text-muted">
                        {formatDateKST(log.logDate)}
                        {log.projectName ? ` · ${log.projectName}` : ""}
                      </span>
                      <span className="min-w-0 break-words text-sm font-medium">
                        {log.title}
                      </span>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="프로젝트" href="/projects">
          {shownProjects.length === 0 ? (
            <EmptyCard
              message="아직 프로젝트가 없습니다."
              action={
                <ButtonLink href="/projects/new" variant="primary">
                  프로젝트 만들기
                </ButtonLink>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {shownProjects.map((p) => (
                <li key={p.id} className="min-w-0">
                  <Link href={`/projects/${p.id}`} className="block">
                    <Card className="flex items-start justify-between gap-2 transition-colors hover:bg-border/20">
                      <span className="min-w-0 break-words text-sm font-medium">
                        {p.name}
                      </span>
                      <StatusBadge status={p.status} />
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="최근 회고" href="/reviews">
          {reviews.length === 0 ? (
            <EmptyCard message="아직 작성한 주간 회고가 없습니다." />
          ) : (
            <ul className="flex flex-col gap-2">
              {reviews.map((r) => {
                const w = weekRange(r.weekStart);
                return (
                  <li key={r.id} className="min-w-0">
                    <Link href={`/reviews/${r.weekStart}`} className="block">
                      <Card className="flex flex-col gap-1 transition-colors hover:bg-border/20">
                        <span className="text-xs text-muted">
                          {formatDateKST(w.start)} ~ {formatDateKST(w.end)}
                        </span>
                        <span className="min-w-0 break-words text-sm font-medium">
                          {r.title}
                        </span>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <div className="min-w-0 rounded-lg border border-dashed border-border p-4 lg:col-span-2">
          <Section title="최근 GitHub 활동" href="/github">
            <p className="text-xs text-muted">공개 이벤트 · 최근 30일</p>
            <Suspense fallback={<GithubSkeleton />}>
              <GithubSection userId={user.id} />
            </Suspense>
          </Section>
        </div>
      </div>
    </>
  );
}

function GithubSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-border/30" />
      ))}
    </div>
  );
}

async function GithubSection({ userId }: { userId: string }) {
  const result = await fetchGithubActivity(db, userId);
  if (!result.ok) return <GithubErrorNotice error={result.error} />;
  if (result.data.events.length === 0) {
    return (
      <p className="text-sm text-muted">최근 30일간 공개 활동이 없습니다.</p>
    );
  }
  return <GithubEventList events={result.data.events} limit={5} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardPageContent />
    </Suspense>
  );
}
