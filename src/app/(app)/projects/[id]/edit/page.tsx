import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { updateProjectAction } from "@/actions/projects";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { requireUser } from "@/lib/session";
import { getProject } from "@/server/projects";

export const metadata: Metadata = { title: "프로젝트 수정" };

async function EditProjectPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const project = await getProject(db, user.id, id);
  if (!project) notFound();

  return (
    <>
      <PageHeader title="프로젝트 수정" />
      <ProjectForm
        action={updateProjectAction.bind(null, project.id)}
        initialValues={{
          name: project.name,
          description: project.description,
          status: project.status,
        }}
        submitLabel="저장"
        cancelHref={`/projects/${project.id}`}
      />
    </>
  );
}

export default function EditProjectPage(props: Parameters<typeof EditProjectPageContent>[0]) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditProjectPageContent {...props} />
    </Suspense>
  );
}
