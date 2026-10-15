import { addDays, weekRange } from "@/lib/date";

export const NO_PROJECT_LABEL = "프로젝트 없음";

export type StatsLog = {
  logDate: string;
  projectId: string | null;
  projectName: string | null;
};

export type WeeklyStats = {
  weekStart: string;
  weekEnd: string;
  totalLogs: number;
  activeDays: number;
  days: { date: string; count: number }[];
  byProject: {
    projectId: string | null;
    projectName: string | null;
    count: number;
  }[];
};

/** 주(월~일)에 속한 기록만 집계한다. 범위 밖 기록은 무시한다. */
export function computeWeeklyStats(
  logs: StatsLog[],
  weekStart: string,
): WeeklyStats {
  const { end } = weekRange(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => ({
    date: addDays(weekStart, i),
    count: 0,
  }));
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));
  const projects = new Map<
    string,
    { projectId: string | null; projectName: string | null; count: number }
  >();

  let totalLogs = 0;
  for (const log of logs) {
    const i = dayIndex.get(log.logDate);
    if (i === undefined) continue;
    days[i].count += 1;
    totalLogs += 1;
    const key = log.projectId ?? "";
    const entry = projects.get(key);
    if (entry) entry.count += 1;
    else
      projects.set(key, {
        projectId: log.projectId,
        projectName: log.projectId ? log.projectName : null,
        count: 1,
      });
  }

  const byProject = [...projects.values()].sort(
    (a, b) =>
      b.count - a.count ||
      (a.projectName ?? NO_PROJECT_LABEL).localeCompare(
        b.projectName ?? NO_PROJECT_LABEL,
        "ko",
      ),
  );

  return {
    weekStart,
    weekEnd: end,
    totalLogs,
    activeDays: days.filter((d) => d.count > 0).length,
    days,
    byProject,
  };
}
