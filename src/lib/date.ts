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

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string): number {
  const [y, m, d] = value.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatUtc(ms: number): string {
  const d = new Date(ms);
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD'에 일수를 더한 달력 날짜를 반환한다. */
export function addDays(dateString: string, days: number): string {
  return formatUtc(parseDate(dateString) + days * DAY_MS);
}

/** 해당 날짜가 속한 주(월~일)의 월요일을 반환한다. */
export function weekStartOf(dateString: string): string {
  const ms = parseDate(dateString);
  const dow = new Date(ms).getUTCDay(); // 0=일 ... 6=토
  const sinceMonday = (dow + 6) % 7;
  return formatUtc(ms - sinceMonday * DAY_MS);
}

/** 현재 KST 기준 이번 주 월요일. */
export function currentWeekStartKST(now: Date = new Date()): string {
  return weekStartOf(todayKST(now));
}

/** 주 시작일(월요일)로부터 { start: 월요일, end: 일요일 }. */
export function weekRange(weekStart: string): { start: string; end: string } {
  return { start: weekStart, end: addDays(weekStart, 6) };
}

export function addWeeks(weekStart: string, n: number): string {
  return addDays(weekStart, n * 7);
}

/** 유효한 달력 날짜이면서 월요일인지 검사한다. */
export function isWeekStart(value: string): boolean {
  return isValidDateString(value) && weekStartOf(value) === value;
}
