import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** 요청 내 중복 조회를 제거한 세션 조회. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** 세션이 없으면 /login으로 보내고, 있으면 사용자 정보를 반환한다. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
}
