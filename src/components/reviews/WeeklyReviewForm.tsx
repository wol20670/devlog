"use client";

import { useActionState } from "react";
import type {
  WeeklyReviewFormState,
  WeeklyReviewFormValues,
} from "@/actions/weekly-reviews";
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

export function WeeklyReviewForm({
  action,
  initialValues,
  submitLabel,
  cancelHref,
}: {
  action: (
    prev: WeeklyReviewFormState,
    formData: FormData,
  ) => Promise<WeeklyReviewFormState>;
  initialValues: WeeklyReviewFormValues;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<
    WeeklyReviewFormState,
    FormData
  >(action, { status: "idle" });

  const values = state.status === "error" ? state.values : initialValues;
  const errors = state.status === "error" ? state.fieldErrors : {};
  const formError =
    state.status === "error"
      ? (state.formError ?? errors.weekStart?.[0])
      : undefined;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {formError ? (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}
      <input type="hidden" name="weekStart" value={values.weekStart} />

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

      <div>
        <label htmlFor="content" className="mb-1 block text-sm font-medium">
          내용 (Markdown 원문)
        </label>
        <textarea
          id="content"
          name="content"
          rows={20}
          maxLength={20000}
          defaultValue={values.content}
          aria-invalid={!!errors.content}
          aria-describedby={errors.content ? "content-error" : undefined}
          className={`${inputClass} font-mono`}
        />
        <FieldError id="content-error" errors={errors.content} />
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
