"use client";

import { useActionState } from "react";
import type { DevLogFormState, DevLogFormValues } from "@/actions/dev-logs";
import { Button, ButtonLink } from "@/components/ui/Button";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent";

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="mt-1 text-sm text-danger">
      {errors[0]}
    </p>
  );
}

const BODY_FIELDS = [
  {
    name: "workDone",
    label: "진행한 작업",
    placeholder: "오늘 무엇을 만들고 수정했는지 적어 보세요.",
  },
  {
    name: "learned",
    label: "배운 점",
    placeholder: "새로 알게 된 개념이나 도구, 깨달은 점을 적어 보세요.",
  },
  {
    name: "problems",
    label: "발생한 문제",
    placeholder: "막혔던 부분이나 에러 상황을 적어 보세요.",
  },
  {
    name: "solutions",
    label: "해결 방법",
    placeholder: "문제를 어떻게 해결했는지, 아직이라면 시도해 본 방법을 적어 보세요.",
  },
] as const;

export function DevLogForm({
  action,
  initialValues,
  projects,
  submitLabel,
  cancelHref,
}: {
  action: (
    prev: DevLogFormState,
    formData: FormData,
  ) => Promise<DevLogFormState>;
  initialValues: DevLogFormValues;
  projects: { id: string; name: string }[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<DevLogFormState, FormData>(
    action,
    { status: "idle" },
  );

  const values = state.status === "error" ? state.values : initialValues;
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {state.status === "error" && state.formError ? (
        <p role="alert" className="text-sm text-danger">
          {state.formError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="logDate" className="mb-1 block text-sm font-medium">
            날짜
          </label>
          <input
            id="logDate"
            name="logDate"
            type="date"
            required
            defaultValue={values.logDate}
            aria-invalid={!!errors.logDate}
            aria-describedby={errors.logDate ? "logDate-error" : undefined}
            className={inputClass}
          />
          <FieldError id="logDate-error" errors={errors.logDate} />
        </div>

        <div>
          <label htmlFor="projectId" className="mb-1 block text-sm font-medium">
            프로젝트
          </label>
          <select
            id="projectId"
            name="projectId"
            defaultValue={values.projectId}
            aria-invalid={!!errors.projectId}
            aria-describedby={errors.projectId ? "projectId-error" : undefined}
            className={inputClass}
          >
            <option value="">프로젝트 없음</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <FieldError id="projectId-error" errors={errors.projectId} />
        </div>
      </div>

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium">
          제목
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={values.title}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "title-error" : undefined}
          className={inputClass}
        />
        <FieldError id="title-error" errors={errors.title} />
      </div>

      {BODY_FIELDS.map((f) => (
        <div key={f.name}>
          <label htmlFor={f.name} className="mb-1 block text-sm font-medium">
            {f.label}
          </label>
          <textarea
            id={f.name}
            name={f.name}
            rows={5}
            maxLength={10000}
            placeholder={f.placeholder}
            defaultValue={values[f.name]}
            aria-invalid={!!errors[f.name]}
            aria-describedby={errors[f.name] ? `${f.name}-error` : undefined}
            className={inputClass}
          />
          <FieldError id={`${f.name}-error`} errors={errors[f.name]} />
        </div>
      ))}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "저장 중..." : submitLabel}
        </Button>
        <ButtonLink href={cancelHref} variant="ghost">
          취소
        </ButtonLink>
      </div>
    </form>
  );
}
