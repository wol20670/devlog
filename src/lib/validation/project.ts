import { z } from "zod";

export const PROJECT_STATUSES = [
  "planning",
  "active",
  "paused",
  "completed",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "계획",
  active: "진행 중",
  paused: "보류",
  completed: "완료",
};

export const projectInputSchema = z.object({
  name: z
    .string("프로젝트 이름을 입력해 주세요")
    .trim()
    .min(1, "프로젝트 이름을 입력해 주세요")
    .max(100, "프로젝트 이름은 100자 이하로 입력해 주세요"),
  description: z
    .string()
    .trim()
    .max(2000, "설명은 2000자 이하로 입력해 주세요")
    .default(""),
  status: z
    .enum(PROJECT_STATUSES, "올바른 상태를 선택해 주세요")
    .default("active"),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
