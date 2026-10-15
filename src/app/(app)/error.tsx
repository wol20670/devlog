"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      title="문제가 발생했습니다"
      description="잠시 후 다시 시도해 주세요."
      action={<Button onClick={reset}>다시 시도</Button>}
    />
  );
}
