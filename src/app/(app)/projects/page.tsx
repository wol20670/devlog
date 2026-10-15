import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/projects/StatusBadge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { formatDateKST } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { listProjects } from "@/server/projects";

export const metadata: Metadata = { title: "프로젝트" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await listProjects(db, user.id);

  return (
    <>
      <PageHeader
        title="프로젝트"
        actions={
          <ButtonLink href="/projects/new" variant="primary">
            새 프로젝트
          </ButtonLink>
        }
      />
      {projects.length === 0 ? (
        <EmptyState
          title="아직 프로젝트가 없습니다"
          description="첫 프로젝트를 만들어 개발 기록을 정리해 보세요."
          action={
            <ButtonLink href="/projects/new" variant="primary">
              새 프로젝트
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id} className="min-w-0">
              <Link href={`/projects/${p.id}`} className="block h-full">
                <Card className="flex h-full flex-col gap-2 transition-colors hover:bg-border/20">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 break-words font-medium">{p.name}</h2>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.description ? (
                    <p className="line-clamp-2 break-words text-sm text-muted">
                      {p.description}
                    </p>
                  ) : null}
                  <p className="mt-auto pt-2 text-xs text-muted">
                    생성일 {formatDateKST(p.createdAt)}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
