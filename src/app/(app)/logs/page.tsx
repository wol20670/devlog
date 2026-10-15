import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Suspense } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/db";
import { formatDateWithWeekday } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { listDevLogs, type DevLogWithProjectName } from "@/server/dev-logs";

export const metadata: Metadata = { title: "개발 기록" };

const PAGE_SIZE = 50;

async function LogsPageContent({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const user = await requireUser();
  const { page: pageParam } = await searchParams;
  const raw = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const parsedPage = Number.parseInt(raw ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  // 다음 페이지 유무를 알기 위해 1건 더 조회한다.
  const rows = await listDevLogs(db, user.id, {
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE,
  });
  const hasMore = rows.length > PAGE_SIZE;
  const logs = rows.slice(0, PAGE_SIZE);

  const groups: { date: string; items: DevLogWithProjectName[] }[] = [];
  for (const log of logs) {
    const last = groups[groups.length - 1];
    if (last && last.date === log.logDate) last.items.push(log);
    else groups.push({ date: log.logDate, items: [log] });
  }

  const newButton = (
    <ButtonLink href="/logs/new" variant="primary">
      새 기록
    </ButtonLink>
  );

  return (
    <>
      <PageHeader title="개발 기록" actions={newButton} />
      {logs.length === 0 ? (
        page > 1 ? (
          <EmptyState
            title="더 이상 기록이 없습니다"
            action={<ButtonLink href="/logs">처음으로</ButtonLink>}
          />
        ) : (
          <EmptyState
            title="아직 개발 기록이 없습니다"
            description="오늘 한 작업을 간단히 남겨 보세요."
            action={newButton}
          />
        )
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          {groups.map((g) => (
            <section key={g.date}>
              <h2 className="mb-2 text-sm font-semibold text-muted">
                {formatDateWithWeekday(g.date)}
              </h2>
              <ul className="flex flex-col gap-2">
                {g.items.map((log) => (
                  <li key={log.id} className="min-w-0">
                    <Link href={`/logs/${log.id}`} className="block">
                      <Card className="flex flex-col gap-1 transition-colors hover:bg-border/20">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="min-w-0 break-words font-medium">
                            {log.title}
                          </h3>
                          {log.projectName ? (
                            <span className="inline-flex shrink-0 items-center rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                              {log.projectName}
                            </span>
                          ) : null}
                        </div>
                        {log.workDone ? (
                          <p className="line-clamp-2 break-words text-sm text-muted">
                            {log.workDone}
                          </p>
                        ) : null}
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="flex gap-2">
            {page > 1 ? (
              <ButtonLink href={page === 2 ? "/logs" : `/logs?page=${page - 1}`}>
                최근 기록으로
              </ButtonLink>
            ) : null}
            {hasMore ? (
              <ButtonLink href={`/logs?page=${page + 1}`}>
                이전 기록 더 보기
              </ButtonLink>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

export default function LogsPage(props: Parameters<typeof LogsPageContent>[0]) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LogsPageContent {...props} />
    </Suspense>
  );
}
