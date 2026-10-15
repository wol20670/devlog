import "server-only";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import type { Db } from "@/db";
import { devLogs, projects, type DevLog } from "@/db/schema";
import type { DevLogInput } from "@/lib/validation/dev-log";
import { isUuid } from "@/lib/validation/common";
import { projectBelongsToUser } from "@/server/projects";

export type DevLogWithProjectName = DevLog & { projectName: string | null };

export type DevLogWithProject = DevLog & {
  project: { id: string; name: string } | null;
};

export type DevLogWriteResult =
  | { ok: true; log: DevLog }
  | { ok: false; reason: "project_not_found" | "not_found" };

const DEFAULT_LIMIT = 50;

// 프로젝트 조인 조건에 userId를 포함해 타인 프로젝트명이 노출되지 않게 한다.
const projectJoin = (userId: string) =>
  and(eq(devLogs.projectId, projects.id), eq(projects.userId, userId));

const logOrder = [desc(devLogs.logDate), desc(devLogs.createdAt)] as const;

function flatten(row: {
  log: DevLog;
  projectName: string | null;
}): DevLogWithProjectName {
  return { ...row.log, projectName: row.projectName };
}

export async function listDevLogs(
  db: Db,
  userId: string,
  { limit = DEFAULT_LIMIT, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<DevLogWithProjectName[]> {
  const rows = await db
    .select({ log: devLogs, projectName: projects.name })
    .from(devLogs)
    .leftJoin(projects, projectJoin(userId))
    .where(eq(devLogs.userId, userId))
    .orderBy(...logOrder)
    .limit(limit)
    .offset(offset);
  return rows.map(flatten);
}

export async function listDevLogsByProject(
  db: Db,
  userId: string,
  projectId: string,
): Promise<DevLog[]> {
  if (!isUuid(projectId)) return [];
  return db
    .select()
    .from(devLogs)
    .where(and(eq(devLogs.userId, userId), eq(devLogs.projectId, projectId)))
    .orderBy(...logOrder);
}

/** 주간 통계용. from/to는 KST 달력 날짜 'YYYY-MM-DD'이며 양 끝을 포함한다. */
export async function listDevLogsInRange(
  db: Db,
  userId: string,
  from: string,
  to: string,
): Promise<DevLogWithProjectName[]> {
  const rows = await db
    .select({ log: devLogs, projectName: projects.name })
    .from(devLogs)
    .leftJoin(projects, projectJoin(userId))
    .where(
      and(
        eq(devLogs.userId, userId),
        gte(devLogs.logDate, from),
        lte(devLogs.logDate, to),
      ),
    )
    .orderBy(asc(devLogs.logDate), asc(devLogs.createdAt));
  return rows.map(flatten);
}

export async function getDevLog(
  db: Db,
  userId: string,
  id: string,
): Promise<DevLogWithProject | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({
      log: devLogs,
      projectId: projects.id,
      projectName: projects.name,
    })
    .from(devLogs)
    .leftJoin(projects, projectJoin(userId))
    .where(and(eq(devLogs.id, id), eq(devLogs.userId, userId)))
    .limit(1);
  if (!row) return null;
  return {
    ...row.log,
    project:
      row.projectId && row.projectName
        ? { id: row.projectId, name: row.projectName }
        : null,
  };
}

export async function createDevLog(
  db: Db,
  userId: string,
  input: DevLogInput,
): Promise<DevLogWriteResult> {
  return db.transaction(async (tx) => {
    if (
      input.projectId !== null &&
      !(await projectBelongsToUser(tx, userId, input.projectId, { lock: true }))
    ) {
      return { ok: false, reason: "project_not_found" } as const;
    }
    const [log] = await tx
      .insert(devLogs)
      .values({
        userId,
        projectId: input.projectId,
        logDate: input.logDate,
        title: input.title,
        workDone: input.workDone,
        learned: input.learned,
        problems: input.problems,
        solutions: input.solutions,
      })
      .returning();
    return { ok: true, log } as const;
  });
}

export async function updateDevLog(
  db: Db,
  userId: string,
  id: string,
  input: DevLogInput,
): Promise<DevLogWriteResult> {
  if (!isUuid(id)) return { ok: false, reason: "not_found" };
  return db.transaction(async (tx) => {
    if (
      input.projectId !== null &&
      !(await projectBelongsToUser(tx, userId, input.projectId, { lock: true }))
    ) {
      return { ok: false, reason: "project_not_found" } as const;
    }
    const [log] = await tx
      .update(devLogs)
      .set({
        projectId: input.projectId,
        logDate: input.logDate,
        title: input.title,
        workDone: input.workDone,
        learned: input.learned,
        problems: input.problems,
        solutions: input.solutions,
      })
      .where(and(eq(devLogs.id, id), eq(devLogs.userId, userId)))
      .returning();
    if (!log) return { ok: false, reason: "not_found" } as const;
    return { ok: true, log } as const;
  });
}

export async function deleteDevLog(
  db: Db,
  userId: string,
  id: string,
): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await db
    .delete(devLogs)
    .where(and(eq(devLogs.id, id), eq(devLogs.userId, userId)))
    .returning({ id: devLogs.id });
  return rows.length > 0;
}
