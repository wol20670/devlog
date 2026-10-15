import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { weeklyReviews, type WeeklyReview } from "@/db/schema";
import { isWeekStart } from "@/lib/date";
import { isUuid } from "@/lib/validation/common";
import type {
  WeeklyReviewInput,
  WeeklyReviewUpdateInput,
} from "@/lib/validation/weekly-review";

export type WeeklyReviewCreateResult =
  | { ok: true; review: WeeklyReview }
  | { ok: false; reason: "already_exists" };

const DEFAULT_LIMIT = 50;

export async function listWeeklyReviews(
  db: Db,
  userId: string,
  { limit = DEFAULT_LIMIT }: { limit?: number } = {},
): Promise<WeeklyReview[]> {
  return db
    .select()
    .from(weeklyReviews)
    .where(eq(weeklyReviews.userId, userId))
    .orderBy(desc(weeklyReviews.weekStart))
    .limit(limit);
}

export async function getWeeklyReviewByWeek(
  db: Db,
  userId: string,
  weekStart: string,
): Promise<WeeklyReview | null> {
  if (!isWeekStart(weekStart)) return null;
  const [row] = await db
    .select()
    .from(weeklyReviews)
    .where(
      and(
        eq(weeklyReviews.userId, userId),
        eq(weeklyReviews.weekStart, weekStart),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getWeeklyReview(
  db: Db,
  userId: string,
  id: string,
): Promise<WeeklyReview | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select()
    .from(weeklyReviews)
    .where(and(eq(weeklyReviews.id, id), eq(weeklyReviews.userId, userId)))
    .limit(1);
  return row ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  // drizzle이 driver 오류를 cause로 감싸는 경우까지 확인한다.
  let current: unknown = error;
  for (let i = 0; i < 3 && current; i++) {
    if (
      typeof current === "object" &&
      (current as { code?: unknown }).code === "23505"
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function createWeeklyReview(
  db: Db,
  userId: string,
  input: WeeklyReviewInput,
): Promise<WeeklyReviewCreateResult> {
  try {
    const [review] = await db
      .insert(weeklyReviews)
      .values({
        userId,
        weekStart: input.weekStart,
        title: input.title,
        content: input.content,
      })
      .returning();
    return { ok: true, review };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "already_exists" };
    throw error;
  }
}

/** 제목·내용만 수정한다. 주 시작일은 변경할 수 없다. */
export async function updateWeeklyReview(
  db: Db,
  userId: string,
  id: string,
  input: WeeklyReviewUpdateInput,
): Promise<WeeklyReview | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .update(weeklyReviews)
    .set({ title: input.title, content: input.content })
    .where(and(eq(weeklyReviews.id, id), eq(weeklyReviews.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteWeeklyReview(
  db: Db,
  userId: string,
  id: string,
): Promise<WeeklyReview | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .delete(weeklyReviews)
    .where(and(eq(weeklyReviews.id, id), eq(weeklyReviews.userId, userId)))
    .returning();
  return row ?? null;
}
