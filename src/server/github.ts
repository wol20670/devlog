import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { Db } from "@/db";
import { account } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import {
  fetchGithubActivityWithToken,
  githubFailure,
  type GithubActivityResult,
} from "@/lib/github/activity";

export type {
  GithubActivityData,
  GithubActivityError,
  GithubActivityErrorKind,
  GithubActivityResult,
} from "@/lib/github/activity";

export type GithubAccount = {
  /** Better Auth 내부 account.id (getAccessToken용) */
  id: string;
  /** GitHub 사용자 숫자 ID 문자열 (GitHub /user.id 비교용) */
  accountId: string;
};

/** 사용자의 GitHub 계정 행을 조회한다. 다른 사용자·다른 provider 계정은 반환하지 않는다. */
export async function getGithubAccount(
  db: Db,
  userId: string,
): Promise<GithubAccount | null> {
  const [row] = await db
    .select({ id: account.id, accountId: account.accountId })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "github")))
    .limit(1);
  return row ?? null;
}

/**
 * Better Auth 내부 account.id로 액세스 토큰을 얻는다(만료 시 Better Auth가 refresh).
 * 토큰은 이 모듈 안에서만 쓰며, 실패하면 null.
 */
async function getGithubAccessToken(
  userId: string,
  internalAccountId: string,
): Promise<string | null> {
  try {
    const result = await auth.api.getAccessToken({
      body: { accountId: internalAccountId, userId },
      headers: await headers(),
    });
    return result.accessToken || null;
  } catch {
    return null;
  }
}

export async function fetchGithubActivity(
  db: Db,
  userId: string,
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {},
): Promise<GithubActivityResult> {
  const acc = await getGithubAccount(db, userId);
  if (!acc) return githubFailure("no_account");
  const token = await getGithubAccessToken(userId, acc.id);
  if (!token) return githubFailure("unauthorized");
  return fetchGithubActivityWithToken(token, acc.accountId, fetchImpl);
}
