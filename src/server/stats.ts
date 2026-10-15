import "server-only";
import type { Db } from "@/db";
import { weekRange } from "@/lib/date";
import { computeWeeklyStats, type WeeklyStats } from "@/lib/stats";
import { listDevLogsInRange, type DevLogWithProjectName } from "@/server/dev-logs";

export async function getWeeklyStats(
  db: Db,
  userId: string,
  weekStart: string,
): Promise<{ stats: WeeklyStats; logs: DevLogWithProjectName[] }> {
  const { start, end } = weekRange(weekStart);
  const logs = await listDevLogsInRange(db, userId, start, end);
  return { stats: computeWeeklyStats(logs, weekStart), logs };
}
