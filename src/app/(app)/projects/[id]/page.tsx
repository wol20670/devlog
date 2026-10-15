import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";
import { StatusBadge } from "@/components/projects/StatusBadge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { formatDateTimeKST } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getProject } from "@/server/projects";

export const metadata: Metadata = { title: "프로젝트 상세" };

export default async function ProjectDetailPage({
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
      <PageHeader
        title={project.name}
        actions={
          <>
            <ButtonLink href={`/projects/${project.id}/edit`}>수정</ButtonLink>
            <DeleteProjectButton projectId={project.id} />
          </>
        }
      />
      <Card className="flex max-w-3xl flex-col gap-4">
        <div>
          <StatusBadge status={project.status} />
        </div>
        {project.description ? (
          <p className="whitespace-pre-wrap break-words text-sm">
            {project.description}
          </p>
        ) : (
          <p className="text-sm text-muted">설명이 없습니다.</p>
        )}
        <dl className="grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-2">
          <div>
            <dt className="inline">생성일 </dt>
            <dd className="inline">{formatDateTimeKST(project.createdAt)}</dd>
          </div>
          <div>
            <dt className="inline">수정일 </dt>
            <dd className="inline">{formatDateTimeKST(project.updatedAt)}</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
