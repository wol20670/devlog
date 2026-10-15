"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/session";
import { uuidSchema } from "@/lib/validation/common";
import {
  weeklyReviewInputSchema,
  weeklyReviewUpdateSchema,
} from "@/lib/validation/weekly-review";
import {
  createWeeklyReview,
  deleteWeeklyReview,
  updateWeeklyReview,
} from "@/server/weekly-reviews";

export type WeeklyReviewFormValues = {
  weekStart: string;
  title: string;
  content: string;
};

export type WeeklyReviewFormState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors: Partial<Record<keyof WeeklyReviewFormValues, string[]>>;
      formError?: string;
      values: WeeklyReviewFormValues;
    };

function readForm(formData: FormData): WeeklyReviewFormValues {
  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  return {
    weekStart: str("weekStart"),
    title: str("title"),
    content: str("content"),
  };
}

function revalidateReview(weekStart: string) {
  revalidatePath("/reviews");
  revalidatePath(`/reviews/${weekStart}`);
}

export async function createWeeklyReviewAction(
  _prev: WeeklyReviewFormState,
  formData: FormData,
): Promise<WeeklyReviewFormState> {
  const user = await requireUser();
  const values = readForm(formData);
  const parsed = weeklyReviewInputSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }
  const result = await createWeeklyReview(db, user.id, parsed.data);
  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: { weekStart: ["이 주의 회고가 이미 있습니다"] },
      values,
    };
  }
  revalidateReview(result.review.weekStart);
  redirect(`/reviews/${result.review.weekStart}`);
}

export async function updateWeeklyReviewAction(
  reviewId: string,
  _prev: WeeklyReviewFormState,
  formData: FormData,
): Promise<WeeklyReviewFormState> {
  const user = await requireUser();
  const values = readForm(formData);
  const parsed = weeklyReviewUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }
  const review = await updateWeeklyReview(db, user.id, reviewId, parsed.data);
  if (!review) {
    return {
      status: "error",
      fieldErrors: {},
      formError: "주간 회고를 찾을 수 없습니다",
      values,
    };
  }
  revalidateReview(review.weekStart);
  redirect(`/reviews/${review.weekStart}`);
}

export async function deleteWeeklyReviewAction(reviewId: string): Promise<void> {
  const user = await requireUser();
  const id = uuidSchema.safeParse(reviewId);
  if (!id.success) redirect("/reviews");
  const review = await deleteWeeklyReview(db, user.id, id.data);
  if (!review) redirect("/reviews");
  revalidateReview(review.weekStart);
  redirect(`/reviews/${review.weekStart}`);
}
