import { expect } from "vitest";
import {
  connectedRepositories,
  githubActivities,
  githubInstallations,
} from "@/db/schema";
import type { Db } from "@/db";

let seq = 1000;
const next = () => (seq += 1);

export async function createInstallation(
  db: Db,
  overrides: Partial<typeof githubInstallations.$inferInsert> = {},
) {
  const n = next();
  const [row] = await db
    .insert(githubInstallations)
    .values({
      app: "reader",
      installationId: n,
      accountId: n,
      accountLogin: `acct-${n}`,
      accountType: "User",
      repositorySelection: "all",
      ...overrides,
    })
    .returning();
  return row;
}

export async function createRepo(
  db: Db,
  userId: string,
  installationRef: string,
  overrides: Partial<typeof connectedRepositories.$inferInsert> = {},
) {
  const n = next();
  const [row] = await db
    .insert(connectedRepositories)
    .values({
      userId,
      installationRef,
      githubRepoId: n,
      nodeId: `node-${n}`,
      ownerId: n,
      fullName: `owner/repo-${n}`,
      isPrivate: false,
      defaultBranch: "main",
      ...overrides,
    })
    .returning();
  return row;
}

/** 활동 행 한 건을 만든다. userId/githubRepoId는 연결 저장소 기준으로 채운다. */
export async function createActivity(
  db: Db,
  repo: { id: string; userId: string; githubRepoId: number },
  kind: "commit" | "pull_request" | "issue" | "review",
  overrides: Partial<typeof githubActivities.$inferInsert> = {},
) {
  const n = next();
  const [row] = await db
    .insert(githubActivities)
    .values({
      userId: repo.userId,
      connectedRepositoryId: repo.id,
      githubRepoId: repo.githubRepoId,
      kind,
      externalId: `ext-${n}`,
      htmlUrl: `https://github.com/x/y/${n}`,
      occurredAt: new Date("2026-10-15T00:00:00Z"),
      isPrivate: false,
      ...overrides,
    })
    .returning();
  return row;
}

function errorChain(err: unknown): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  let cur: unknown = err;
  while (cur && typeof cur === "object" && out.length < 5) {
    out.push(cur as Record<string, unknown>);
    cur = (cur as { cause?: unknown }).cause;
  }
  return out;
}

/** 쿼리가 거부되고, 오류의 constraint 필드 또는 메시지에 expected(제약 이름/컬럼 이름)가 있는지 확인한다. */
export async function expectViolation(promise: PromiseLike<unknown>, expected: string) {
  let caught: unknown;
  try {
    await promise;
  } catch (e) {
    caught = e;
  }
  expect(caught, "expected the query to be rejected").toBeDefined();
  const chain = errorChain(caught);
  const haystack = chain
    .flatMap((e) => [String(e.constraint ?? ""), String(e.message ?? ""), String(e.detail ?? "")])
    .join("\n");
  expect(haystack).toContain(expected);
}
