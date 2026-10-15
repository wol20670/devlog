"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/session";
import { uuidSchema } from "@/lib/validation/common";
import { projectInputSchema } from "@/lib/validation/project";
import {
  createProject,
  deleteProject,
  updateProject,
} from "@/server/projects";

export type ProjectFormValues = {
  name: string;
  description: string;
  status: string;
};

export type ProjectFormState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors: Partial<Record<"name" | "description" | "status", string[]>>;
      formError?: string;
      values: ProjectFormValues;
    };

function readForm(formData: FormData): ProjectFormValues {
  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  return {
    name: str("name"),
    description: str("description"),
    status: str("status") || "active",
  };
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await requireUser();
  const values = readForm(formData);
  const parsed = projectInputSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }
  const project = await createProject(db, user.id, parsed.data);
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(
  projectId: string,
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await requireUser();
  const values = readForm(formData);
  const parsed = projectInputSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }
  const project = await updateProject(db, user.id, projectId, parsed.data);
  if (!project) {
    return {
      status: "error",
      fieldErrors: {},
      formError: "프로젝트를 찾을 수 없습니다",
      values,
    };
  }
  revalidatePath("/projects");
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}`);
}

export async function deleteProjectAction(projectId: string): Promise<void> {
  const user = await requireUser();
  const id = uuidSchema.safeParse(projectId);
  if (!id.success) redirect("/projects");
  await deleteProject(db, user.id, id.data);
  // 연결된 개발 기록의 프로젝트 표시도 바뀌므로 앱 전체 레이아웃 기준으로 재검증한다.
  revalidatePath("/", "layout");
  redirect("/projects");
}
