import { z } from "zod";
import { isValidDateString } from "@/lib/date";

const bodyField = (label: string) =>
  z
    .string()
    .trim()
    .max(10000, `${label}은(는) 10000자 이하로 입력해 주세요`)
    .default("");

export const devLogInputSchema = z.object({
  logDate: z
    .string("날짜를 입력해 주세요")
    .refine(isValidDateString, "올바른 날짜를 입력해 주세요"),
  projectId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid("올바른 프로젝트를 선택해 주세요").nullable()),
  title: z
    .string("제목을 입력해 주세요")
    .trim()
    .min(1, "제목을 입력해 주세요")
    .max(200, "제목은 200자 이하로 입력해 주세요"),
  workDone: bodyField("진행한 작업"),
  learned: bodyField("배운 점"),
  problems: bodyField("발생한 문제"),
  solutions: bodyField("해결 방법"),
});

export type DevLogInput = z.infer<typeof devLogInputSchema>;
