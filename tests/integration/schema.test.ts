import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { devLogs, projects, user, weeklyReviews } from "@/db/schema";
import type { Db } from "@/db";
import { createTestDb, createTestUser } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

describe("schema", () => {
  it("applies migrations and inserts user/project/log/review with defaults", async () => {
    const u = await createTestUser(db);
    const [p] = await db.insert(projects).values({ userId: u.id, name: "P" }).returning();
    expect(p.status).toBe("active");
    expect(p.description).toBe("");
    expect(p.createdAt).toBeInstanceOf(Date);

    const [log] = await db
      .insert(devLogs)
      .values({ userId: u.id, projectId: p.id, logDate: "2026-10-15", title: "L" })
      .returning();
    expect(log.logDate).toBe("2026-10-15");
    expect(log.workDone).toBe("");

    const [review] = await db
      .insert(weeklyReviews)
      .values({ userId: u.id, weekStart: "2026-10-12", title: "R" })
      .returning();
    expect(review.weekStart).toBe("2026-10-12");
    expect(review.content).toBe("");
  });

  it("cascades deletion from user to projects, dev_logs and weekly_reviews", async () => {
    const u = await createTestUser(db);
    const [p] = await db.insert(projects).values({ userId: u.id, name: "P" }).returning();
    await db.insert(devLogs).values({ userId: u.id, projectId: p.id, logDate: "2026-10-15", title: "L" });
    await db.insert(weeklyReviews).values({ userId: u.id, weekStart: "2026-10-12", title: "R" });

    await db.delete(user).where(eq(user.id, u.id));

    expect(await db.select().from(projects).where(eq(projects.userId, u.id))).toHaveLength(0);
    expect(await db.select().from(devLogs).where(eq(devLogs.userId, u.id))).toHaveLength(0);
    expect(await db.select().from(weeklyReviews).where(eq(weeklyReviews.userId, u.id))).toHaveLength(0);
  });

  it("sets dev_logs.project_id to NULL when the project is deleted", async () => {
    const u = await createTestUser(db);
    const [p] = await db.insert(projects).values({ userId: u.id, name: "P" }).returning();
    const [log] = await db
      .insert(devLogs)
      .values({ userId: u.id, projectId: p.id, logDate: "2026-10-15", title: "L" })
      .returning();

    await db.delete(projects).where(eq(projects.id, p.id));

    const [after] = await db.select().from(devLogs).where(eq(devLogs.id, log.id));
    expect(after).toBeDefined();
    expect(after.projectId).toBeNull();
  });

  it("rejects duplicate (user_id, week_start) in weekly_reviews", async () => {
    const u = await createTestUser(db);
    await db.insert(weeklyReviews).values({ userId: u.id, weekStart: "2026-10-12", title: "A" });
    await expect(
      db.insert(weeklyReviews).values({ userId: u.id, weekStart: "2026-10-12", title: "B" }),
    ).rejects.toThrow();

    // 다른 사용자/다른 주는 허용
    const other = await createTestUser(db);
    await db.insert(weeklyReviews).values({ userId: other.id, weekStart: "2026-10-12", title: "C" });
    await db.insert(weeklyReviews).values({ userId: u.id, weekStart: "2026-10-19", title: "D" });
  });

  it("rolls back a transaction on error", async () => {
    const u = await createTestUser(db);
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(projects).values({ userId: u.id, name: "rolled back" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await db.select().from(projects).where(eq(projects.userId, u.id))).toHaveLength(0);
  });
});
