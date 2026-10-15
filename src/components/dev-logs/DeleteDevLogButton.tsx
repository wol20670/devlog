"use client";

import { useTransition } from "react";
import { deleteDevLogAction } from "@/actions/dev-logs";
import { Button } from "@/components/ui/Button";

export function DeleteDevLogButton({ logId }: { logId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    const ok = window.confirm("이 개발 기록을 삭제할까요?\n삭제한 기록은 복구할 수 없습니다.");
    if (!ok) return;
    startTransition(async () => {
      await deleteDevLogAction(logId);
    });
  }

  return (
    <Button variant="danger" onClick={onClick} disabled={pending}>
      {pending ? "삭제 중..." : "삭제"}
    </Button>
  );
}
