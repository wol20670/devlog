import { NO_PROJECT_LABEL, type WeeklyStats } from "@/lib/stats";

export type TemplateLog = {
  logDate: string;
  title: string;
  learned: string;
  problems: string;
  solutions: string;
};

const EXCERPT_MAX = 120;

function firstLine(text: string): string {
  const line =
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l !== "") ?? "";
  return line.length > EXCERPT_MAX ? `${line.slice(0, EXCERPT_MAX)}…` : line;
}

function section(heading: string, items: string[]): string {
  const body = items.length > 0 ? items.map((i) => `- ${i}`) : ["- "];
  return `## ${heading}\n${body.join("\n")}`;
}

function mmdd(date: string): string {
  return date.slice(5).replace("-", "/");
}

/** 기록만으로 만드는 기본 회고 템플릿(외부 AI/GitHub 데이터 미사용). */
export function buildReviewTemplate(
  stats: WeeklyStats,
  logs: TemplateLog[],
): { title: string; content: string } {
  const [y, m, d] = stats.weekStart.split("-");
  const [, em, ed] = stats.weekEnd.split("-");
  const title = `${y}. ${m}. ${d}. ~ ${em}. ${ed}. 주간 회고`;

  const summary = [
    `개발 기록 ${stats.totalLogs}건, 기록한 날 ${stats.activeDays}일`,
  ];
  if (stats.byProject.length > 0) {
    summary.push(
      "프로젝트별: " +
        stats.byProject
          .map((p) => `${p.projectName ?? NO_PROJECT_LABEL} ${p.count}건`)
          .join(", "),
    );
  }

  const work = logs.map((l) => `(${mmdd(l.logDate)}) ${l.title}`);
  const learned = logs
    .filter((l) => l.learned.trim() !== "")
    .map((l) => firstLine(l.learned));
  const problems = logs.flatMap((l) => {
    const p = firstLine(l.problems);
    const s = firstLine(l.solutions);
    if (!p && !s) return [];
    if (p && s) return [`${p} → ${s}`];
    return [p || s];
  });

  const content = [
    section("이번 주 요약", summary),
    section("진행한 작업", work),
    section("배운 점", learned),
    section("문제와 해결", problems),
    section("다음 주 계획", []),
  ].join("\n\n");

  return { title, content };
}
