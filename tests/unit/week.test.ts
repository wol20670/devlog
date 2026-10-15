import { describe, expect, it } from "vitest";
import {
  addWeeks,
  currentWeekStartKST,
  isWeekStart,
  weekRange,
  weekStartOf,
} from "@/lib/date";

describe("weekStartOf", () => {
  it("월요일은 자기 자신, 일요일은 같은 주 월요일", () => {
    expect(weekStartOf("2026-10-12")).toBe("2026-10-12");
    expect(weekStartOf("2026-10-18")).toBe("2026-10-12");
    expect(weekStartOf("2026-10-15")).toBe("2026-10-12");
  });

  it("연말·연초 주", () => {
    expect(weekStartOf("2026-12-31")).toBe("2026-12-28");
    expect(weekStartOf("2027-01-03")).toBe("2026-12-28");
    expect(weekStartOf("2027-01-04")).toBe("2027-01-04");
  });

  it("윤년", () => {
    expect(weekStartOf("2028-02-29")).toBe("2028-02-28");
    expect(weekStartOf("2028-03-01")).toBe("2028-02-28");
  });
});

describe("currentWeekStartKST", () => {
  it("KST 일요일 23:30(UTC 14:30)은 그 주 월요일", () => {
    expect(currentWeekStartKST(new Date("2026-10-18T14:30:00Z"))).toBe("2026-10-12");
  });

  it("KST 월요일 00:10(UTC 일요일 15:10)은 새 주", () => {
    expect(currentWeekStartKST(new Date("2026-10-18T15:10:00Z"))).toBe("2026-10-19");
  });
});

describe("weekRange / addWeeks / isWeekStart", () => {
  it("weekRange는 월~일", () => {
    expect(weekRange("2026-12-28")).toEqual({ start: "2026-12-28", end: "2027-01-03" });
    expect(weekRange("2028-02-28")).toEqual({ start: "2028-02-28", end: "2028-03-05" });
  });

  it("addWeeks", () => {
    expect(addWeeks("2026-12-28", 1)).toBe("2027-01-04");
    expect(addWeeks("2026-10-12", -1)).toBe("2026-10-05");
    expect(addWeeks("2028-02-28", 1)).toBe("2028-03-06");
    expect(addWeeks("2026-10-12", 0)).toBe("2026-10-12");
  });

  it("isWeekStart", () => {
    expect(isWeekStart("2026-10-12")).toBe(true);
    expect(isWeekStart("2026-10-13")).toBe(false);
    expect(isWeekStart("2026-02-30")).toBe(false);
    expect(isWeekStart("abc")).toBe(false);
  });
});
