import type { Metadata } from "next";
import Link from "next/link";
import { WeeklyStatsCard } from "@/components/reviews/WeeklyStatsCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { currentWeekStartKST, weekRange } from "@/lib/date";
import { formatDateKST, formatDateTimeKST } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getWeeklyStats } from "@/server/stats";
import {
  getWeeklyReviewByWeek,
  listWeeklyReviews,
} from "@/server/weekly-reviews";

export const metadata: Metadata = { title: "주간 회고" };

export default async function ReviewsPage() {
  const user = await requireUser();
  const thisWeek = currentWeekStartKST();
  const range = weekRange(thisWeek);
  const [{ stats }, currentReview, reviews] = await Promise.all([
    getWeeklyStats(db, user.id, thisWeek),
    getWeeklyReviewByWeek(db, user.id, thisWeek),
    listWeeklyReviews(db, user.id),
  ]);
  const past = reviews.filter((r) => r.id !== currentReview?.id);

  return (
    <>
      <PageHeader title="주간 회고" />
      <div className="flex max-w-3xl flex-col gap-6">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              이번 주 ({formatDateKST(range.start)} ~ {formatDateKST(range.end)})
            </h2>
            <div className="flex gap-2">
              <ButtonLink href={`/reviews/${thisWeek}`}>주간 상세</ButtonLink>
              {currentReview ? (
                <ButtonLink href={`/reviews/${thisWeek}`} variant="primary">
                  회고 보기
                </ButtonLink>
              ) : (
                <ButtonLink href={`/reviews/${thisWeek}/new`} variant="primary">
                  회고 작성
                </ButtonLink>
              )}
            </div>
          </div>
          <WeeklyStatsCard stats={stats} />
        </section>

        <section>
          <h2 className="mb-2 font-semibold">지난 회고</h2>
          {past.length === 0 ? (
            <EmptyState
              title="아직 지난 회고가 없습니다"
              description="한 주를 마무리하며 회고를 남겨 보세요."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {past.map((r) => {
                const w = weekRange(r.weekStart);
                return (
                  <li key={r.id} className="min-w-0">
                    <Link href={`/reviews/${r.weekStart}`} className="block">
                      <Card className="flex flex-col gap-1 transition-colors hover:bg-border/20">
                        <p className="text-xs text-muted">
                          {formatDateKST(w.start)} ~ {formatDateKST(w.end)}
                        </p>
                        <h3 className="break-words font-medium">{r.title}</h3>
                        <p className="text-xs text-muted">
                          수정 {formatDateTimeKST(r.updatedAt)}
                        </p>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
