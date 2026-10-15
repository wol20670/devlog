import { describe, expect, it } from "vitest";
import { buildReviewTemplate } from "@/lib/review-template";
import { computeWeeklyStats } from "@/lib/stats";

const W = "2026-12-28";

describe("buildReviewTemplate", () => {
  it("기록이 없으면 각 섹션이 빈 항목", () => {
    const { title, content } = buildReviewTemplate(computeWeeklyStats([], W), []);
    expect(title).toBe("2026. 12. 28. ~ 01. 03. 주간 회고");
    expect(content).toBe(
      [
        "## 이번 주 요약\n- 개발 기록 0건, 기록한 날 0일",
        "## 진행한 작업\n- ",
        "## 배운 점\n- ",
        "## 문제와 해결\n- ",
        "## 다음 주 계획\n- ",
      ].join("\n\n"),
    );
  });

  it("기록이 있으면 요약·작업·배운 점·문제를 채운다", () => {
    const logs = [
      {
        logDate: "2026-12-28",
        projectId: "a",
        projectName: "Alpha",
        title: "로그인 구현",
        learned: "\n첫 배운 점\n둘째 줄",
        problems: "콜백 오류",
        solutions: "URL 수정",
      },
      {
        logDate: "2026-12-30",
        projectId: null,
        projectName: null,
        title: "정리",
        learned: "",
        problems: "",
        solutions: "",
      },
    ];
    const { content } = buildReviewTemplate(computeWeeklyStats(logs, W), logs);
    expect(content).toContain("- 개발 기록 2건, 기록한 날 2일");
    expect(content).toContain("- 프로젝트별: 프로젝트 없음 1건, Alpha 1건");
    expect(content).toContain("- (12/28) 로그인 구현\n- (12/30) 정리");
    expect(content).toContain("## 배운 점\n- 첫 배운 점\n");
    expect(content).not.toContain("둘째 줄");
    expect(content).toContain("## 문제와 해결\n- 콜백 오류 → URL 수정\n");
    expect(content.endsWith("## 다음 주 계획\n- ")).toBe(true);
  });
});
