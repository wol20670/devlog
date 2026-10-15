import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { loginErrorMessage } from "@/lib/auth-errors";
import { getSession } from "@/lib/session";
import { GithubLoginButton } from "./GithubLoginButton";

export const metadata: Metadata = { title: "로그인" };

// DB로 검증된 유효 세션이 있을 때만 /dashboard로 보낸다(stale 쿠키는 무시).
async function RedirectIfSignedIn() {
  if (await getSession()) redirect("/dashboard");
  return null;
}

async function ErrorMessage({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p role="alert" className="mb-4 text-sm text-danger">
      {loginErrorMessage(error)}
    </p>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">DevLog 로그인</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          GitHub 계정으로 로그인합니다.
        </p>
        <Suspense fallback={null}>
          <ErrorMessage searchParams={props.searchParams} />
        </Suspense>
        <GithubLoginButton />
        <p className="mt-4 text-xs text-muted">
          공개 프로필과 이메일 주소 읽기 권한만 요청합니다. 저장소 코드나 쓰기
          권한은 요청하지 않습니다.
        </p>
      </Card>
    </main>
  );
}
