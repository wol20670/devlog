import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { projects, type Project } from "@/db/schema";
import { isUuid } from "@/lib/validation/common";
import type { ProjectInput } from "@/lib/validation/project";

export async function listProjects(db: Db, userId: string): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));
}

export async function getProject(
  db: Db,
  userId: string,
  projectId: string,
): Promise<Project | null> {
  if (!isUuid(projectId)) return null;
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createProject(
  db: Db,
  userId: string,
  input: ProjectInput,
): Promise<Project> {
  const [row] = await db
    .insert(projects)
    .values({
      userId,
      name: input.name,
      description: input.description,
      status: input.status,
    })
    .returning();
  return row;
}

export async function updateProject(
  db: Db,
  userId: string,
  projectId: string,
  input: ProjectInput,
): Promise<Project | null> {
  if (!isUuid(projectId)) return null;
  const [row] = await db
    .update(projects)
    .set({
      name: input.name,
      description: input.description,
      status: input.status,
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteProject(
  db: Db,
  userId: string,
  projectId: string,
): Promise<boolean> {
  if (!isUuid(projectId)) return false;
  const rows = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning({ id: projects.id });
  return rows.length > 0;
}

/** 개발 기록의 projectId가 같은 사용자 소유인지 검증할 때 사용한다. */
export async function projectBelongsToUser(
  db: Db,
  userId: string,
  projectId: string,
  { lock = false }: { lock?: boolean } = {},
): Promise<boolean> {
  if (!isUuid(projectId)) return false;
  const query = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  // 트랜잭션 안에서 lock을 켜면 FOR SHARE로 프로젝트 행을 잠가 검증 후 삭제되는 경쟁을 막는다.
  const [row] = lock ? await query.for("share") : await query;
  return !!row;
}
