const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** UTC 시각을 KST 'YYYY. MM. DD. HH:mm' 형태로 표시한다. */
export function formatDateTimeKST(date: Date): string {
  return dateTimeFormatter.format(date);
}

/**
 * Date는 KST 달력 날짜로 변환해 표시하고,
 * 'YYYY-MM-DD' 문자열(KST 달력 날짜)은 시간대 변환 없이 그대로 표시한다.
 */
export function formatDateKST(date: Date | string): string {
  if (typeof date === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (m) return `${m[1]}. ${m[2]}. ${m[3]}.`;
    return dateFormatter.format(new Date(date));
  }
  return dateFormatter.format(date);
}
