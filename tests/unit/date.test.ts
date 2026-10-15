import { describe, expect, it } from "vitest";
import { isValidDateString, todayKST } from "@/lib/date";

describe("todayKST", () => {
  it("UTC 14:59:59는 같은 날(KST 23:59:59)", () => {
    expect(todayKST(new Date("2026-10-14T14:59:59Z"))).toBe("2026-10-14");
  });
  it("UTC 15:00:00은 다음 날 KST 00:00:00", () => {
    expect(todayKST(new Date("2026-10-14T15:00:00Z"))).toBe("2026-10-15");
  });
  it("연말 경계", () => {
    expect(todayKST(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });
});

describe("isValidDateString", () => {
  it("유효한 날짜", () => {
    expect(isValidDateString("2026-10-15")).toBe(true);
    expect(isValidDateString("2028-02-29")).toBe(true);
  });
  it("존재하지 않는 날짜 거부", () => {
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(isValidDateString("2026-02-30")).toBe(false);
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("2026-00-10")).toBe(false);
  });
  it("형식 오류 거부", () => {
    expect(isValidDateString("")).toBe(false);
    expect(isValidDateString("2026-1-5")).toBe(false);
    expect(isValidDateString("2026/10/15")).toBe(false);
    expect(isValidDateString("2026-10-15T00:00:00Z")).toBe(false);
  });
});
