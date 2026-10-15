import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updateDevLogAction } from "@/actions/dev-logs";
import { DevLogForm } from "@/components/dev-logs/DevLogForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { requireUser } from "@/lib/session";
import { getDevLog } from "@/server/dev-logs";
import { listProjects } from "@/server/projects";

export const metadata: Metadata = { title: "개발 기록 수정" };

export default async function EditLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const log = await getDevLog(db, user.id, id);
  if (!log) notFound();
  const projects = await listProjects(db, user.id);

  return (
    <>
      <PageHeader title="개발 기록 수정" />
      <DevLogForm
        action={updateDevLogAction.bind(null, log.id)}
        initialValues={{
          logDate: log.logDate,
          projectId: log.project?.id ?? "",
          title: log.title,
          workDone: log.workDone,
          learned: log.learned,
          problems: log.problems,
          solutions: log.solutions,
        }}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        submitLabel="저장"
        cancelHref={`/logs/${log.id}`}
      />
    </>
  );
}
