import { describe, expect, it } from "vitest";
import { formatDateKST, formatDateTimeKST } from "@/lib/format";

describe("format (KST)", () => {
  it("UTC 2026-10-14T15:30:00Z는 KST 2026-10-15 00:30으로 표시한다", () => {
    const d = new Date("2026-10-14T15:30:00Z");
    expect(formatDateKST(d)).toBe("2026. 10. 15.");
    expect(formatDateTimeKST(d)).toBe("2026. 10. 15. 00:30");
  });

  it("UTC 2026-10-14T14:59:59Z는 아직 KST 10월 14일이다", () => {
    expect(formatDateKST(new Date("2026-10-14T14:59:59Z"))).toBe("2026. 10. 14.");
  });

  it("연말 경계: UTC 2026-12-31T15:00:00Z는 KST 2027-01-01", () => {
    expect(formatDateKST(new Date("2026-12-31T15:00:00Z"))).toBe("2027. 01. 01.");
  });

  it("YYYY-MM-DD 문자열은 변환 없이 그대로 표시한다", () => {
    expect(formatDateKST("2026-10-15")).toBe("2026. 10. 15.");
  });
});
