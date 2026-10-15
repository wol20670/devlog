import { describe, expect, it } from "vitest";
import { devLogInputSchema } from "@/lib/validation/dev-log";

const base = { logDate: "2026-10-15", projectId: "", title: "제목" };

describe("devLogInputSchema", () => {
  it("제목만 있어도 통과하고 본문은 빈 문자열, projectId는 null", () => {
    const r = devLogInputSchema.parse(base);
    expect(r).toEqual({
      logDate: "2026-10-15",
      projectId: null,
      title: "제목",
      workDone: "",
      learned: "",
      problems: "",
      solutions: "",
    });
  });

  it("uuid projectId 통과, 잘못된 값 거부", () => {
    const id = crypto.randomUUID();
    expect(devLogInputSchema.parse({ ...base, projectId: id }).projectId).toBe(id);
    expect(devLogInputSchema.safeParse({ ...base, projectId: "abc" }).success).toBe(false);
  });

  it("날짜 검증", () => {
    expect(devLogInputSchema.safeParse({ ...base, logDate: "2026-02-30" }).success).toBe(false);
    expect(devLogInputSchema.safeParse({ ...base, logDate: "" }).success).toBe(false);
  });

  it("제목은 trim 후 1~200자", () => {
    expect(devLogInputSchema.safeParse({ ...base, title: "   " }).success).toBe(false);
    expect(devLogInputSchema.safeParse({ ...base, title: "a".repeat(201) }).success).toBe(false);
    expect(devLogInputSchema.parse({ ...base, title: "  a  " }).title).toBe("a");
  });

  it("본문은 trim 후 10000자 이하", () => {
    expect(devLogInputSchema.parse({ ...base, workDone: "  x  " }).workDone).toBe("x");
    expect(
      devLogInputSchema.safeParse({ ...base, learned: "a".repeat(10001) }).success,
    ).toBe(false);
    expect(
      devLogInputSchema.safeParse({ ...base, solutions: "a".repeat(10000) }).success,
    ).toBe(true);
  });
});
