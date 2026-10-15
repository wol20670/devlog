import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";
import { StatusBadge } from "@/components/projects/StatusBadge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { formatDateKST, formatDateTimeKST } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { listDevLogsByProject } from "@/server/dev-logs";
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
  const logs = await listDevLogsByProject(db, user.id, project.id);

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

      <section className="mt-8 max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">이 프로젝트의 개발 기록</h2>
          <ButtonLink href={`/logs/new?projectId=${project.id}`}>
            이 프로젝트에 기록 추가
          </ButtonLink>
        </div>
        {logs.length === 0 ? (
          <EmptyState
            title="아직 이 프로젝트의 개발 기록이 없습니다"
            description="작업한 내용을 기록으로 남겨 보세요."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {logs.map((log) => (
              <li key={log.id} className="min-w-0">
                <Link href={`/logs/${log.id}`} className="block">
                  <Card className="flex flex-wrap items-baseline gap-x-3 gap-y-1 transition-colors hover:bg-border/20">
                    <span className="shrink-0 text-xs text-muted">
                      {formatDateKST(log.logDate)}
                    </span>
                    <span className="min-w-0 break-words text-sm font-medium">
                      {log.title}
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
