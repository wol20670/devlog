import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { updateWeeklyReviewAction } from "@/actions/weekly-reviews";
import { WeeklyReviewForm } from "@/components/reviews/WeeklyReviewForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { isWeekStart } from "@/lib/date";
import { requireUser } from "@/lib/session";
import { getWeeklyReviewByWeek } from "@/server/weekly-reviews";

export const metadata: Metadata = { title: "주간 회고 수정" };

async function EditReviewPageContent({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const user = await requireUser();
  const { weekStart } = await params;
  if (!isWeekStart(weekStart)) notFound();
  const review = await getWeeklyReviewByWeek(db, user.id, weekStart);
  if (!review) notFound();

  return (
    <>
      <PageHeader title="주간 회고 수정" />
      <WeeklyReviewForm
        action={updateWeeklyReviewAction.bind(null, review.id)}
        initialValues={{
          weekStart: review.weekStart,
          title: review.title,
          content: review.content,
        }}
        submitLabel="저장"
        cancelHref={`/reviews/${weekStart}`}
      />
    </>
  );
}

export default function EditReviewPage(props: Parameters<typeof EditReviewPageContent>[0]) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditReviewPageContent {...props} />
    </Suspense>
  );
}
