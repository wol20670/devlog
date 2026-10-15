import { Card } from "@/components/ui/Card";
import { NO_PROJECT_LABEL, type WeeklyStats } from "@/lib/stats";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export function WeeklyStatsCard({ stats }: { stats: WeeklyStats }) {
  const max = Math.max(1, ...stats.days.map((d) => d.count));

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold">개발 기록 통계</h2>
        <p className="text-xs text-muted">DevLog에 작성한 기록 기준</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">개발 기록</dt>
          <dd className="text-2xl font-semibold">{stats.totalLogs}건</dd>
        </div>
        <div>
          <dt className="text-muted">기록한 날</dt>
          <dd className="text-2xl font-semibold">{stats.activeDays}일</dd>
        </div>
      </dl>

      <ul className="grid grid-cols-7 gap-2" aria-label="요일별 기록 수">
        {stats.days.map((d, i) => (
          <li key={d.date} className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted">{d.count}</span>
            <div className="flex h-16 w-full items-end rounded bg-border/30">
              <div
                className="w-full rounded bg-accent"
                style={{ height: `${(d.count / max) * 100}%` }}
                role="img"
                aria-label={`${DAY_LABELS[i]}요일 ${d.count}건`}
              />
            </div>
            <span className="text-xs">{DAY_LABELS[i]}</span>
          </li>
        ))}
      </ul>

      <div>
        <h3 className="mb-1 text-sm font-semibold">프로젝트별</h3>
        {stats.byProject.length === 0 ? (
          <p className="text-sm text-muted">이 주에 작성한 기록이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {stats.byProject.map((p) => (
              <li
                key={p.projectId ?? "none"}
                className="flex justify-between gap-2"
              >
                <span className="min-w-0 break-words">
                  {p.projectName ?? NO_PROJECT_LABEL}
                </span>
                <span className="shrink-0 text-muted">{p.count}건</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
