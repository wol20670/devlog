import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Suspense } from "react";
import { createProjectAction } from "@/actions/projects";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "새 프로젝트" };

async function NewProjectPageContent() {
  await requireUser();
  return (
    <>
      <PageHeader title="새 프로젝트" />
      <ProjectForm
        action={createProjectAction}
        initialValues={{ name: "", description: "", status: "active" }}
        submitLabel="만들기"
        cancelHref="/projects"
      />
    </>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewProjectPageContent />
    </Suspense>
  );
}
