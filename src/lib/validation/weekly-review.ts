import { z } from "zod";
import { isWeekStart } from "@/lib/date";

const titleField = z
  .string("제목을 입력해 주세요")
  .trim()
  .min(1, "제목을 입력해 주세요")
  .max(200, "제목은 200자 이하로 입력해 주세요");

const contentField = z
  .string()
  .trim()
  .max(20000, "내용은 20000자 이하로 입력해 주세요")
  .default("");

export const weeklyReviewInputSchema = z.object({
  weekStart: z
    .string("주 시작일을 입력해 주세요")
    .refine(isWeekStart, "올바른 주 시작일(월요일)이 아닙니다"),
  title: titleField,
  content: contentField,
});

export const weeklyReviewUpdateSchema = z.object({
  title: titleField,
  content: contentField,
});

export type WeeklyReviewInput = z.infer<typeof weeklyReviewInputSchema>;
export type WeeklyReviewUpdateInput = z.infer<typeof weeklyReviewUpdateSchema>;
