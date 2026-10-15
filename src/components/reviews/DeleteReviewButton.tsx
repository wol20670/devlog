"use client";

import { useTransition } from "react";
import { deleteWeeklyReviewAction } from "@/actions/weekly-reviews";
import { Button } from "@/components/ui/Button";

export function DeleteReviewButton({ reviewId }: { reviewId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    const ok = window.confirm("이 주간 회고를 삭제할까요?\n삭제한 회고는 복구할 수 없습니다.");
    if (!ok) return;
    startTransition(async () => {
      await deleteWeeklyReviewAction(reviewId);
    });
  }

  return (
    <Button variant="danger" onClick={onClick} disabled={pending}>
      {pending ? "삭제 중..." : "삭제"}
    </Button>
  );
}
