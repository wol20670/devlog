import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createWeeklyReviewAction } from "@/actions/weekly-reviews";
import { WeeklyReviewForm } from "@/components/reviews/WeeklyReviewForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { isWeekStart } from "@/lib/date";
import { buildReviewTemplate } from "@/lib/review-template";
import { requireUser } from "@/lib/session";
import { getWeeklyStats } from "@/server/stats";
import { getWeeklyReviewByWeek } from "@/server/weekly-reviews";

export const metadata: Metadata = { title: "주간 회고 작성" };

export default async function NewReviewPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const user = await requireUser();
  const { weekStart } = await params;
  if (!isWeekStart(weekStart)) notFound();

  const existing = await getWeeklyReviewByWeek(db, user.id, weekStart);
  if (existing) redirect(`/reviews/${weekStart}`);

  const { stats, logs } = await getWeeklyStats(db, user.id, weekStart);
  const template = buildReviewTemplate(stats, logs);

  return (
    <>
      <PageHeader title="주간 회고 작성" />
      <WeeklyReviewForm
        action={createWeeklyReviewAction}
        initialValues={{
          weekStart,
          title: template.title,
          content: template.content,
        }}
        submitLabel="저장"
        cancelHref={`/reviews/${weekStart}`}
      />
    </>
  );
}
