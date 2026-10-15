import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteDevLogButton } from "@/components/dev-logs/DeleteDevLogButton";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { formatDateTimeKST, formatDateWithWeekday } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getDevLog } from "@/server/dev-logs";

export const metadata: Metadata = { title: "개발 기록 상세" };

export default async function LogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const log = await getDevLog(db, user.id, id);
  if (!log) notFound();

  const sections = [
    { label: "진행한 작업", body: log.workDone },
    { label: "배운 점", body: log.learned },
    { label: "발생한 문제", body: log.problems },
    { label: "해결 방법", body: log.solutions },
  ];

  return (
    <>
      <PageHeader
        title={log.title}
        description={formatDateWithWeekday(log.logDate)}
        actions={
          <>
            <ButtonLink href={`/logs/${log.id}/edit`}>수정</ButtonLink>
            <DeleteDevLogButton logId={log.id} />
          </>
        }
      />
      <Card className="flex max-w-3xl flex-col gap-5">
        <p className="text-sm">
          <span className="text-muted">프로젝트 </span>
          {log.project ? (
            <Link
              href={`/projects/${log.project.id}`}
              className="text-accent hover:underline"
            >
              {log.project.name}
            </Link>
          ) : (
            <span className="text-muted">없음</span>
          )}
        </p>
        {sections.map((s) => (
          <section key={s.label}>
            <h2 className="mb-1 text-sm font-semibold">{s.label}</h2>
            {s.body ? (
              <p className="whitespace-pre-wrap break-words text-sm">{s.body}</p>
            ) : (
              <p className="text-sm text-muted">작성하지 않음</p>
            )}
          </section>
        ))}
        <dl className="grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-2">
          <div>
            <dt className="inline">생성 </dt>
            <dd className="inline">{formatDateTimeKST(log.createdAt)}</dd>
          </div>
          <div>
            <dt className="inline">수정 </dt>
            <dd className="inline">{formatDateTimeKST(log.updatedAt)}</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
