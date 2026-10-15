import {
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/lib/validation/project";

const STYLES: Record<ProjectStatus, string> = {
  planning: "border-border text-muted",
  active: "border-accent/40 bg-accent/10 text-accent",
  paused: "border-border bg-border/40 text-foreground",
  completed: "border-border bg-surface text-muted",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}
