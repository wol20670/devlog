const kstDateParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 현재 시각(또는 주어진 시각)의 KST 달력 날짜를 'YYYY-MM-DD'로 반환한다. 서버 TZ와 무관. */
export function todayKST(now: Date = new Date()): string {
  const parts = kstDateParts.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** 'YYYY-MM-DD' 형식이며 실제로 존재하는 달력 날짜인지 검사한다. */
export function isValidDateString(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}
