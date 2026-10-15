import { describe, expect, it } from "vitest";
import { projectInputSchema } from "@/lib/validation/project";

describe("projectInputSchema", () => {
  it("공백만 있는 이름은 거부한다", () => {
    expect(projectInputSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("이름 100자는 허용, 101자는 거부한다", () => {
    expect(projectInputSchema.safeParse({ name: "a".repeat(100) }).success).toBe(true);
    expect(projectInputSchema.safeParse({ name: "a".repeat(101) }).success).toBe(false);
  });

  it("이름과 설명을 trim하고 기본값을 채운다", () => {
    const r = projectInputSchema.parse({ name: "  DevLog  " });
    expect(r).toEqual({ name: "DevLog", description: "", status: "active" });
  });

  it("설명 2000자 초과는 거부한다", () => {
    const base = { name: "x" };
    expect(projectInputSchema.safeParse({ ...base, description: "a".repeat(2000) }).success).toBe(true);
    expect(projectInputSchema.safeParse({ ...base, description: "a".repeat(2001) }).success).toBe(false);
  });

  it("잘못된 status는 거부한다", () => {
    expect(projectInputSchema.safeParse({ name: "x", status: "done" }).success).toBe(false);
    expect(projectInputSchema.safeParse({ name: "x", status: "paused" }).success).toBe(true);
  });
});
