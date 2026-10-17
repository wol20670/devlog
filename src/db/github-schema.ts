// v2 GitHub 저장소 연동 테이블. schema.ts를 import하지 않는다(순환 참조 방지).
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { createdAt, tstz, updatedAt } from "./columns";

const big = (name: string) => bigint(name, { mode: "number" });

export const githubAppUserCredentials = pgTable(
  "github_app_user_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    app: text("app").notNull(),
    githubUserId: big("github_user_id").notNull(),
    encAccessToken: text("enc_access_token"),
    encRefreshToken: text("enc_refresh_token"),
    accessExpiresAt: tstz("access_expires_at"),
    refreshExpiresAt: tstz("refresh_expires_at"),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("credentials_user_app_unique").on(t.userId, t.app),
    index("credentials_app_github_user_idx").on(t.app, t.githubUserId),
    check("credentials_app_check", sql`${t.app} IN ('reader','publisher')`),
    check("credentials_status_check", sql`${t.status} IN ('active','reauth_required')`),
  ],
);

export const githubInstallations = pgTable(
  "github_installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    app: text("app").notNull(),
    installationId: big("installation_id").notNull(),
    accountId: big("account_id").notNull(),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type").notNull(),
    repositorySelection: text("repository_selection").notNull(),
    permissions: jsonb("permissions").notNull().default({}),
    suspendedAt: tstz("suspended_at"),
    deletedAt: tstz("deleted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("installations_app_installation_unique").on(t.app, t.installationId),
    check("installations_app_check", sql`${t.app} IN ('reader','publisher')`),
    check("installations_selection_check", sql`${t.repositorySelection} IN ('all','selected')`),
  ],
);

export const connectedRepositories = pgTable(
  "connected_repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // ON DELETE 기본값(NO ACTION): 참조 중인 전역 설치는 삭제할 수 없다.
    installationRef: uuid("installation_ref").notNull(),
    githubRepoId: big("github_repo_id").notNull(),
    nodeId: text("node_id").notNull(),
    ownerId: big("owner_id").notNull(),
    fullName: text("full_name").notNull(),
    isPrivate: boolean("is_private").notNull(),
    defaultBranch: text("default_branch").notNull(),
    accessState: text("access_state").notNull().default("unknown"),
    accessReason: text("access_reason"),
    accessVerifiedAt: tstz("access_verified_at"),
    accessCheckedAt: tstz("access_checked_at"),
    userPermission: text("user_permission"),
    confirmedHead: text("confirmed_head"),
    historyRewrittenAt: tstz("history_rewritten_at"),
    capped: boolean("capped").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.installationRef],
      foreignColumns: [githubInstallations.id],
      name: "connected_repos_installation_fk",
    }),
    unique("connected_repos_user_repo_unique").on(t.userId, t.githubRepoId),
    unique("connected_repos_id_user_id_unique").on(t.id, t.userId),
    index("connected_repos_github_repo_id_idx").on(t.githubRepoId),
    index("connected_repos_installation_ref_idx").on(t.installationRef),
    check(
      "connected_repos_access_state_check",
      sql`${t.accessState} IN ('ok','access_lost','installation_removed','reauth_required','sso_required','unknown')`,
    ),
  ],
);

export const githubActivities = pgTable(
  "github_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    connectedRepositoryId: uuid("connected_repository_id").notNull(),
    githubRepoId: big("github_repo_id").notNull(),
    kind: text("kind").notNull(),
    // commit = sha, 그 외 = GitHub 숫자 id 문자열
    externalId: text("external_id").notNull(),
    nodeId: text("node_id"),
    number: integer("number"),
    parentActivityId: uuid("parent_activity_id"),
    parentKind: text("parent_kind"),
    title: text("title").notNull().default(""),
    bodyExcerpt: text("body_excerpt").notNull().default(""),
    state: text("state"),
    authorGithubId: big("author_github_id"),
    authorLogin: text("author_login"),
    authorName: text("author_name"),
    htmlUrl: text("html_url").notNull(),
    occurredAt: tstz("occurred_at").notNull(),
    ghCreatedAt: tstz("gh_created_at"),
    ghUpdatedAt: tstz("gh_updated_at"),
    ghMergedAt: tstz("gh_merged_at"),
    ghClosedAt: tstz("gh_closed_at"),
    mergeCommitSha: text("merge_commit_sha"),
    onDefaultBranch: boolean("on_default_branch").notNull().default(false),
    seenViaPr: boolean("seen_via_pr").notNull().default(false),
    isDetached: boolean("is_detached").notNull().default(false),
    commitsTruncated: boolean("commits_truncated").notNull().default(false),
    commitsTotal: integer("commits_total"),
    reviewsTruncated: boolean("reviews_truncated").notNull().default(false),
    isPrivate: boolean("is_private").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.connectedRepositoryId, t.userId],
      foreignColumns: [connectedRepositories.id, connectedRepositories.userId],
      name: "activities_repo_fk",
    }).onDelete("cascade"),
    unique("activities_user_repo_kind_external_unique").on(
      t.userId,
      t.githubRepoId,
      t.kind,
      t.externalId,
    ),
    unique("activities_id_user_id_unique").on(t.id, t.userId),
    unique("activities_id_user_repo_kind_unique").on(
      t.id,
      t.userId,
      t.connectedRepositoryId,
      t.kind,
    ),
    foreignKey({
      columns: [t.parentActivityId, t.userId, t.connectedRepositoryId, t.parentKind],
      foreignColumns: [t.id, t.userId, t.connectedRepositoryId, t.kind],
      name: "activities_parent_fk",
    }).onDelete("cascade"),
    check("activities_kind_check", sql`${t.kind} IN ('commit','pull_request','issue','review')`),
    check(
      "act_parent_shape",
      sql`(${t.kind} = 'review' AND ${t.parentActivityId} IS NOT NULL AND ${t.parentKind} IS NOT NULL AND ${t.parentKind} = 'pull_request') OR (${t.kind} <> 'review' AND ${t.parentActivityId} IS NULL AND ${t.parentKind} IS NULL)`,
    ),
    check("activities_body_excerpt_len_check", sql`char_length(${t.bodyExcerpt}) <= 500`),
    index("activities_user_repo_occurred_idx").on(
      t.userId,
      t.connectedRepositoryId,
      t.occurredAt.desc(),
    ),
    index("activities_user_author_idx").on(t.userId, t.authorGithubId),
    index("activities_repo_kind_number_idx").on(t.connectedRepositoryId, t.kind, t.number),
    index("activities_parent_idx").on(t.parentActivityId),
  ],
);

export const githubPrCommits = pgTable(
  "github_pr_commits",
  {
    userId: text("user_id").notNull(),
    connectedRepositoryId: uuid("connected_repository_id").notNull(),
    prActivityId: uuid("pr_activity_id").notNull(),
    prKind: text("pr_kind").notNull().default("pull_request"),
    commitActivityId: uuid("commit_activity_id").notNull(),
    commitKind: text("commit_kind").notNull().default("commit"),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.prActivityId, t.commitActivityId] }),
    foreignKey({
      columns: [t.prActivityId, t.userId, t.connectedRepositoryId, t.prKind],
      foreignColumns: [
        githubActivities.id,
        githubActivities.userId,
        githubActivities.connectedRepositoryId,
        githubActivities.kind,
      ],
      name: "pr_commits_pr_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.commitActivityId, t.userId, t.connectedRepositoryId, t.commitKind],
      foreignColumns: [
        githubActivities.id,
        githubActivities.userId,
        githubActivities.connectedRepositoryId,
        githubActivities.kind,
      ],
      name: "pr_commits_commit_fk",
    }).onDelete("cascade"),
    check("pr_commits_pr_kind_check", sql`${t.prKind} = 'pull_request'`),
    check("pr_commits_commit_kind_check", sql`${t.commitKind} = 'commit'`),
    index("pr_commits_commit_idx").on(t.commitActivityId),
  ],
);

export const githubPrSync = pgTable(
  "github_pr_sync",
  {
    prActivityId: uuid("pr_activity_id").primaryKey(),
    userId: text("user_id").notNull(),
    connectedRepositoryId: uuid("connected_repository_id").notNull(),
    prKind: text("pr_kind").notNull().default("pull_request"),
    requestedGeneration: big("requested_generation").notNull().default(0),
    syncedGeneration: big("synced_generation").notNull().default(0),
    syncedForUpdatedAt: tstz("synced_for_updated_at"),
    detailStatus: text("detail_status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextRunAfter: tstz("next_run_after"),
    lastErrorKind: text("last_error_kind"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.prActivityId, t.userId, t.connectedRepositoryId, t.prKind],
      foreignColumns: [
        githubActivities.id,
        githubActivities.userId,
        githubActivities.connectedRepositoryId,
        githubActivities.kind,
      ],
      name: "pr_sync_pr_fk",
    }).onDelete("cascade"),
    check("pr_sync_pr_kind_check", sql`${t.prKind} = 'pull_request'`),
    check("pr_sync_detail_status_check", sql`${t.detailStatus} IN ('pending','done','error')`),
    check(
      "pr_sync_generation_check",
      sql`${t.syncedGeneration} >= 0 AND ${t.syncedGeneration} <= ${t.requestedGeneration}`,
    ),
    index("pr_sync_pending_idx")
      .on(t.connectedRepositoryId, t.nextRunAfter)
      .where(sql`${t.requestedGeneration} > ${t.syncedGeneration} AND ${t.detailStatus} <> 'error'`),
  ],
);

export const githubSyncState = pgTable(
  "github_sync_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    connectedRepositoryId: uuid("connected_repository_id").notNull(),
    resource: text("resource").notNull(),
    status: text("status").notNull().default("idle"),
    phase: text("phase").notNull().default("recent"),
    cursor: jsonb("cursor").notNull().default({}),
    leaseOwner: text("lease_owner"),
    leaseToken: big("lease_token").notNull().default(0),
    leaseExpiresAt: tstz("lease_expires_at"),
    changeGeneration: big("change_generation").notNull().default(0),
    processedGeneration: big("processed_generation").notNull().default(0),
    passGeneration: big("pass_generation"),
    targetedPrNumbers: integer("targeted_pr_numbers")
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    nextRunAfter: tstz("next_run_after"),
    attempts: integer("attempts").notNull().default(0),
    lastErrorKind: text("last_error_kind"),
    lastErrorAt: tstz("last_error_at"),
    lastSuccessAt: tstz("last_success_at"),
    requestedAt: tstz("requested_at"),
    itemsTotal: integer("items_total"),
    itemsProcessed: integer("items_processed").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.connectedRepositoryId, t.userId],
      foreignColumns: [connectedRepositories.id, connectedRepositories.userId],
      name: "sync_state_repo_fk",
    }).onDelete("cascade"),
    unique("sync_state_repo_resource_unique").on(t.connectedRepositoryId, t.resource),
    check(
      "sync_state_resource_check",
      sql`${t.resource} IN ('default_branch_commits','pull_requests','pr_details','issues')`,
    ),
    check(
      "sync_state_status_check",
      sql`${t.status} IN ('idle','pending','running','blocked','error','complete')`,
    ),
    check("sync_state_phase_check", sql`${t.phase} IN ('recent','backfill','incremental')`),
    check(
      "sync_state_targeted_resource_check",
      sql`${t.resource} = 'pull_requests' OR cardinality(${t.targetedPrNumbers}) = 0`,
    ),
    check("sync_state_targeted_max_check", sql`cardinality(${t.targetedPrNumbers}) <= 100`),
    index("sync_state_status_next_run_idx").on(t.status, t.nextRunAfter),
  ],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    deliveryId: text("delivery_id").primaryKey(),
    app: text("app").notNull(),
    event: text("event").notNull(),
    action: text("action"),
    installationId: big("installation_id"),
    receivedAt: tstz("received_at").notNull().defaultNow(),
  },
  (t) => [
    check("webhook_deliveries_app_check", sql`${t.app} IN ('reader','publisher')`),
    index("webhook_deliveries_received_at_idx").on(t.receivedAt),
  ],
);

export type GithubAppUserCredential = typeof githubAppUserCredentials.$inferSelect;
export type NewGithubAppUserCredential = typeof githubAppUserCredentials.$inferInsert;
export type GithubInstallation = typeof githubInstallations.$inferSelect;
export type NewGithubInstallation = typeof githubInstallations.$inferInsert;
export type ConnectedRepository = typeof connectedRepositories.$inferSelect;
export type NewConnectedRepository = typeof connectedRepositories.$inferInsert;
export type GithubActivity = typeof githubActivities.$inferSelect;
export type NewGithubActivity = typeof githubActivities.$inferInsert;
export type GithubPrCommit = typeof githubPrCommits.$inferSelect;
export type NewGithubPrCommit = typeof githubPrCommits.$inferInsert;
export type GithubPrSync = typeof githubPrSync.$inferSelect;
export type NewGithubPrSync = typeof githubPrSync.$inferInsert;
export type GithubSyncState = typeof githubSyncState.$inferSelect;
export type NewGithubSyncState = typeof githubSyncState.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
