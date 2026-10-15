import { describe, expect, it } from "vitest";
import { computeWeeklyStats } from "@/lib/stats";

const W = "2026-10-12";
const log = (logDate: string, projectId: string | null, projectName: string | null) => ({
  logDate,
  projectId,
  projectName,
});

describe("computeWeeklyStats", () => {
  it("기록이 없으면 7일 모두 0", () => {
    const s = computeWeeklyStats([], W);
    expect(s.weekEnd).toBe("2026-10-18");
    expect(s.totalLogs).toBe(0);
    expect(s.activeDays).toBe(0);
    expect(s.days.map((d) => d.date)).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15",
      "2026-10-16", "2026-10-17", "2026-10-18",
    ]);
    expect(s.days.every((d) => d.count === 0)).toBe(true);
    expect(s.byProject).toEqual([]);
  });

  it("activeDays는 고유 날짜 수", () => {
    const s = computeWeeklyStats(
      [log("2026-10-12", null, null), log("2026-10-12", null, null), log("2026-10-14", null, null)],
      W,
    );
    expect(s.totalLogs).toBe(3);
    expect(s.activeDays).toBe(2);
    expect(s.days[0].count).toBe(2);
    expect(s.days[2].count).toBe(1);
  });

  it("프로젝트별은 count desc, 이름 asc, 프로젝트 없음은 null로 묶는다", () => {
    const s = computeWeeklyStats(
      [
        log("2026-10-12", "b", "Beta"),
        log("2026-10-13", "a", "Alpha"),
        log("2026-10-13", null, null),
        log("2026-10-14", "c", "Gamma"),
        log("2026-10-14", "c", "Gamma"),
        log("2026-10-14", "c", "Gamma"),
        log("2026-10-15", null, null),
      ],
      W,
    );
    expect(s.byProject).toEqual([
      { projectId: "c", projectName: "Gamma", count: 3 },
      { projectId: null, projectName: null, count: 2 },
      { projectId: "a", projectName: "Alpha", count: 1 },
      { projectId: "b", projectName: "Beta", count: 1 },
    ]);
  });

  it("주 범위 밖 기록은 무시한다", () => {
    const s = computeWeeklyStats(
      [log("2026-10-11", null, null), log("2026-10-19", null, null), log("2026-10-18", null, null)],
      W,
    );
    expect(s.totalLogs).toBe(1);
    expect(s.days[6].count).toBe(1);
  });
});
