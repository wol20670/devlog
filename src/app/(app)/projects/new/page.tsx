import type { Metadata } from "next";
import { createProjectAction } from "@/actions/projects";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "새 프로젝트" };

export default async function NewProjectPage() {
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
