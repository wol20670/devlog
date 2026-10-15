"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/session";
import { uuidSchema } from "@/lib/validation/common";
import { devLogInputSchema } from "@/lib/validation/dev-log";
import {
  createDevLog,
  deleteDevLog,
  getDevLog,
  updateDevLog,
} from "@/server/dev-logs";

export type DevLogFormValues = {
  logDate: string;
  projectId: string;
  title: string;
  workDone: string;
  learned: string;
  problems: string;
  solutions: string;
};

export type DevLogFormState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors: Partial<Record<keyof DevLogFormValues, string[]>>;
      formError?: string;
      values: DevLogFormValues;
    };

const PROJECT_NOT_FOUND = "선택한 프로젝트를 찾을 수 없습니다";

function readForm(formData: FormData): DevLogFormValues {
  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  return {
    logDate: str("logDate"),
    projectId: str("projectId"),
    title: str("title"),
    workDone: str("workDone"),
    learned: str("learned"),
    problems: str("problems"),
    solutions: str("solutions"),
  };
}

function revalidateProject(projectId: string | null | undefined) {
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function createDevLogAction(
  _prev: DevLogFormState,
  formData: FormData,
): Promise<DevLogFormState> {
  const user = await requireUser();
  const values = readForm(formData);
  const parsed = devLogInputSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }
  const result = await createDevLog(db, user.id, parsed.data);
  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: { projectId: [PROJECT_NOT_FOUND] },
      values,
    };
  }
  revalidatePath("/logs");
  revalidateProject(result.log.projectId);
  redirect(`/logs/${result.log.id}`);
}

export async function updateDevLogAction(
  logId: string,
  _prev: DevLogFormState,
  formData: FormData,
): Promise<DevLogFormState> {
  const user = await requireUser();
  const values = readForm(formData);
  const parsed = devLogInputSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }
  // 프로젝트를 바꾸는 경우 이전 프로젝트 상세도 재검증해야 한다.
  const before = await getDevLog(db, user.id, logId);
  const result = await updateDevLog(db, user.id, logId, parsed.data);
  if (!result.ok) {
    if (result.reason === "project_not_found") {
      return {
        status: "error",
        fieldErrors: { projectId: [PROJECT_NOT_FOUND] },
        values,
      };
    }
    return {
      status: "error",
      fieldErrors: {},
      formError: "개발 기록을 찾을 수 없습니다",
      values,
    };
  }
  revalidatePath("/logs");
  revalidatePath(`/logs/${result.log.id}`);
  revalidateProject(before?.projectId);
  revalidateProject(result.log.projectId);
  redirect(`/logs/${result.log.id}`);
}

export async function deleteDevLogAction(logId: string): Promise<void> {
  const user = await requireUser();
  const id = uuidSchema.safeParse(logId);
  if (!id.success) redirect("/logs");
  const before = await getDevLog(db, user.id, id.data);
  await deleteDevLog(db, user.id, id.data);
  revalidatePath("/logs");
  revalidateProject(before?.projectId);
  redirect("/logs");
}
