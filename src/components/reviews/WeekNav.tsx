import { Button, ButtonLink } from "@/components/ui/Button";
import { addWeeks, currentWeekStartKST } from "@/lib/date";

/** 이전/다음 주 이동. 다음 주가 미래 주이면 비활성화한다. */
export function WeekNav({ weekStart }: { weekStart: string }) {
  const prev = addWeeks(weekStart, -1);
  const next = addWeeks(weekStart, 1);
  const nextIsFuture = next > currentWeekStartKST();

  return (
    <nav aria-label="주 이동" className="mb-4 flex gap-2">
      <ButtonLink href={`/reviews/${prev}`}>이전 주</ButtonLink>
      {nextIsFuture ? (
        <Button disabled>다음 주</Button>
      ) : (
        <ButtonLink href={`/reviews/${next}`}>다음 주</ButtonLink>
      )}
    </nav>
  );
}
