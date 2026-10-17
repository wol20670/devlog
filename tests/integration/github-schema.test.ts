import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  connectedRepositories,
  devLogs,
  githubActivities,
  githubAppUserCredentials,
  githubInstallations,
  githubPrCommits,
  githubPrSync,
  githubSyncState,
  projectRepositories,
  projects,
  user,
  webhookDeliveries,
} from "@/db/schema";
import type { Db } from "@/db";
import { createTestDb, createTestUser } from "./helpers/db";
import {
  createActivity,
  createInstallation,
  createRepo,
  expectViolation,
} from "./helpers/github";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

/** 사용자 1명 + 설치 + 저장소 1개 */
async function setup() {
  const u = await createTestUser(db);
  const inst = await createInstallation(db);
  const repo = await createRepo(db, u.id, inst.id);
  return { u, inst, repo };
}

const countBy = async (table: typeof githubActivities | typeof githubPrCommits | typeof githubPrSync | typeof githubSyncState | typeof projectRepositories | typeof connectedRepositories, userId: string) => {
  const rows = await db.select().from(table).where(eq(table.userId, userId));
  return rows.length;
};

describe("cross-user isolation", () => {
  it("rejects project_repositories linking A's project with B's repository", async () => {
    const a = await setup();
    const b = await setup();
    const [pa] = await db.insert(projects).values({ userId: a.u.id, name: "A" }).returning();
    await expectViolation(
      db.insert(projectRepositories).values({
        projectId: pa.id,
        userId: a.u.id,
        connectedRepositoryId: b.repo.id,
      }),
      "project_repos_repo_fk",
    );
    await expectViolation(
      db.insert(projectRepositories).values({
        projectId: pa.id,
        userId: b.u.id,
        connectedRepositoryId: b.repo.id,
      }),
      "project_repos_project_fk",
    );
  });

  it("rejects github_activities for another user's connected repository", async () => {
    const a = await setup();
    const b = await setup();
    await expectViolation(
      createActivity(db, { id: b.repo.id, userId: a.u.id, githubRepoId: b.repo.githubRepoId }, "issue"),
      "activities_repo_fk",
    );
  });

  it("rejects github_pr_commits across users", async () => {
    const a = await setup();
    const b = await setup();
    const prA = await createActivity(db, a.repo, "pull_request");
    const commitA = await createActivity(db, a.repo, "commit");
    const prB = await createActivity(db, b.repo, "pull_request");
    const commitB = await createActivity(db, b.repo, "commit");

    // A 사용자 행인데 PR이 B의 것
    await expectViolation(
      db.insert(githubPrCommits).values({
        userId: a.u.id,
        connectedRepositoryId: a.repo.id,
        prActivityId: prB.id,
        commitActivityId: commitA.id,
        position: 0,
      }),
      "pr_commits_pr_fk",
    );
    // 커밋이 B의 것
    await expectViolation(
      db.insert(githubPrCommits).values({
        userId: a.u.id,
        connectedRepositoryId: a.repo.id,
        prActivityId: prA.id,
        commitActivityId: commitB.id,
        position: 0,
      }),
      "pr_commits_commit_fk",
    );
    expect(prB.id).toBeDefined();
  });

  it("rejects github_sync_state with mismatched user", async () => {
    const a = await setup();
    const b = await setup();
    await expectViolation(
      db.insert(githubSyncState).values({
        userId: b.u.id,
        connectedRepositoryId: a.repo.id,
        resource: "issues",
      }),
      "sync_state_repo_fk",
    );
  });

  it("rejects github_pr_sync for another user's PR", async () => {
    const a = await setup();
    const b = await setup();
    const prB = await createActivity(db, b.repo, "pull_request");
    await expectViolation(
      db.insert(githubPrSync).values({
        prActivityId: prB.id,
        userId: a.u.id,
        connectedRepositoryId: a.repo.id,
      }),
      "pr_sync_pr_fk",
    );
  });
});

describe("activity relationships", () => {
  it("#9a rejects a PR/commit link across two repositories of the same user", async () => {
    const u = await createTestUser(db);
    const inst = await createInstallation(db);
    const repo1 = await createRepo(db, u.id, inst.id);
    const repo2 = await createRepo(db, u.id, inst.id);
    const pr = await createActivity(db, repo1, "pull_request");
    const commit = await createActivity(db, repo2, "commit");

    await expectViolation(
      db.insert(githubPrCommits).values({
        userId: u.id,
        connectedRepositoryId: repo1.id,
        prActivityId: pr.id,
        commitActivityId: commit.id,
        position: 0,
      }),
      "pr_commits_commit_fk",
    );
    await expectViolation(
      db.insert(githubPrCommits).values({
        userId: u.id,
        connectedRepositoryId: repo2.id,
        prActivityId: pr.id,
        commitActivityId: commit.id,
        position: 0,
      }),
      "pr_commits_pr_fk",
    );
  });

  it("#9b rejects an issue or commit in the PR slot", async () => {
    const { u, repo } = await setup();
    const issue = await createActivity(db, repo, "issue");
    const commit = await createActivity(db, repo, "commit");
    const commit2 = await createActivity(db, repo, "commit");

    await expectViolation(
      db.insert(githubPrCommits).values({
        userId: u.id,
        connectedRepositoryId: repo.id,
        prActivityId: issue.id,
        commitActivityId: commit.id,
        position: 0,
      }),
      "pr_commits_pr_fk",
    );
    await expectViolation(
      db.insert(githubPrCommits).values({
        userId: u.id,
        connectedRepositoryId: repo.id,
        prActivityId: commit2.id,
        commitActivityId: commit.id,
        position: 0,
      }),
      "pr_commits_pr_fk",
    );
  });

  it("#9c rejects reviews with an issue parent, a parent in another repo, or no parent", async () => {
    const u = await createTestUser(db);
    const inst = await createInstallation(db);
    const repo1 = await createRepo(db, u.id, inst.id);
    const repo2 = await createRepo(db, u.id, inst.id);
    const issue = await createActivity(db, repo1, "issue");
    const prOther = await createActivity(db, repo2, "pull_request");

    // 부모가 이슈: parent_kind를 pull_request로 위장하면 FK, 솔직히 적으면 CHECK
    await expectViolation(
      createActivity(db, repo1, "review", { parentActivityId: issue.id, parentKind: "pull_request" }),
      "activities_parent_fk",
    );
    await expectViolation(
      createActivity(db, repo1, "review", { parentActivityId: issue.id, parentKind: "issue" }),
      "act_parent_shape",
    );
    // 다른 저장소의 PR
    await expectViolation(
      createActivity(db, repo1, "review", { parentActivityId: prOther.id, parentKind: "pull_request" }),
      "activities_parent_fk",
    );
    // 부모 없는 리뷰
    await expectViolation(createActivity(db, repo1, "review"), "act_parent_shape");
  });

  it("#9e rejects NULL pr_kind and #9f NULL commit_kind in github_pr_commits", async () => {
    const { u, repo } = await setup();
    const pr = await createActivity(db, repo, "pull_request");
    const commit = await createActivity(db, repo, "commit");
    const base = {
      userId: u.id,
      connectedRepositoryId: repo.id,
      prActivityId: pr.id,
      commitActivityId: commit.id,
      position: 0,
    };
    await expectViolation(
      db.insert(githubPrCommits).values({ ...base, prKind: null as unknown as string }),
      "null value in column",
    );
    await expectViolation(
      db.insert(githubPrCommits).values({ ...base, commitKind: null as unknown as string }),
      "null value in column",
    );
  });

  it("#9g rejects a review with parent_activity_id but NULL parent_kind (rev.3 bypass regression)", async () => {
    const { repo } = await setup();
    const pr = await createActivity(db, repo, "pull_request");
    const issue = await createActivity(db, repo, "issue");
    // 복합 FK는 MATCH SIMPLE이라 parent_kind가 NULL이면 FK 검사를 건너뛴다. CHECK가 막아야 한다.
    await expectViolation(
      createActivity(db, repo, "review", { parentActivityId: pr.id, parentKind: null }),
      "act_parent_shape",
    );
    await expectViolation(
      createActivity(db, repo, "review", { parentActivityId: issue.id, parentKind: null }),
      "act_parent_shape",
    );
  });

  it("#9h rejects a commit parent disguised as pull_request and non-review rows with a parent", async () => {
    const { repo } = await setup();
    const commit = await createActivity(db, repo, "commit");
    const pr = await createActivity(db, repo, "pull_request");
    await expectViolation(
      createActivity(db, repo, "review", { parentActivityId: commit.id, parentKind: "pull_request" }),
      "activities_parent_fk",
    );
    await expectViolation(
      createActivity(db, repo, "issue", { parentActivityId: pr.id, parentKind: "pull_request" }),
      "act_parent_shape",
    );
    await expectViolation(
      createActivity(db, repo, "commit", { parentActivityId: pr.id }),
      "act_parent_shape",
    );
  });

  it("#9i accepts valid PR-commit link, review of PR and pr_sync; rejects issue/other-user pr_sync", async () => {
    const { u, repo } = await setup();
    const other = await setup();
    const pr = await createActivity(db, repo, "pull_request");
    const commit = await createActivity(db, repo, "commit");
    const issue = await createActivity(db, repo, "issue");

    const [link] = await db
      .insert(githubPrCommits)
      .values({
        userId: u.id,
        connectedRepositoryId: repo.id,
        prActivityId: pr.id,
        commitActivityId: commit.id,
        position: 0,
      })
      .returning();
    expect(link.prKind).toBe("pull_request");
    expect(link.commitKind).toBe("commit");

    const review = await createActivity(db, repo, "review", {
      parentActivityId: pr.id,
      parentKind: "pull_request",
    });
    expect(review.parentActivityId).toBe(pr.id);

    const [sync] = await db
      .insert(githubPrSync)
      .values({ prActivityId: pr.id, userId: u.id, connectedRepositoryId: repo.id })
      .returning();
    expect(sync.detailStatus).toBe("pending");
    expect(sync.requestedGeneration).toBe(0);
    expect(sync.syncedGeneration).toBe(0);

    await expectViolation(
      db.insert(githubPrSync).values({ prActivityId: issue.id, userId: u.id, connectedRepositoryId: repo.id }),
      "pr_sync_pr_fk",
    );
    const pr3 = await createActivity(db, repo, "pull_request");
    await expectViolation(
      db.insert(githubPrSync).values({ prActivityId: pr3.id, userId: other.u.id, connectedRepositoryId: other.repo.id }),
      "pr_sync_pr_fk",
    );
  });
});

describe("cascade behaviour", () => {
  it("deleting a PR removes its reviews, links and pr_sync but keeps commit rows", async () => {
    const { u, repo } = await setup();
    const pr = await createActivity(db, repo, "pull_request");
    const commit = await createActivity(db, repo, "commit");
    const review = await createActivity(db, repo, "review", {
      parentActivityId: pr.id,
      parentKind: "pull_request",
    });
    await db.insert(githubPrCommits).values({
      userId: u.id,
      connectedRepositoryId: repo.id,
      prActivityId: pr.id,
      commitActivityId: commit.id,
      position: 0,
    });
    await db
      .insert(githubPrSync)
      .values({ prActivityId: pr.id, userId: u.id, connectedRepositoryId: repo.id });

    await db.delete(githubActivities).where(eq(githubActivities.id, pr.id));

    expect(await db.select().from(githubActivities).where(eq(githubActivities.id, review.id))).toHaveLength(0);
    expect(await countBy(githubPrCommits, u.id)).toBe(0);
    expect(await countBy(githubPrSync, u.id)).toBe(0);
    expect(await db.select().from(githubActivities).where(eq(githubActivities.id, commit.id))).toHaveLength(1);
  });

  it("deleting a connected repository removes dependants but keeps the installation", async () => {
    const { u, inst, repo } = await setup();
    const [project] = await db.insert(projects).values({ userId: u.id, name: "P" }).returning();
    await db
      .insert(projectRepositories)
      .values({ projectId: project.id, userId: u.id, connectedRepositoryId: repo.id });
    const pr = await createActivity(db, repo, "pull_request");
    const commit = await createActivity(db, repo, "commit");
    await db.insert(githubPrCommits).values({
      userId: u.id,
      connectedRepositoryId: repo.id,
      prActivityId: pr.id,
      commitActivityId: commit.id,
      position: 0,
    });
    await db
      .insert(githubPrSync)
      .values({ prActivityId: pr.id, userId: u.id, connectedRepositoryId: repo.id });
    await db
      .insert(githubSyncState)
      .values({ userId: u.id, connectedRepositoryId: repo.id, resource: "issues" });

    await db.delete(connectedRepositories).where(eq(connectedRepositories.id, repo.id));

    expect(await countBy(githubActivities, u.id)).toBe(0);
    expect(await countBy(githubSyncState, u.id)).toBe(0);
    expect(await countBy(projectRepositories, u.id)).toBe(0);
    expect(await countBy(githubPrCommits, u.id)).toBe(0);
    expect(await countBy(githubPrSync, u.id)).toBe(0);
    expect(await db.select().from(githubInstallations).where(eq(githubInstallations.id, inst.id))).toHaveLength(1);
    expect(await db.select().from(projects).where(eq(projects.id, project.id))).toHaveLength(1);
  });

  it("deleting a project removes only project_repositories", async () => {
    const { u, repo } = await setup();
    const [project] = await db.insert(projects).values({ userId: u.id, name: "P" }).returning();
    await db
      .insert(projectRepositories)
      .values({ projectId: project.id, userId: u.id, connectedRepositoryId: repo.id });

    await db.delete(projects).where(eq(projects.id, project.id));

    expect(await countBy(projectRepositories, u.id)).toBe(0);
    expect(await countBy(connectedRepositories, u.id)).toBe(1);
  });

  it("deleting a user removes all of their v2 rows", async () => {
    const { u, repo } = await setup();
    const [project] = await db.insert(projects).values({ userId: u.id, name: "P" }).returning();
    await db
      .insert(projectRepositories)
      .values({ projectId: project.id, userId: u.id, connectedRepositoryId: repo.id });
    const pr = await createActivity(db, repo, "pull_request");
    const commit = await createActivity(db, repo, "commit");
    await db.insert(githubPrCommits).values({
      userId: u.id,
      connectedRepositoryId: repo.id,
      prActivityId: pr.id,
      commitActivityId: commit.id,
      position: 0,
    });
    await db
      .insert(githubPrSync)
      .values({ prActivityId: pr.id, userId: u.id, connectedRepositoryId: repo.id });
    await db
      .insert(githubSyncState)
      .values({ userId: u.id, connectedRepositoryId: repo.id, resource: "pull_requests" });
    await db
      .insert(githubAppUserCredentials)
      .values({ userId: u.id, app: "reader", githubUserId: 42 });

    await db.delete(user).where(eq(user.id, u.id));

    expect(await countBy(connectedRepositories, u.id)).toBe(0);
    expect(await countBy(githubActivities, u.id)).toBe(0);
    expect(await countBy(githubPrCommits, u.id)).toBe(0);
    expect(await countBy(githubPrSync, u.id)).toBe(0);
    expect(await countBy(githubSyncState, u.id)).toBe(0);
    expect(await countBy(projectRepositories, u.id)).toBe(0);
    expect(
      await db.select().from(githubAppUserCredentials).where(eq(githubAppUserCredentials.userId, u.id)),
    ).toHaveLength(0);
  });

  it("rejects deleting an installation that is still referenced", async () => {
    const { inst } = await setup();
    await expectViolation(
      db.delete(githubInstallations).where(eq(githubInstallations.id, inst.id)),
      "connected_repos_installation_fk",
    );
  });
});

describe("reconnect", () => {
  it("rejects duplicate (user, repo, kind, external_id) and allows re-insert after reconnect", async () => {
    const { u, inst, repo } = await setup();
    await createActivity(db, repo, "commit", { externalId: "sha-1" });
    await expectViolation(
      createActivity(db, repo, "commit", { externalId: "sha-1" }),
      "activities_user_repo_kind_external_unique",
    );
    // 같은 external_id라도 kind가 다르면 허용
    await createActivity(db, repo, "issue", { externalId: "sha-1" });

    await db.delete(connectedRepositories).where(eq(connectedRepositories.id, repo.id));
    const repo2 = await createRepo(db, u.id, inst.id, { githubRepoId: repo.githubRepoId });
    await createActivity(db, repo2, "commit", { externalId: "sha-1" });

    const rows = await db
      .select()
      .from(githubActivities)
      .where(
        sql`${githubActivities.userId} = ${u.id} AND ${githubActivities.kind} = 'commit' AND ${githubActivities.externalId} = 'sha-1'`,
      );
    expect(rows).toHaveLength(1);
  });
});

describe("github_sync_state", () => {
  it("applies defaults", async () => {
    const { u, repo } = await setup();
    const [s] = await db
      .insert(githubSyncState)
      .values({ userId: u.id, connectedRepositoryId: repo.id, resource: "default_branch_commits" })
      .returning();
    expect(s.status).toBe("idle");
    expect(s.phase).toBe("recent");
    expect(s.leaseToken).toBe(0);
    expect(s.changeGeneration).toBe(0);
    expect(s.processedGeneration).toBe(0);
    expect(s.passGeneration).toBeNull();
    expect(s.targetedPrNumbers).toEqual([]);
    expect(s.cursor).toEqual({});
    expect(s.itemsProcessed).toBe(0);
  });

  it("rejects duplicate (repo, resource) and invalid enum values", async () => {
    const { u, repo } = await setup();
    const base = { userId: u.id, connectedRepositoryId: repo.id };
    await db.insert(githubSyncState).values({ ...base, resource: "issues" });
    await expectViolation(
      db.insert(githubSyncState).values({ ...base, resource: "issues" }),
      "sync_state_repo_resource_unique",
    );
    await expectViolation(
      db.insert(githubSyncState).values({ ...base, resource: "bogus" }),
      "sync_state_resource_check",
    );
    await expectViolation(
      db.insert(githubSyncState).values({ ...base, resource: "pr_details", status: "bogus" }),
      "sync_state_status_check",
    );
    await expectViolation(
      db.insert(githubSyncState).values({ ...base, resource: "pr_details", phase: "bogus" }),
      "sync_state_phase_check",
    );
  });

  it("limits targeted_pr_numbers to pull_requests and at most 100 entries", async () => {
    const { u, repo } = await setup();
    const base = { userId: u.id, connectedRepositoryId: repo.id };
    await expectViolation(
      db.insert(githubSyncState).values({ ...base, resource: "issues", targetedPrNumbers: [1] }),
      "sync_state_targeted_resource_check",
    );
    const nums = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
    const [ok] = await db
      .insert(githubSyncState)
      .values({ ...base, resource: "pull_requests", targetedPrNumbers: nums(100) })
      .returning();
    expect(ok.targetedPrNumbers).toHaveLength(100);
    await expectViolation(
      db
        .update(githubSyncState)
        .set({ targetedPrNumbers: nums(101) })
        .where(eq(githubSyncState.id, ok.id)),
      "sync_state_targeted_max_check",
    );
  });
});

describe("github_pr_sync checks", () => {
  it("rejects synced_generation > requested_generation and invalid detail_status", async () => {
    const { u, repo } = await setup();
    const pr = await createActivity(db, repo, "pull_request");
    const pr2 = await createActivity(db, repo, "pull_request");
    await expectViolation(
      db.insert(githubPrSync).values({
        prActivityId: pr.id,
        userId: u.id,
        connectedRepositoryId: repo.id,
        requestedGeneration: 1,
        syncedGeneration: 2,
      }),
      "pr_sync_generation_check",
    );
    await expectViolation(
      db.insert(githubPrSync).values({
        prActivityId: pr2.id,
        userId: u.id,
        connectedRepositoryId: repo.id,
        detailStatus: "bogus",
      }),
      "pr_sync_detail_status_check",
    );
  });
});

describe("other checks", () => {
  it("connected_repositories.access_state defaults to unknown and rejects invalid values", async () => {
    const { u, inst, repo } = await setup();
    expect(repo.accessState).toBe("unknown");
    await expectViolation(
      createRepo(db, u.id, inst.id, { accessState: "bogus" }),
      "connected_repos_access_state_check",
    );
  });

  it("github_app_user_credentials unique(user_id, app) and app check", async () => {
    const u = await createTestUser(db);
    const [c] = await db
      .insert(githubAppUserCredentials)
      .values({ userId: u.id, app: "reader", githubUserId: 1 })
      .returning();
    expect(c.status).toBe("active");
    await expectViolation(
      db.insert(githubAppUserCredentials).values({ userId: u.id, app: "reader", githubUserId: 1 }),
      "credentials_user_app_unique",
    );
    await db.insert(githubAppUserCredentials).values({ userId: u.id, app: "publisher", githubUserId: 1 });
    await expectViolation(
      db.insert(githubAppUserCredentials).values({ userId: u.id, app: "other", githubUserId: 1 }),
      "credentials_app_check",
    );
    await expectViolation(
      db
        .update(githubAppUserCredentials)
        .set({ status: "bogus" })
        .where(eq(githubAppUserCredentials.id, c.id)),
      "credentials_status_check",
    );
  });

  it("github_installations unique(app, installation_id)", async () => {
    const inst = await createInstallation(db);
    await expectViolation(
      createInstallation(db, { app: inst.app, installationId: inst.installationId }),
      "installations_app_installation_unique",
    );
    // 다른 앱이면 같은 installation_id 허용
    await createInstallation(db, { app: "publisher", installationId: inst.installationId });
    await expectViolation(
      createInstallation(db, { repositorySelection: "bogus" }),
      "installations_selection_check",
    );
  });

  it("body_excerpt allows 500 chars and rejects 501", async () => {
    const { repo } = await setup();
    await createActivity(db, repo, "issue", { bodyExcerpt: "a".repeat(500) });
    await expectViolation(
      createActivity(db, repo, "issue", { bodyExcerpt: "a".repeat(501) }),
      "activities_body_excerpt_len_check",
    );
  });

  it("webhook_deliveries dedupes with ON CONFLICT DO NOTHING RETURNING", async () => {
    const values = { deliveryId: "delivery-1", app: "reader", event: "push" };
    const first = await db.insert(webhookDeliveries).values(values).onConflictDoNothing().returning();
    expect(first).toHaveLength(1);
    const second = await db.insert(webhookDeliveries).values(values).onConflictDoNothing().returning();
    expect(second).toHaveLength(0);
    await expectViolation(
      db.insert(webhookDeliveries).values({ deliveryId: "delivery-2", app: "bogus", event: "push" }),
      "webhook_deliveries_app_check",
    );
  });
});

describe("existing v1 tables", () => {
  it("have UNIQUE(id, user_id) and v1 behaviour is unchanged", async () => {
    const res = await db.execute(sql`
      select conname, conrelid::regclass::text as tbl, pg_get_constraintdef(oid) as def
      from pg_constraint
      where conname in ('projects_id_user_id_unique', 'dev_logs_id_user_id_unique')
    `);
    const rows = (res as unknown as { rows: Array<{ conname: string; tbl: string; def: string }> }).rows as Array<{ conname: string; tbl: string; def: string }>;
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.def).toBe("UNIQUE (id, user_id)");

    const u = await createTestUser(db);
    const [p] = await db.insert(projects).values({ userId: u.id, name: "P" }).returning();
    const [log] = await db
      .insert(devLogs)
      .values({ userId: u.id, projectId: p.id, logDate: "2026-10-15", title: "L" })
      .returning();
    await db.delete(projects).where(eq(projects.id, p.id));
    const [after] = await db.select().from(devLogs).where(eq(devLogs.id, log.id));
    expect(after.projectId).toBeNull();
  });
});
