import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { createDevLog } from "@/server/dev-logs";
import { createProject } from "@/server/projects";
import { getWeeklyStats } from "@/server/stats";
import {
  createWeeklyReview,
  deleteWeeklyReview,
  getWeeklyReview,
  getWeeklyReviewByWeek,
  listWeeklyReviews,
  updateWeeklyReview,
} from "@/server/weekly-reviews";
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

const input = (weekStart: string, title = "회고") => ({
  weekStart,
  title,
  content: "내용",
});

async function mustCreate(userId: string, weekStart: string) {
  const r = await createWeeklyReview(db, userId, input(weekStart));
  if (!r.ok) throw new Error("create failed");
  return r.review;
}

describe("weekly reviews CRUD", () => {
  it("생성/조회/수정/삭제", async () => {
    const review = await mustCreate(userA.id, "2026-01-05");
    expect(review.userId).toBe(userA.id);

    expect((await getWeeklyReview(db, userA.id, review.id))?.title).toBe("회고");
    expect((await getWeeklyReviewByWeek(db, userA.id, "2026-01-05"))?.id).toBe(review.id);

    const updated = await updateWeeklyReview(db, userA.id, review.id, {
      title: "수정",
      content: "",
    });
    expect(updated?.title).toBe("수정");
    expect(updated?.weekStart).toBe("2026-01-05");

    const deleted = await deleteWeeklyReview(db, userA.id, review.id);
    expect(deleted?.id).toBe(review.id);
    expect(await getWeeklyReview(db, userA.id, review.id)).toBeNull();
  });

  it("같은 주 중복은 already_exists, 다른 사용자는 가능", async () => {
    await mustCreate(userA.id, "2026-02-02");
    const dup = await createWeeklyReview(db, userA.id, input("2026-02-02"));
    expect(dup).toEqual({ ok: false, reason: "already_exists" });
    const other = await createWeeklyReview(db, userB.id, input("2026-02-02"));
    expect(other.ok).toBe(true);
  });

  it("목록은 weekStart 내림차순이며 본인 것만", async () => {
    const u = await createTestUser(db);
    await mustCreate(u.id, "2026-03-02");
    await mustCreate(u.id, "2026-03-16");
    await mustCreate(u.id, "2026-03-09");
    const list = await listWeeklyReviews(db, u.id);
    expect(list.map((r) => r.weekStart)).toEqual(["2026-03-16", "2026-03-09", "2026-03-02"]);
    expect(await listWeeklyReviews(db, u.id, { limit: 1 })).toHaveLength(1);
  });

  it("타 사용자 접근 불가, 잘못된 ID는 없음 처리", async () => {
    const review = await mustCreate(userA.id, "2026-04-06");
    expect(await getWeeklyReview(db, userB.id, review.id)).toBeNull();
    expect(await getWeeklyReviewByWeek(db, userB.id, "2026-04-06")).toBeNull();
    expect(
      await updateWeeklyReview(db, userB.id, review.id, { title: "x", content: "" }),
    ).toBeNull();
    expect(await deleteWeeklyReview(db, userB.id, review.id)).toBeNull();
    expect((await getWeeklyReview(db, userA.id, review.id))?.title).toBe("회고");

    expect(await getWeeklyReview(db, userA.id, "not-a-uuid")).toBeNull();
    expect(await updateWeeklyReview(db, userA.id, "x", { title: "x", content: "" })).toBeNull();
    expect(await deleteWeeklyReview(db, userA.id, "x")).toBeNull();
  });
});

describe("getWeeklyStats", () => {
  it("주 범위 경계를 포함하고 다른 주·타 사용자 기록은 제외", async () => {
    const u = await createTestUser(db);
    const other = await createTestUser(db);
    const project = await createProject(db, u.id, {
      name: "Proj",
      description: "",
      status: "active",
    });
    const mk = (userId: string, logDate: string, projectId: string | null = null) =>
      createDevLog(db, userId, {
        logDate,
        projectId,
        title: `log ${logDate}`,
        workDone: "",
        learned: "",
        problems: "",
        solutions: "",
      });

    // 주: 2026-10-12(월) ~ 2026-10-18(일)
    await mk(u.id, "2026-10-11"); // 전 주 일요일
    await mk(u.id, "2026-10-12", project.id); // 월 (경계)
    await mk(u.id, "2026-10-12");
    await mk(u.id, "2026-10-18"); // 일 (경계)
    await mk(u.id, "2026-10-19"); // 다음 주 월요일
    await mk(other.id, "2026-10-14");

    const { stats, logs } = await getWeeklyStats(db, u.id, "2026-10-12");
    expect(logs.map((l) => l.logDate)).toEqual(["2026-10-12", "2026-10-12", "2026-10-18"]);
    expect(stats.totalLogs).toBe(3);
    expect(stats.activeDays).toBe(2);
    expect(stats.days[0].count).toBe(2);
    expect(stats.days[6].count).toBe(1);
    expect(stats.byProject).toEqual([
      { projectId: null, projectName: null, count: 2 },
      { projectId: project.id, projectName: "Proj", count: 1 },
    ]);
  });
});
