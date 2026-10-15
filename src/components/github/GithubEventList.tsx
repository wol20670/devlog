import { Card } from "@/components/ui/Card";
import type { NormalizedEvent } from "@/lib/github/events";
import { formatDateKST } from "@/lib/format";

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// en-CA 로케일은 YYYY-MM-DD 형식이라 KST 달력 날짜 키로 쓰기 좋다.
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function GithubEventList({
  events,
  limit,
}: {
  events: NormalizedEvent[];
  limit?: number;
}) {
  const shown = limit ? events.slice(0, limit) : events;

  const groups: { day: string; items: NormalizedEvent[] }[] = [];
  for (const e of shown) {
    const day = dayKeyFormatter.format(e.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {groups.map((g) => (
        <section key={g.day}>
          <h2 className="mb-2 text-sm font-semibold text-muted">
            {formatDateKST(g.day)}
          </h2>
          <ul className="flex flex-col gap-2">
            {g.items.map((e) => (
              <li key={e.id} className="min-w-0">
                <Card className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex shrink-0 items-center rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      {e.kindLabel}
                    </span>
                    <a
                      href={e.repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 break-all text-sm text-muted hover:underline"
                    >
                      {e.repo.name}
                    </a>
                    <span className="ml-auto shrink-0 text-xs text-muted">
                      {timeFormatter.format(e.createdAt)}
                    </span>
                  </div>
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 break-words font-medium hover:underline"
                  >
                    {e.title}
                  </a>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
