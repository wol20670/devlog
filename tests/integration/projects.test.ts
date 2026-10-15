import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  projectBelongsToUser,
  updateProject,
} from "@/server/projects";
import { createTestDb, createTestUser } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
let userA: { id: string };
let userB: { id: string };

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = t.close;
  userA = await createTestUser(db);
  userB = await createTestUser(db);
});

afterAll(async () => {
  await close();
});

const input = { name: "DevLog", description: "설명", status: "active" as const };

describe("projects CRUD", () => {
  it("생성/조회/수정/삭제", async () => {
    const created = await createProject(db, userA.id, input);
    expect(created.userId).toBe(userA.id);
    expect(created.name).toBe("DevLog");

    expect((await getProject(db, userA.id, created.id))?.id).toBe(created.id);

    const updated = await updateProject(db, userA.id, created.id, {
      name: "DevLog2",
      description: "",
      status: "completed",
    });
    expect(updated).toMatchObject({ name: "DevLog2", description: "", status: "completed" });

    expect(await deleteProject(db, userA.id, created.id)).toBe(true);
    expect(await getProject(db, userA.id, created.id)).toBeNull();
    expect(await deleteProject(db, userA.id, created.id)).toBe(false);
  });

  it("listProjects는 본인 것만 updatedAt 내림차순으로 반환한다", async () => {
    const a1 = await createProject(db, userA.id, { ...input, name: "A-old" });
    const a2 = await createProject(db, userA.id, { ...input, name: "A-new" });
    const b1 = await createProject(db, userB.id, { ...input, name: "B-1" });
    await updateProject(db, userA.id, a1.id, { ...input, name: "A-old-edited" });

    const listA = await listProjects(db, userA.id);
    const ids = listA.map((p) => p.id);
    expect(ids).toContain(a1.id);
    expect(ids).toContain(a2.id);
    expect(ids).not.toContain(b1.id);
    expect(ids.indexOf(a1.id)).toBeLessThan(ids.indexOf(a2.id));

    const listB = await listProjects(db, userB.id);
    expect(listB.every((p) => p.userId === userB.id)).toBe(true);
  });
});

describe("사용자 간 접근 차단", () => {
  it("사용자 B는 A의 프로젝트를 조회/수정/삭제할 수 없다", async () => {
    const p = await createProject(db, userA.id, input);

    expect(await getProject(db, userB.id, p.id)).toBeNull();
    expect(
      await updateProject(db, userB.id, p.id, { ...input, name: "hacked" }),
    ).toBeNull();
    expect(await deleteProject(db, userB.id, p.id)).toBe(false);

    const after = await getProject(db, userA.id, p.id);
    expect(after).not.toBeNull();
    expect(after?.name).toBe("DevLog");
  });

  it("projectBelongsToUser는 소유자에게만 true", async () => {
    const p = await createProject(db, userA.id, input);
    expect(await projectBelongsToUser(db, userA.id, p.id)).toBe(true);
    expect(await projectBelongsToUser(db, userB.id, p.id)).toBe(false);
    expect(await projectBelongsToUser(db, userA.id, crypto.randomUUID())).toBe(false);
    expect(await projectBelongsToUser(db, userA.id, "not-a-uuid")).toBe(false);
  });

  it("uuid가 아닌 projectId는 쿼리 없이 null/false", async () => {
    expect(await getProject(db, userA.id, "not-a-uuid")).toBeNull();
    expect(await updateProject(db, userA.id, "abc", input)).toBeNull();
    expect(await deleteProject(db, userA.id, "abc")).toBe(false);
  });
});
