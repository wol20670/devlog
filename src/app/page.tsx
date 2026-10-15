import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getSession } from "@/lib/session";

const FEATURES = [
  ["GitHub 로그인", "GitHub 계정으로 간편하게 시작합니다."],
  ["프로젝트 관리", "진행 중인 프로젝트를 만들고 상태를 관리합니다."],
  ["일별 개발 기록", "오늘 한 일과 배운 점을 날짜별로 기록합니다."],
  ["GitHub 공개 활동", "최근 30일 공개 활동을 한곳에서 확인합니다."],
  ["주간 통계·회고", "한 주의 기록을 집계하고 회고를 남깁니다."],
  ["대시보드", "최근 기록과 이번 주 요약을 한눈에 봅니다."],
];

async function RedirectIfSignedIn() {
  if (await getSession()) redirect("/dashboard");
  return null;
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 py-16">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <p className="font-mono text-sm text-accent">DevLog</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        개발 활동을 기록하고, 한 주를 돌아봅니다
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        프로젝트별 개발 기록과 GitHub 공개 활동을 모아 주간 회고까지 이어가는
        개인 개발 기록 서비스입니다.
      </p>
      <div className="mt-8">
        <ButtonLink href="/login" variant="primary" className="px-4 py-2">
          GitHub로 시작하기
        </ButtonLink>
      </div>
      <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([title, desc]) => (
          <li key={title}>
            <Card className="h-full">
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{desc}</p>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
