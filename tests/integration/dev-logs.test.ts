import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import {
  createDevLog,
  deleteDevLog,
  getDevLog,
  listDevLogs,
  listDevLogsByProject,
  listDevLogsInRange,
  updateDevLog,
} from "@/server/dev-logs";
import { createProject, deleteProject } from "@/server/projects";
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

const projectInput = { name: "P", description: "", status: "active" as const };

function logInput(over: Partial<Parameters<typeof createDevLog>[2]> = {}) {
  return {
    logDate: "2026-10-15",
    projectId: null,
    title: "기록",
    workDone: "작업",
    learned: "",
    problems: "",
    solutions: "",
    ...over,
  };
}

async function mustCreate(userId: string, over = {}) {
  const r = await createDevLog(db, userId, logInput(over));
  if (!r.ok) throw new Error("create failed");
  return r.log;
}

describe("dev logs CRUD", () => {
  it("생성/조회/수정/삭제", async () => {
    const project = await createProject(db, userA.id, projectInput);
    const log = await mustCreate(userA.id, { projectId: project.id });
    expect(log.userId).toBe(userA.id);

    const got = await getDevLog(db, userA.id, log.id);
    expect(got?.project).toEqual({ id: project.id, name: "P" });

    const updated = await updateDevLog(
      db,
      userA.id,
      log.id,
      logInput({ title: "수정", projectId: null, learned: "배움" }),
    );
    expect(updated.ok).toBe(true);
    const after = await getDevLog(db, userA.id, log.id);
    expect(after).toMatchObject({ title: "수정", learned: "배움", project: null });

    expect(await deleteDevLog(db, userA.id, log.id)).toBe(true);
    expect(await getDevLog(db, userA.id, log.id)).toBeNull();
    expect(await deleteDevLog(db, userA.id, log.id)).toBe(false);
  });

  it("uuid가 아닌 id는 not_found/null/false", async () => {
    expect(await getDevLog(db, userA.id, "abc")).toBeNull();
    expect(await updateDevLog(db, userA.id, "abc", logInput())).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await deleteDevLog(db, userA.id, "abc")).toBe(false);
  });

  it("listDevLogs는 logDate desc, createdAt desc 순이며 limit/offset 적용", async () => {
    const u = await createTestUser(db);
    const old = await mustCreate(u.id, { logDate: "2026-01-01", title: "old" });
    const day2a = await mustCreate(u.id, { logDate: "2026-01-02", title: "2a" });
    const day2b = await mustCreate(u.id, { logDate: "2026-01-02", title: "2b" });

    const all = await listDevLogs(db, u.id);
    expect(all.map((l) => l.id)).toEqual([day2b.id, day2a.id, old.id]);

    const page = await listDevLogs(db, u.id, { limit: 1, offset: 1 });
    expect(page.map((l) => l.id)).toEqual([day2a.id]);
  });
});

describe("사용자 간 접근 차단", () => {
  it("B는 A의 기록을 조회/수정/삭제할 수 없다", async () => {
    const log = await mustCreate(userA.id, { title: "비공개" });

    expect(await getDevLog(db, userB.id, log.id)).toBeNull();
    expect(await updateDevLog(db, userB.id, log.id, logInput({ title: "hacked" }))).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await deleteDevLog(db, userB.id, log.id)).toBe(false);

    const after = await getDevLog(db, userA.id, log.id);
    expect(after?.title).toBe("비공개");
    const listB = await listDevLogs(db, userB.id);
    expect(listB.map((l) => l.id)).not.toContain(log.id);
  });

  it("B가 A의 프로젝트로 기록 생성 시 project_not_found이며 저장되지 않는다", async () => {
    const pA = await createProject(db, userA.id, projectInput);
    const u = await createTestUser(db);
    const r = await createDevLog(db, u.id, logInput({ projectId: pA.id, title: "침입" }));
    expect(r).toEqual({ ok: false, reason: "project_not_found" });
    expect(await listDevLogs(db, u.id)).toHaveLength(0);
  });

  it("B가 자기 기록을 A의 프로젝트로 수정하면 project_not_found이며 변경되지 않는다", async () => {
    const pA = await createProject(db, userA.id, projectInput);
    const logB = await mustCreate(userB.id, { title: "B기록" });
    const r = await updateDevLog(
      db,
      userB.id,
      logB.id,
      logInput({ projectId: pA.id, title: "변경" }),
    );
    expect(r).toEqual({ ok: false, reason: "project_not_found" });
    const after = await getDevLog(db, userB.id, logB.id);
    expect(after).toMatchObject({ title: "B기록", project: null });
  });

  it("존재하지 않는 projectId도 project_not_found", async () => {
    const r = await createDevLog(
      db,
      userA.id,
      logInput({ projectId: crypto.randomUUID() }),
    );
    expect(r).toEqual({ ok: false, reason: "project_not_found" });
  });

  it("listDevLogs 조인이 타인 프로젝트명을 노출하지 않는다", async () => {
    const u = await createTestUser(db);
    const pA = await createProject(db, userA.id, { ...projectInput, name: "A-secret" });
    // 소유권 검증을 우회해 직접 삽입한 오염 데이터 상황을 가정한다.
    const { devLogs } = await import("@/db/schema");
    const [row] = await db
      .insert(devLogs)
      .values({ userId: u.id, projectId: pA.id, logDate: "2026-10-01", title: "오염" })
      .returning();

    const list = await listDevLogs(db, u.id);
    expect(list.find((l) => l.id === row.id)?.projectName).toBeNull();
    expect((await getDevLog(db, u.id, row.id))?.project).toBeNull();
    const range = await listDevLogsInRange(db, u.id, "2026-10-01", "2026-10-01");
    expect(range[0].projectName).toBeNull();
  });
});

describe("프로젝트 연동", () => {
  it("프로젝트 삭제 후에도 기록은 유지되고 projectId는 null", async () => {
    const p = await createProject(db, userA.id, projectInput);
    const log = await mustCreate(userA.id, { projectId: p.id });
    await deleteProject(db, userA.id, p.id);
    const after = await getDevLog(db, userA.id, log.id);
    expect(after).not.toBeNull();
    expect(after?.projectId).toBeNull();
    expect(after?.project).toBeNull();
  });

  it("listDevLogsByProject는 본인 것만 반환한다", async () => {
    const p = await createProject(db, userA.id, projectInput);
    const mine = await mustCreate(userA.id, { projectId: p.id });
    await mustCreate(userA.id); // 프로젝트 없음

    const list = await listDevLogsByProject(db, userA.id, p.id);
    expect(list.map((l) => l.id)).toEqual([mine.id]);
    expect(await listDevLogsByProject(db, userB.id, p.id)).toEqual([]);
    expect(await listDevLogsByProject(db, userA.id, "abc")).toEqual([]);
  });
});

describe("listDevLogsInRange", () => {
  it("from/to 경계를 포함하고 본인 것만 날짜 오름차순으로 반환한다", async () => {
    const u = await createTestUser(db);
    const other = await createTestUser(db);
    await mustCreate(u.id, { logDate: "2026-10-04", title: "전" });
    const mon = await mustCreate(u.id, { logDate: "2026-10-05", title: "월" });
    const wed = await mustCreate(u.id, { logDate: "2026-10-07", title: "수" });
    const sun = await mustCreate(u.id, { logDate: "2026-10-11", title: "일" });
    await mustCreate(u.id, { logDate: "2026-10-12", title: "후" });
    await mustCreate(other.id, { logDate: "2026-10-06", title: "타인" });

    const r = await listDevLogsInRange(db, u.id, "2026-10-05", "2026-10-11");
    expect(r.map((l) => l.id)).toEqual([mon.id, wed.id, sun.id]);
  });
});
