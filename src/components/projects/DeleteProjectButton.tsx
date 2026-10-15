"use client";

import { useTransition } from "react";
import { deleteProjectAction } from "@/actions/projects";
import { Button } from "@/components/ui/Button";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    const ok = window.confirm(
      "이 프로젝트를 삭제할까요?\n연결된 개발 기록은 삭제되지 않고 프로젝트 연결만 해제됩니다.",
    );
    if (!ok) return;
    startTransition(async () => {
      await deleteProjectAction(projectId);
    });
  }

  return (
    <Button variant="danger" onClick={onClick} disabled={pending}>
      {pending ? "삭제 중..." : "삭제"}
    </Button>
  );
}
