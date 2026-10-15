import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Suspense } from "react";
import { createDevLogAction } from "@/actions/dev-logs";
import { DevLogForm } from "@/components/dev-logs/DevLogForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { todayKST } from "@/lib/date";
import { requireUser } from "@/lib/session";
import { listProjects } from "@/server/projects";

export const metadata: Metadata = { title: "새 개발 기록" };

async function NewLogPageContent({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string | string[] }>;
}) {
  const user = await requireUser();
  const { projectId: projectIdParam } = await searchParams;
  const requested = Array.isArray(projectIdParam)
    ? projectIdParam[0]
    : projectIdParam;
  const projects = await listProjects(db, user.id);
  // 본인 프로젝트 목록에 있을 때만 기본 선택한다.
  const defaultProjectId =
    requested && projects.some((p) => p.id === requested) ? requested : "";

  return (
    <>
      <PageHeader title="새 개발 기록" />
      <DevLogForm
        action={createDevLogAction}
        initialValues={{
          logDate: todayKST(),
          projectId: defaultProjectId,
          title: "",
          workDone: "",
          learned: "",
          problems: "",
          solutions: "",
        }}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        submitLabel="저장"
        cancelHref="/logs"
      />
    </>
  );
}

export default function NewLogPage(props: Parameters<typeof NewLogPageContent>[0]) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewLogPageContent {...props} />
    </Suspense>
  );
}
