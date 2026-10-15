"use client";

import { useActionState } from "react";
import {
  type ProjectFormState,
  type ProjectFormValues,
} from "@/actions/projects";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
} from "@/lib/validation/project";

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

export function ProjectForm({
  action,
  initialValues,
  submitLabel,
  cancelHref,
}: {
  action: (
    prev: ProjectFormState,
    formData: FormData,
  ) => Promise<ProjectFormState>;
  initialValues: ProjectFormValues;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<
    ProjectFormState,
    FormData
  >(action, { status: "idle" });

  const values = state.status === "error" ? state.values : initialValues;
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {state.status === "error" && state.formError ? (
        <p role="alert" className="text-sm text-danger">
          {state.formError}
        </p>
      ) : null}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          이름
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={100}
          defaultValue={values.name}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          className={inputClass}
        />
        <FieldError id="name-error" errors={errors.name} />
      </div>

      <div>
        <label htmlFor="status" className="mb-1 block text-sm font-medium">
          상태
        </label>
        <select
          id="status"
          name="status"
          defaultValue={values.status}
          aria-invalid={!!errors.status}
          aria-describedby={errors.status ? "status-error" : undefined}
          className={inputClass}
        >
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <FieldError id="status-error" errors={errors.status} />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          설명
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          maxLength={2000}
          defaultValue={values.description}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "description-error" : undefined}
          className={inputClass}
        />
        <FieldError id="description-error" errors={errors.description} />
      </div>

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
