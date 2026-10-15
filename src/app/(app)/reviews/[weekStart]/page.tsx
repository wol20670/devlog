import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteReviewButton } from "@/components/reviews/DeleteReviewButton";
import { WeekNav } from "@/components/reviews/WeekNav";
import { WeeklyStatsCard } from "@/components/reviews/WeeklyStatsCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { isWeekStart, weekRange } from "@/lib/date";
import {
  formatDateKST,
  formatDateTimeKST,
  formatDateWithWeekday,
} from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getWeeklyStats } from "@/server/stats";
import { getWeeklyReviewByWeek } from "@/server/weekly-reviews";

export const metadata: Metadata = { title: "주간 회고 상세" };

async function WeekDetailPageContent({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const user = await requireUser();
  const { weekStart } = await params;
  if (!isWeekStart(weekStart)) notFound();

  const range = weekRange(weekStart);
  const [{ stats, logs }, review] = await Promise.all([
    getWeeklyStats(db, user.id, weekStart),
    getWeeklyReviewByWeek(db, user.id, weekStart),
  ]);

  return (
    <>
      <PageHeader
        title={`${formatDateKST(range.start)} ~ ${formatDateKST(range.end)}`}
        description="주간 회고"
        actions={
          <ButtonLink href="/reviews" variant="ghost">
            목록
          </ButtonLink>
        }
      />
      <div className="flex max-w-3xl flex-col gap-6">
        <WeekNav weekStart={weekStart} />

        <WeeklyStatsCard stats={stats} />

        <section>
          <h2 className="mb-2 font-semibold">이 주의 개발 기록</h2>
          {logs.length === 0 ? (
            <p className="text-sm text-muted">이 주에 작성한 기록이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {logs.map((log) => (
                <li key={log.id} className="flex flex-wrap gap-2">
                  <span className="shrink-0 text-muted">
                    {formatDateWithWeekday(log.logDate)}
                  </span>
                  <Link
                    href={`/logs/${log.id}`}
                    className="min-w-0 break-words text-accent hover:underline"
                  >
                    {log.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-semibold">회고</h2>
          {review ? (
            <Card className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 break-words text-lg font-semibold">
                  {review.title}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={`/reviews/${weekStart}/edit`}>수정</ButtonLink>
                  <DeleteReviewButton reviewId={review.id} />
                </div>
              </div>
              {review.content ? (
                <p className="whitespace-pre-wrap break-words text-sm">
                  {review.content}
                </p>
              ) : (
                <p className="text-sm text-muted">작성한 내용이 없습니다.</p>
              )}
              <p className="text-xs text-muted">
                수정 {formatDateTimeKST(review.updatedAt)}
              </p>
            </Card>
          ) : (
            <Card className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted">
                이 주의 회고가 아직 없습니다. 개발 기록을 바탕으로 템플릿이 채워집니다.
              </p>
              <ButtonLink href={`/reviews/${weekStart}/new`} variant="primary">
                회고 작성
              </ButtonLink>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}

export default function WeekDetailPage(props: Parameters<typeof WeekDetailPageContent>[0]) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WeekDetailPageContent {...props} />
    </Suspense>
  );
}
